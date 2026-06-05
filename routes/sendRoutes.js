const express = require('express');
const sendController = require('../controllers/sendController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Jobs
router.post('/jobs', requireAuth, sendController.createJob);
router.post('/jobs/query', requireAuth, sendController.listJobs);
router.get('/jobs/:id', requireAuth, sendController.getJob);

// History
router.post('/history/query', requireAuth, sendController.queryHistory);
router.get('/history/templates', requireAuth, sendController.historyTemplates);

// Rolling rate-limit budget (remaining capacity this hour / today)
router.get('/budget', requireAuth, sendController.budget);

module.exports = router;
