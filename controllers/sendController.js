const sendService = require('../services/sendService');

async function createJob(req, res, next) {
    try {
        const body = req.body || {};
        const job = await sendService.createJob({
            userId: req.userId,
            template_id: body.template_id,
            subject: body.subject,
            mode: body.mode,
            contact_ids: Array.isArray(body.contact_ids) ? body.contact_ids : [],
            filters: body.filters || {},
            search: body.search,
        });
        return res.status(201).json(job);
    } catch (err) {
        return next(err);
    }
}

async function listJobs(req, res, next) {
    try {
        const body = req.body || {};
        const result = await sendService.listJobs({
            limit: body.limit != null ? Number(body.limit) : undefined,
            skip: body.skip != null ? Number(body.skip) : undefined,
        });
        return res.json(result);
    } catch (err) {
        return next(err);
    }
}

async function getJob(req, res, next) {
    try {
        const job = await sendService.getJob({ id: req.params.id });
        return res.json(job);
    } catch (err) {
        return next(err);
    }
}

async function queryHistory(req, res, next) {
    try {
        const body = req.body || {};
        const result = await sendService.queryHistory({
            filters: body.filters || {},
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

async function historyTemplates(req, res, next) {
    try {
        const names = await sendService.historyTemplates();
        return res.json({ templates: names });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    createJob,
    listJobs,
    getJob,
    queryHistory,
    historyTemplates,
};
