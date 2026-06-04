const SendJob = require('../models/SendJob');
const EmailLog = require('../models/EmailLog');
const Template = require('../models/Templates');
const contactService = require('./contactService');
const { sendRawEmail } = require('./emailService');

// Be nice to Gmail: send sequentially with a delay between messages. Gmail's
// free tier allows ~500 recipients/day and throttles bursts, so we pace out.
const RATE_DELAY_MS = Number(process.env.SEND_RATE_DELAY_MS) || 1200;
// Abort a run if this many sends fail back-to-back (bad credentials, quota hit).
const MAX_CONSECUTIVE_FAILURES = 10;

// History filtering allow-lists (injection guard, same pattern as contacts).
const HISTORY_FILTERABLE = {
    status: 'enum',
    template_name: 'text',
    email: 'text',
};
const HISTORY_SORTABLE = new Set(['sent_at', 'created_at', 'email', 'template_name']);
const HISTORY_SEARCHABLE = ['email', 'contact_name', 'template_name', 'subject'];

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ---- Token rendering -------------------------------------------------------

function buildFieldMap(contact) {
    const first = contact.first_name || '';
    const last = contact.last_name || '';
    return {
        first_name: first,
        last_name: last,
        name: [first, last].filter(Boolean).join(' ').trim(),
        full_name: [first, last].filter(Boolean).join(' ').trim(),
        email: contact.email || '',
        hotel_name: contact.hotel_name || '',
        hotel: contact.hotel_name || '',
        portfolio: contact.portfolio || '',
    };
}

// Replace every [[token]] with the matching contact value (case-insensitive).
// Unknown tokens collapse to an empty string so no [[...]] leaks into the email.
function renderTokens(text, fieldMap) {
    return String(text == null ? '' : text).replace(
        /\[\[([^[\]]+?)\]\]/g,
        (_, token) => {
            const key = String(token).trim().toLowerCase();
            return Object.prototype.hasOwnProperty.call(fieldMap, key)
                ? String(fieldMap[key] ?? '')
                : '';
        }
    );
}

// ---- Recipient resolution --------------------------------------------------

async function resolveRecipients(job) {
    if (job.mode === 'all') {
        return contactService.queryAll({
            filters: job.filters || {},
            search: job.search,
        });
    }
    return contactService.getByIds({ ids: job.contact_ids || [] });
}

async function recipientCount({ mode, contact_ids, filters, search }) {
    if (mode === 'all') {
        const { total } = await contactService.queryContacts({
            filters: filters || {},
            search,
            limit: 1,
            skip: 0,
        });
        return total;
    }
    return Array.isArray(contact_ids) ? contact_ids.length : 0;
}

// ---- Create + run a job ----------------------------------------------------

async function createJob({ userId, template_id, subject, mode, contact_ids, filters, search }) {
    const template = await Template.findById(template_id).lean();
    if (!template) {
        const err = new Error('Template not found');
        err.statusCode = 404;
        throw err;
    }
    if (!subject || !String(subject).trim()) {
        const err = new Error('Subject is required');
        err.statusCode = 400;
        throw err;
    }

    const resolvedMode = mode === 'all' ? 'all' : 'selected';
    const ids = Array.isArray(contact_ids) ? contact_ids : [];
    const total = await recipientCount({ mode: resolvedMode, contact_ids: ids, filters, search });
    if (total === 0) {
        const err = new Error('No recipients selected');
        err.statusCode = 400;
        throw err;
    }

    const job = await SendJob.create({
        template_id,
        template_name: template.name,
        subject: String(subject).trim(),
        mode: resolvedMode,
        contact_ids: resolvedMode === 'selected' ? ids : [],
        filters: resolvedMode === 'all' ? filters || {} : undefined,
        search: resolvedMode === 'all' ? search : undefined,
        status: 'queued',
        total,
        created_by: userId,
    });

    // Fire-and-forget background processing. Errors are captured onto the job.
    processJob(job._id).catch((e) => console.error('[send] job crashed', e));

    return job.toObject();
}

