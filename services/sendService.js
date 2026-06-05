const SendJob = require('../models/SendJob');
const EmailLog = require('../models/EmailLog');
const Template = require('../models/Templates');
const Contact = require('../models/Contact');
const contactService = require('./contactService');
const { sendRawEmail } = require('./emailService');

// Pacing between messages within a burst.
const RATE_DELAY_MS = Number(process.env.SEND_RATE_DELAY_MS) || 1200;
// Rolling rate limits. Gmail's hard cap is ~2000 recipients per rolling 24h;
// we stay well under to leave headroom for OTP/login mail on the same account.
// BOTH are measured as rolling windows over actual send timestamps, so we can
// never cross Gmail's rolling 24h.
const HOURLY_LIMIT = Number(process.env.SEND_HOURLY_LIMIT) || 100;
const DAILY_LIMIT = Number(process.env.SEND_DAILY_LIMIT) || 1000;
// Window durations are overridable (mainly for tests); defaults are the real
// rolling hour / 24h.
const HOUR_MS = Number(process.env.SEND_HOUR_MS) || 60 * 60 * 1000;
const DAY_MS = Number(process.env.SEND_DAY_MS) || 24 * 60 * 60 * 1000;
// How often the scheduler wakes to resume cooled-down jobs.
const SCHEDULER_INTERVAL_MS = Number(process.env.SEND_SCHEDULER_INTERVAL_MS) || 60 * 1000;
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

// Normalise a CC value (array or comma-separated string) into a deduped list
// of trimmed, lowercased addresses.
function parseCcList(cc) {
    const raw = Array.isArray(cc) ? cc : typeof cc === 'string' ? cc.split(',') : [];
    const seen = new Set();
    const out = [];
    for (const item of raw) {
        const v = String(item).trim().toLowerCase();
        if (!v || !v.includes('@') || seen.has(v)) continue;
        seen.add(v);
        out.push(v);
    }
    return out;
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

// ---- Rolling rate-limit budget ---------------------------------------------

async function countSentSince(windowMs) {
    return EmailLog.countDocuments({
        status: 'sent',
        sent_at: { $gte: new Date(Date.now() - windowMs) },
    });
}

// Remaining capacity in the rolling hour/day windows.
async function getBudget() {
    const [hour, day] = await Promise.all([
        countSentSince(HOUR_MS),
        countSentSince(DAY_MS),
    ]);
    return {
        hourlyLimit: HOURLY_LIMIT,
        dailyLimit: DAILY_LIMIT,
        sentLastHour: hour,
        sentLastDay: day,
        remainingHour: Math.max(0, HOURLY_LIMIT - hour),
        remainingDay: Math.max(0, DAILY_LIMIT - day),
    };
}

// When the oldest send in a window ages out, a slot frees up.
async function windowFreesAt(windowMs) {
    const oldest = await EmailLog.find({
        status: 'sent',
        sent_at: { $gte: new Date(Date.now() - windowMs) },
    })
        .sort({ sent_at: 1 })
        .limit(1)
        .select('sent_at')
        .lean();
    if (!oldest.length) return new Date(Date.now() + windowMs);
    return new Date(oldest[0].sent_at.getTime() + windowMs + 1000);
}

// ---- Create a job (snapshot recipients) ------------------------------------

async function createJob({ userId, template_id, subject, cc, mode, contact_ids, filters, search }) {
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

    // Freeze the recipient set now so the job is deterministic and resumable.
    let recipientIds;
    if (resolvedMode === 'all') {
        const rows = await contactService.queryAll({ filters: filters || {}, search });
        recipientIds = rows.map((r) => r._id);
    } else {
        recipientIds = Array.isArray(contact_ids) ? contact_ids : [];
    }
    recipientIds = [...new Set(recipientIds.map(String))];
    const total = recipientIds.length;
    if (total === 0) {
        const err = new Error('No recipients selected');
        err.statusCode = 400;
        throw err;
    }

    const job = await SendJob.create({
        template_id,
        template_name: template.name,
        subject: String(subject).trim(),
        cc: parseCcList(cc),
        mode: resolvedMode,
        contact_ids: resolvedMode === 'selected' ? recipientIds : [],
        filters: resolvedMode === 'all' ? filters || {} : undefined,
        search: resolvedMode === 'all' ? search : undefined,
        recipient_ids: recipientIds,
        cursor: 0,
        status: 'queued',
        total,
        created_by: userId,
    });

    kickWorker();
    return job.toObject();
}

// ---- The single global send worker -----------------------------------------

let working = false;

function kickWorker() {
    runWorker().catch((e) => console.error('[send] worker error', e));
}

// Oldest job that can send right now: queued/running, or a cooldown whose
// resume time has passed.
async function pickNextJob() {
    const now = new Date();
    return SendJob.findOne({
        $or: [
            { status: { $in: ['queued', 'running'] } },
            { status: 'cooldown', resume_at: { $lte: now } },
        ],
    }).sort({ created_at: 1 });
}

async function runWorker() {
    if (working) return;
    working = true;
    try {
        for (;;) {
            const job = await pickNextJob();
            if (!job) break;
            const keepGoing = await processJobBurst(job);
            // When a job cools down for budget reasons the whole account is
            // tapped out, so stop — the scheduler will wake us when it frees.
            if (!keepGoing) break;
        }
    } finally {
        working = false;
    }
}

async function finalizeJob(jobId, sent, failed) {
    let status = 'completed';
    if (sent === 0 && failed > 0) status = 'failed';
    else if (failed > 0) status = 'partial';
    await SendJob.updateOne(
        { _id: jobId },
        { status, completed_at: new Date(), $unset: { resume_at: 1 } }
    );
}

async function coolDownJob(jobId, budget, progress) {
    const resumeAt =
        budget.remainingDay <= 0
            ? await windowFreesAt(DAY_MS)
            : await windowFreesAt(HOUR_MS);
    await SendJob.updateOne(
        { _id: jobId },
        {
            status: 'cooldown',
            resume_at: resumeAt,
            sent: progress.sent,
            failed: progress.failed,
            cursor: progress.cursor,
            started_at: progress.startedAt,
        }
    );
}

// Send one burst (up to the remaining budget) for a job. Returns true if the
// worker may continue to other jobs, false if the global budget is exhausted.
async function processJobBurst(job) {
    const template = await Template.findById(job.template_id).lean();
    if (!template) {
        await SendJob.updateOne(
            { _id: job._id },
            { status: 'failed', error: 'Template no longer exists', completed_at: new Date() }
        );
        return true;
    }

    const startedAt = job.started_at || new Date();
    await SendJob.updateOne(
        { _id: job._id },
        { status: 'running', started_at: startedAt, $unset: { resume_at: 1 } }
    );

    const recipientIds = (job.recipient_ids || []).map(String);
    let cursor = job.cursor || 0;
    let sent = job.sent || 0;
    let failed = job.failed || 0;

    const pending = recipientIds.length - cursor;
    if (pending <= 0) {
        await finalizeJob(job._id, sent, failed);
        return true;
    }

    const budget = await getBudget();
    const burst = Math.min(budget.remainingHour, budget.remainingDay, pending);
    if (burst <= 0) {
        await coolDownJob(job._id, budget, { sent, failed, cursor, startedAt });
        return false;
    }

    const sliceIds = recipientIds.slice(cursor, cursor + burst);
    const contacts = await Contact.find({ _id: { $in: sliceIds } }).lean();
    const byId = new Map(contacts.map((c) => [String(c._id), c]));

    let consecutiveFailures = 0;
    for (let k = 0; k < sliceIds.length; k++) {
        const contact = byId.get(sliceIds[k]);
        const map = contact ? buildFieldMap(contact) : {};
        const subject = renderTokens(job.subject, map);

        let status = 'sent';
        let error = '';
        try {
            if (!contact) throw new Error('Contact no longer exists');
            if (!contact.email) throw new Error('Contact has no email address');
            const html = renderTokens(template.html, map);
            await sendRawEmail({ to: contact.email, subject, html, cc: job.cc });
            sent += 1;
            consecutiveFailures = 0;
        } catch (e) {
            status = 'failed';
            error = e.message || 'Send failed';
            failed += 1;
            consecutiveFailures += 1;
        }

        await EmailLog.create({
            job_id: job._id,
            template_id: job.template_id,
            template_name: job.template_name,
            contact_id: contact ? contact._id : undefined,
            email: contact ? contact.email || '' : '',
            contact_name: map.name || '',
            hotel_name: contact ? contact.hotel_name || '' : '',
            portfolio: contact ? contact.portfolio || '' : '',
            subject,
            status,
            error,
            created_by: job.created_by,
            sent_at: new Date(),
        });

        cursor += 1;
        await SendJob.updateOne({ _id: job._id }, { sent, failed, cursor });

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            await SendJob.updateOne(
                { _id: job._id },
                {
                    status: sent > 0 ? 'partial' : 'failed',
                    error: `Aborted after ${MAX_CONSECUTIVE_FAILURES} consecutive failures — check SMTP credentials / quota.`,
                    completed_at: new Date(),
                }
            );
            return true;
        }

        if (k < sliceIds.length - 1) await sleep(RATE_DELAY_MS);
    }

    if (cursor >= recipientIds.length) {
        await finalizeJob(job._id, sent, failed);
        return true;
    }

    // Pending recipients remain → the burst was bound by the budget → cooldown.
    const after = await getBudget();
    await coolDownJob(job._id, after, { sent, failed, cursor, startedAt });
    return false;
}

