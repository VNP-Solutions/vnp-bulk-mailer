const Contact = require('../models/Contact');

// Fields that can be filtered/sorted, mapped to their filter kind. Every
// contact field is free text, so they're all `text` (string match via regex
// or $in). This allow-list is the injection guard — only these keys from a
// client `filters`/`sort`/`distinct` request ever reach the Mongo query.
const FILTERABLE_FIELDS = {
    first_name: 'text',
    last_name: 'text',
    email: 'text',
    hotel_name: 'text',
    portfolio: 'text',
};

const SORTABLE_FIELDS = new Set(
    Object.keys(FILTERABLE_FIELDS).concat(['created_at'])
);

// Fields the top search box matches against.
const SEARCHABLE_FIELDS = [
    'first_name',
    'last_name',
    'email',
    'hotel_name',
    'portfolio',
];

// Columns accepted from a bulk-upload spreadsheet → contact field. Header
// matching is case-insensitive and tolerant of spaces/underscores.
const IMPORT_HEADER_MAP = {
    first_name: 'first_name',
    'first name': 'first_name',
    firstname: 'first_name',
    last_name: 'last_name',
    'last name': 'last_name',
    lastname: 'last_name',
    email: 'email',
    'email address': 'email',
    hotel_name: 'hotel_name',
    'hotel name': 'hotel_name',
    hotel: 'hotel_name',
    portfolio: 'portfolio',
};

const EXPORT_HARD_CAP = 100000;

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCondition(kind, filter) {
    if (!filter || typeof filter !== 'object') return null;
    const { op } = filter;

    if (kind === 'text' || kind === 'enum') {
        const value = filter.value;
        if (op === 'in' && Array.isArray(value)) {
            const cleaned = value.filter((v) => v != null && v !== '');
            return cleaned.length ? { $in: cleaned } : null;
        }
        if (op === 'contains' && value) {
            return { $regex: escapeRegex(value), $options: 'i' };
        }
        if (op === 'startswith' && value) {
            return { $regex: '^' + escapeRegex(value), $options: 'i' };
        }
        if (op === 'endswith' && value) {
            return { $regex: escapeRegex(value) + '$', $options: 'i' };
        }
        if (op === 'eq' && value !== undefined && value !== '') {
            return value;
        }
        return null;
    }

    return null;
}

function buildSearchOr(search) {
    if (!search || !String(search).trim()) return null;
    const regex = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
    return SEARCHABLE_FIELDS.map((field) => ({ [field]: regex }));
}

function buildQuery({ filters, search }) {
    const query = {};

    if (filters && typeof filters === 'object') {
        for (const [field, filter] of Object.entries(filters)) {
            const kind = FILTERABLE_FIELDS[field];
            if (!kind) continue;
            const cond = buildCondition(kind, filter);
            if (cond != null) query[field] = cond;
        }
    }

    const orClauses = buildSearchOr(search);
    if (orClauses) query.$or = orClauses;

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
        if (Object.keys(mongoSort).length === 0) {
            mongoSort = { created_at: -1 };
        }
    }
    return mongoSort;
}

async function queryContacts({ filters, sort, search, limit = 50, skip = 0 }) {
    const query = buildQuery({ filters, search });
    const mongoSort = buildSort(sort);

    const [items, total] = await Promise.all([
        Contact.find(query).sort(mongoSort).skip(skip).limit(limit).lean(),
        Contact.countDocuments(query),
    ]);

    return { items, total, limit, skip };
}

async function distinctValues({ field, search, limit = 200 }) {
    if (!FILTERABLE_FIELDS[field]) {
        const err = new Error('Field is not filterable');
        err.statusCode = 400;
        throw err;
    }

    const match = { [field]: { $nin: [null, ''] } };
    if (search && String(search).trim()) {
        match[field] = {
            ...match[field],
            $regex: escapeRegex(String(search).trim()),
            $options: 'i',
        };
    }

    const result = await Contact.aggregate([
        { $match: match },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        {
            $facet: {
                values: [{ $limit: limit }],
                total: [{ $count: 'count' }],
            },
        },
    ]);

    const facet = result[0] || {};
    const values = (facet.values || [])
        .map((v) => v._id)
        .filter((v) => v != null && v !== '');
    const totalCount =
        (facet.total && facet.total[0] && facet.total[0].count) || 0;

    return { values, total: totalCount, shown: values.length };
}

