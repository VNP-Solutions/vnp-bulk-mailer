const templateService = require('../services/templateService');

function stripExtension(filename) {
    return String(filename || '').replace(/\.[^.]+$/, '');
}

// Upload an .html file → parse [[field]] tokens → store as a template.
// The name comes from the `name` form field, falling back to the filename.
async function uploadTemplate(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const html = req.file.buffer.toString('utf8');
        const name =
            (req.body && req.body.name && String(req.body.name).trim()) ||
            stripExtension(req.file.originalname);

        const template = await templateService.createTemplate({
            userId: req.userId,
            name,
            html,
            source_name: req.file.originalname,
        });
        return res.status(201).json(template);
    } catch (err) {
        return next(err);
    }
}

// Create from pasted/raw HTML (JSON body), as opposed to a file upload.
async function createTemplate(req, res, next) {
    try {
        const { name, html } = req.body || {};
        const template = await templateService.createTemplate({
            userId: req.userId,
            name,
            html,
        });
        return res.status(201).json(template);
    } catch (err) {
        return next(err);
    }
}

async function queryTemplates(req, res, next) {
    try {
        const body = req.body || {};
        const result = await templateService.queryTemplates({
            search: body.search,
            sort: Array.isArray(body.sort) ? body.sort : [],
            limit: body.limit != null ? Number(body.limit) : undefined,
            skip: body.skip != null ? Number(body.skip) : undefined,
        });
        return res.json(result);
    } catch (err) {
        return next(err);
    }
}

async function getTemplate(req, res, next) {
    try {
        const template = await templateService.getById({ id: req.params.id });
        return res.json(template);
    } catch (err) {
        return next(err);
    }
}

async function updateTemplate(req, res, next) {
    try {
        const { name, html } = req.body || {};
        const template = await templateService.updateTemplate({
            id: req.params.id,
            name,
            html,
        });
        return res.json(template);
    } catch (err) {
        return next(err);
    }
}

async function deleteTemplate(req, res, next) {
    try {
        const result = await templateService.deleteTemplate({ id: req.params.id });
        return res.json(result);
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    createTemplate,
    uploadTemplate,
    queryTemplates,
    getTemplate,
    updateTemplate,
    deleteTemplate,
};