async function processJob(jobId) {
    const job = await SendJob.findById(jobId);
    if (!job) return;

    try {
        job.status = 'running';
        job.started_at = new Date();
        await job.save();

        const template = await Template.findById(job.template_id).lean();
        if (!template) throw new Error('Template no longer exists');

        const recipients = await resolveRecipients(job);
        job.total = recipients.length;
        await job.save();

        let consecutiveFailures = 0;

        for (let i = 0; i < recipients.length; i++) {
            const contact = recipients[i];
            const map = buildFieldMap(contact);
            const html = renderTokens(template.html, map);
            const subject = renderTokens(job.subject, map);

            let status = 'sent';
            let error = '';
            try {
                if (!contact.email) throw new Error('Contact has no email address');
                await sendRawEmail({ to: contact.email, subject, html });
                job.sent += 1;
                consecutiveFailures = 0;
            } catch (e) {
                status = 'failed';
                error = e.message || 'Send failed';
                job.failed += 1;
                consecutiveFailures += 1;
            }

            await EmailLog.create({
                job_id: job._id,
                template_id: job.template_id,
                template_name: job.template_name,
                contact_id: contact._id,
                email: contact.email || '',
                contact_name: map.name,
                hotel_name: contact.hotel_name || '',
                portfolio: contact.portfolio || '',
                subject,
                status,
                error,
                created_by: job.created_by,
                sent_at: new Date(),
            });

            // Persist progress so the jobs view reflects "delivered so far".
            await SendJob.updateOne(
                { _id: job._id },
                { sent: job.sent, failed: job.failed }
            );

            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                throw new Error(
                    `Aborted after ${MAX_CONSECUTIVE_FAILURES} consecutive failures — check SMTP credentials / quota.`
                );
            }

            if (i < recipients.length - 1) await sleep(RATE_DELAY_MS);
        }

        job.completed_at = new Date();
        job.status =
            job.failed === 0 ? 'completed' : job.sent === 0 ? 'failed' : 'partial';
        await job.save();
    } catch (e) {
        job.error = e.message || 'Job failed';
        job.completed_at = new Date();
        job.status = job.sent > 0 ? 'partial' : 'failed';
        await job.save();
    }
}

// ---- Queries ---------------------------------------------------------------

async function listJobs({ limit = 25, skip = 0 } = {}) {
    const [items, total] = await Promise.all([
        SendJob.find({})
            .select('-contact_ids -filters')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        SendJob.countDocuments({}),
    ]);
    return { items, total, limit, skip };
}

async function getJob({ id }) {
    const job = await SendJob.findById(id).select('-contact_ids -filters').lean();
    if (!job) {
        const err = new Error('Job not found');
        err.statusCode = 404;
        throw err;
    }
    return job;
}

function buildHistoryQuery({ filters, search }) {
    const query = {};
    if (filters && typeof filters === 'object') {
        for (const [field, filter] of Object.entries(filters)) {
            if (!HISTORY_FILTERABLE[field] || !filter || typeof filter !== 'object') continue;
            if (filter.op === 'in' && Array.isArray(filter.value)) {
                const cleaned = filter.value.filter((v) => v != null && v !== '');
                if (cleaned.length) query[field] = { $in: cleaned };
            } else if (filter.op === 'eq' && filter.value != null && filter.value !== '') {
                query[field] = filter.value;
            } else if (filter.op === 'contains' && filter.value) {
                query[field] = { $regex: escapeRegex(filter.value), $options: 'i' };
            }
        }
    }
    if (search && String(search).trim()) {
        const regex = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
        query.$or = HISTORY_SEARCHABLE.map((f) => ({ [f]: regex }));
    }
    return query;
}

async function queryHistory({ filters, search, sort, limit = 25, skip = 0 }) {
    const query = buildHistoryQuery({ filters, search });

    let mongoSort = { sent_at: -1 };
    if (Array.isArray(sort) && sort.length) {
        mongoSort = {};
        for (const s of sort) {
            if (!s || !HISTORY_SORTABLE.has(s.key)) continue;
            mongoSort[s.key] = s.dir === 'asc' ? 1 : -1;
        }
        if (Object.keys(mongoSort).length === 0) mongoSort = { sent_at: -1 };
    }

    const [items, total] = await Promise.all([
        EmailLog.find(query).sort(mongoSort).skip(skip).limit(limit).lean(),
        EmailLog.countDocuments(query),
    ]);
    return { items, total, limit, skip };
}

// Distinct template names that appear in history — for the history filter.
async function historyTemplates() {
    const names = await EmailLog.distinct('template_name');
    return names.filter(Boolean).sort();
}

module.exports = {
    renderTokens,
    buildFieldMap,
    createJob,
    processJob,
    listJobs,
    getJob,
    queryHistory,
    historyTemplates,
};