async function queryAll({ filters, sort, search }) {
    const query = buildQuery({ filters, search });
    const mongoSort = buildSort(sort);
    return Contact.find(query).sort(mongoSort).limit(EXPORT_HARD_CAP).lean();
}

async function getByIds({ ids }) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    return Contact.find({ _id: { $in: ids } })
        .sort({ created_at: -1 })
        .lean();
}

function normalizeContact({ first_name, last_name, email, hotel_name, portfolio }) {
    return {
        first_name: first_name != null ? String(first_name).trim() : '',
        last_name: last_name != null ? String(last_name).trim() : '',
        email: email != null ? String(email).trim() : '',
        hotel_name: hotel_name != null ? String(hotel_name).trim() : '',
        portfolio: portfolio != null ? String(portfolio).trim() : '',
    };
}

async function createContact({ userId, ...fields }) {
    const data = normalizeContact(fields);
    if (!data.email) {
        const err = new Error('Email is required');
        err.statusCode = 400;
        throw err;
    }
    const contact = await Contact.create({ ...data, created_by: userId });
    return contact.toObject();
}

// Map a raw spreadsheet row (keyed by its header) to a contact, using the
// case-insensitive IMPORT_HEADER_MAP.
function mapImportRow(row) {
    const out = {};
    for (const [rawHeader, value] of Object.entries(row)) {
        const key = String(rawHeader).trim().toLowerCase();
        const field = IMPORT_HEADER_MAP[key];
        if (field && out[field] == null) {
            out[field] = value;
        }
    }
    return normalizeContact(out);
}

// Insert many contacts parsed from an upload. Returns counts + per-row errors,
// mirroring the file-parse contract the upload modal expects.
async function bulkCreate({ userId, rows }) {
    const total = rows.length;
    const errors = [];
    const docs = [];

    rows.forEach((row, i) => {
        const rowNum = i + 2; // +1 for 1-indexed, +1 for header row
        const mapped = mapImportRow(row);
        if (!mapped.email) {
            errors.push({ row: rowNum, message: 'Missing email — row skipped' });
            return;
        }
        docs.push({ ...mapped, created_by: userId });
    });

    let inserted = 0;
    if (docs.length) {
        const result = await Contact.insertMany(docs, { ordered: false }).catch(
            (e) => {
                // With ordered:false, insertMany throws but still inserts the
                // good docs; pull the real inserted count off the error.
                if (e && e.insertedDocs) return e.insertedDocs;
                throw e;
            }
        );
        inserted = Array.isArray(result) ? result.length : docs.length;
    }

    return {
        rows_total: total,
        rows_inserted: inserted,
        rows_failed: total - inserted,
        errors: errors.slice(0, 200),
    };
}

async function deleteContact({ id }) {
    const deleted = await Contact.findByIdAndDelete(id);
    if (!deleted) {
        const err = new Error('Contact not found');
        err.statusCode = 404;
        throw err;
    }
    return { message: 'Contact deleted' };
}

// Delete a batch of contacts by id. Returns how many were removed.
async function deleteMany({ ids }) {
    if (!Array.isArray(ids) || ids.length === 0) {
        const err = new Error('No contacts selected');
        err.statusCode = 400;
        throw err;
    }
    const result = await Contact.deleteMany({ _id: { $in: ids } });
    return { deleted: result.deletedCount || 0 };
}

module.exports = {
    FILTERABLE_FIELDS,
    IMPORT_HEADER_MAP,
    queryContacts,
    distinctValues,
    queryAll,
    getByIds,
    createContact,
    bulkCreate,
    deleteContact,
    deleteMany,
};