// ---- Scheduler + boot recovery ---------------------------------------------

let schedulerStarted = false;

function startScheduler() {
    if (schedulerStarted) return;
    schedulerStarted = true;
    console.log(
        `[send] limits: ${HOURLY_LIMIT}/hour, ${DAILY_LIMIT}/day · windows ${Math.round(HOUR_MS / 1000)}s/${Math.round(DAY_MS / 1000)}s · delay ${RATE_DELAY_MS}ms`
    );
    // A job left 'running' means the server died mid-send — requeue it so the
    // worker resumes from its cursor.
    SendJob.updateMany({ status: 'running' }, { status: 'queued' })
        .catch((e) => console.error('[send] boot requeue failed', e))
        .finally(() => kickWorker());
    setInterval(() => kickWorker(), SCHEDULER_INTERVAL_MS);
}

// ---- Queries ---------------------------------------------------------------

async function listJobs({ limit = 25, skip = 0 } = {}) {
    const [items, total] = await Promise.all([
        SendJob.find({})
            .select('-contact_ids -filters -recipient_ids')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        SendJob.countDocuments({}),
    ]);
    return { items, total, limit, skip };
}

async function getJob({ id }) {
    const job = await SendJob.findById(id).select('-contact_ids -filters -recipient_ids').lean();
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
    getBudget,
    createJob,
    startScheduler,
    listJobs,
    getJob,
    queryHistory,
    historyTemplates,
};
