const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { param } = require('express-validator');
const pool = require('../db/pool');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const uploadDir = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10) },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|csv|xlsx/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

// POST /tasks/:id/attachments
router.post(
  '/:id/attachments',
  [param('id').isUUID()],
  validate,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Bad Request', message: 'No file uploaded' });
      }

      const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
      if (task.rows.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Not Found', message: 'Task not found' });
      }
      if (task.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;

      const result = await pool.query(
        `INSERT INTO task_attachments (task_id, user_id, filename, original_name, mime_type, size, url)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          req.params.id,
          req.user.id,
          req.file.filename,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          fileUrl,
        ]
      );

      res.status(201).json({ attachment: result.rows[0] });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(err);
    }
  }
);

// DELETE /tasks/:id/attachments/:attachmentId
router.delete('/:id/attachments/:attachmentId', async (req, res, next) => {
  try {
    const att = await pool.query(
      'SELECT * FROM task_attachments WHERE id = $1 AND task_id = $2',
      [req.params.attachmentId, req.params.id]
    );

    if (att.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Attachment not found' });
    }

    if (att.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    const filePath = path.join(uploadDir, att.rows[0].filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query('DELETE FROM task_attachments WHERE id = $1', [req.params.attachmentId]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
