const express = require('express');
const multer = require('multer');

const templateController = require('../controllers/templateController');
const { requireAuth } = require('../middleware/authMiddleware');

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES },
});

const router = express.Router();

router.post('/', requireAuth, templateController.createTemplate);
router.post('/query', requireAuth, templateController.queryTemplates);
router.post(
    '/upload',
    requireAuth,
    upload.single('file'),
    templateController.uploadTemplate
);
router.get('/:id', requireAuth, templateController.getTemplate);
router.put('/:id', requireAuth, templateController.updateTemplate);
router.delete('/:id', requireAuth, templateController.deleteTemplate);

module.exports = router;
