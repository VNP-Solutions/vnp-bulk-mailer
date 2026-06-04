const Template = require('../models/Templates');

const SEARCHABLE_FIELDS = ['name', 'fields'];
const SORTABLE_FIELDS = new Set(['name', 'created_at']);

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pull every [[token]] out of the html, trimmed, deduped, in first-seen order.
function extractFields(html) {
    const out = [];
    const seen = new Set();
    const re = /\[\[([^[\]]+?)\]\]/g;
    let match;
    while ((match = re.exec(String(html))) !== null) {
        const field = match[1].trim();
        if (!field) continue;
        const key = field.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(field);
    }
    return out;
}

function buildQuery({ search }) {
    const query = {};
    if (search && String(search).trim()) {
        const regex = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
        query.$or = SEARCHABLE_FIELDS.map((field) => ({ [field]: regex }));
    }
    return query;
}

function buildSort(sort) {
    let mongoSort = { created_at: -1 };
    if (Array.isArray(sort) && sort.length) {
        mongoSort = {};
        for (const s of sort) {
            if (!s || !SORTABLE_FIELDS.has(s.key)) continue;
            mongoSort[s.key] = s.dir === 'asc' ? 1 : -1;
        }
        if (Object.keys(mongoSort).length === 0) mongoSort = { created_at: -1 };
    }
    return mongoSort;
}

async function createTemplate({ userId, name, html, source_name }) {
    const cleanName = name != null ? String(name).trim() : '';
    if (!cleanName) {
        const err = new Error('Template name is required');
        err.statusCode = 400;
        throw err;
    }
    if (!html || !String(html).trim()) {
        const err = new Error('Template HTML is empty');
        err.statusCode = 400;
        throw err;
    }

    const fields = extractFields(html);
    const template = await Template.create({
        name: cleanName,
        html: String(html),
        fields,
        source_name: source_name ? String(source_name).trim() : undefined,
        created_by: userId,
    });
    return template.toObject();
}

// List view — excludes the (potentially large) html blob for speed.
async function queryTemplates({ search, sort, limit = 25, skip = 0 }) {
    const query = buildQuery({ search });
    const mongoSort = buildSort(sort);

    const [items, total] = await Promise.all([
        Template.find(query)
            .select('-html')
            .sort(mongoSort)
            .skip(skip)
            .limit(limit)
            .lean(),
        Template.countDocuments(query),
    ]);

    return { items, total, limit, skip };
}

async function getById({ id }) {
    const template = await Template.findById(id).lean();
    if (!template) {
        const err = new Error('Template not found');
        err.statusCode = 404;
        throw err;
    }
    return template;
}

async function updateTemplate({ id, name, html }) {
    const template = await Template.findById(id);
    if (!template) {
        const err = new Error('Template not found');
        err.statusCode = 404;
        throw err;
    }

    if (name != null) {
        const cleanName = String(name).trim();
        if (!cleanName) {
            const err = new Error('Template name is required');
            err.statusCode = 400;
            throw err;
        }
        template.name = cleanName;
    }

    if (html != null) {
        if (!String(html).trim()) {
            const err = new Error('Template HTML is empty');
            err.statusCode = 400;
            throw err;
        }
        template.html = String(html);
        // Re-detect [[field]] tokens whenever the html changes.
        template.fields = extractFields(html);
    }

    await template.save();
    return template.toObject();
}

async function deleteTemplate({ id }) {
    const deleted = await Template.findByIdAndDelete(id);
    if (!deleted) {
        const err = new Error('Template not found');
        err.statusCode = 404;
        throw err;
    }
    return { message: 'Template deleted' };
}

module.exports = {
    extractFields,
    createTemplate,
    queryTemplates,
    getById,
    updateTemplate,
    deleteTemplate,
};
