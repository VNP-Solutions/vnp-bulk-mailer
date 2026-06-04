const express = require('express');
const multer = require('multer');

const contactController = require('../controllers/contactController');
const { requireAuth } = require('../middleware/authMiddleware');

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES },
});

const router = express.Router();

router.post('/', requireAuth, contactController.createContact);
router.post('/query', requireAuth, contactController.queryContacts);
router.get('/template', requireAuth, contactController.downloadTemplate);
router.get('/distinct/:field', requireAuth, contactController.distinct);
router.post('/export', requireAuth, contactController.exportContacts);
router.post(
    '/bulk',
    requireAuth,
    upload.single('file'),
    contactController.bulkUpload
);
router.post('/bulk-delete', requireAuth, contactController.bulkDelete);
router.delete('/:id', requireAuth, contactController.deleteContact);

module.exports = router;
