const XLSX = require('xlsx');
const contactService = require('../services/contactService');

// Export column order: header label → contact field.
const EXPORT_COLUMNS = [
    ['First Name', 'first_name'],
    ['Last Name', 'last_name'],
    ['Email', 'email'],
    ['Hotel Name', 'hotel_name'],
    ['Portfolio', 'portfolio'],
];

function buildExportBuffer(rows) {
    const aoa = [EXPORT_COLUMNS.map(([label]) => label)];
    for (const row of rows) {
        aoa.push(
            EXPORT_COLUMNS.map(([, field]) => {
                const value = row[field];
                return value === undefined || value === null ? '' : value;
            })
        );
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// A starter workbook: the expected header row plus one example row so users
// can see the format before filling it in.
function buildTemplateBuffer() {
    const aoa = [
        EXPORT_COLUMNS.map(([label]) => label),
        ['Jane', 'Doe', 'jane@grandhotel.com', 'Grand Hotel', 'Luxury Collection'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = EXPORT_COLUMNS.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function downloadTemplate(req, res, next) {
    try {
        const buffer = buildTemplateBuffer();
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="contacts-template.xlsx"'
        );
        return res.send(buffer);
    } catch (err) {
        return next(err);
    }
}

async function createContact(req, res, next) {
    try {
        const { first_name, last_name, email, hotel_name, portfolio } =
            req.body || {};
        const contact = await contactService.createContact({
            userId: req.userId,
            first_name,
            last_name,
            email,
            hotel_name,
            portfolio,
        });
        return res.status(201).json(contact);
    } catch (err) {
        return next(err);
    }
}

async function queryContacts(req, res, next) {
    try {
        const body = req.body || {};
        const result = await contactService.queryContacts({
            filters: body.filters || {},
            sort: Array.isArray(body.sort) ? body.sort : [],
            search: body.search,
            limit: body.limit != null ? Number(body.limit) : undefined,
            skip: body.skip != null ? Number(body.skip) : undefined,
        });
        return res.json(result);
    } catch (err) {
        return next(err);
    }
}

async function distinct(req, res, next) {
    try {
        const { field } = req.params;
        const { search, limit } = req.query;
        const result = await contactService.distinctValues({
            field,
            search,
            limit: limit ? Number(limit) : undefined,
        });
        return res.json(result);
    } catch (err) {
        return next(err);
    }
}

async function exportContacts(req, res, next) {
    try {
        const body = req.body || {};
        let rows;
        if (Array.isArray(body.ids) && body.ids.length > 0) {
            rows = await contactService.getByIds({ ids: body.ids });
        } else {
            rows = await contactService.queryAll({
                filters: body.filters || {},
                sort: Array.isArray(body.sort) ? body.sort : [],
                search: body.search,
            });
        }

        const buffer = buildExportBuffer(rows);
        const filename = `contacts-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(buffer);
    } catch (err) {
        return next(err);
    }
}

async function bulkUpload(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        let rows;
        try {
            const wb = XLSX.read(req.file.buffer, { type: 'buffer', raw: false });
            const sheetName = wb.SheetNames[0];
            if (!sheetName) throw new Error('Workbook has no sheets');
            rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        } catch (e) {
            return res
                .status(400)
                .json({ error: 'Could not read this file as a spreadsheet.' });
        }

        const result = await contactService.bulkCreate({
            userId: req.userId,
            rows,
        });
        return res.status(201).json(result);
    } catch (err) {
        return next(err);
    }
}

async function deleteContact(req, res, next) {
    try {
        const result = await contactService.deleteContact({ id: req.params.id });
        return res.json(result);
    } catch (err) {
        return next(err);
    }
}

async function bulkDelete(req, res, next) {
    try {
        const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
        const result = await contactService.deleteMany({ ids });
        return res.json(result);
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    createContact,
    queryContacts,
    distinct,
    exportContacts,
    bulkUpload,
    downloadTemplate,
    deleteContact,
    bulkDelete,
};
