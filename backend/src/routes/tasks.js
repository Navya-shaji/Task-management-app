const express = require('express');
const { body, query, param } = require('express-validator');
const pool = require('../db/pool');
const validate = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { broadcastToUser, broadcastToAll } = require('../ws/broadcaster');

const router = express.Router();

// All task routes require authentication
router.use(authenticate);

// Helper: log activity
async function logActivity(client, taskId, userId, action, fieldName = null, oldValue = null, newValue = null) {
  await client.query(
    `INSERT INTO activity_logs (task_id, user_id, action, field_name, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [taskId, userId, action, fieldName, oldValue ? String(oldValue) : null, newValue ? String(newValue) : null]
  );
}

// POST /tasks
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 500 }),
    body('description').optional().trim().isLength({ max: 5000 }),
    body('status')
      .optional()
      .isIn(['todo', 'in_progress', 'done'])
      .withMessage('Status must be todo, in_progress, or done'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('Priority must be low, medium, or high'),
    body('due_date').optional().isISO8601().withMessage('due_date must be a valid ISO 8601 date'),
  ],
  validate,
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { title, description, status = 'todo', priority = 'medium', due_date } = req.body;

      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO tasks (user_id, title, description, status, priority, due_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.user.id, title, description || null, status, priority, due_date || null]
      );

      const task = result.rows[0];
      await logActivity(client, task.id, req.user.id, 'created');
      await client.query('COMMIT');

      broadcastToUser(req.user.id, { type: 'TASK_CREATED', task });

      res.status(201).json({ task });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// GET /tasks
router.get(
  '/',
  [
    query('status').optional().isIn(['todo', 'in_progress', 'done']),
    query('priority').optional().isIn(['low', 'medium', 'high']),
    query('search').optional().trim().isLength({ max: 255 }),
    query('sort_by').optional().isIn(['due_date', 'priority', 'created_at', 'title']),
    query('sort_order').optional().isIn(['asc', 'desc']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        status,
        priority,
        search,
        sort_by = 'created_at',
        sort_order = 'desc',
        page = 1,
        limit = 10,
      } = req.query;

      // Admin can optionally view all tasks
      const isAdmin = req.user.role === 'admin' && req.query.admin === 'true';

      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (!isAdmin) {
        conditions.push(`t.user_id = $${paramIndex++}`);
        params.push(req.user.id);
      }

      if (status) {
        conditions.push(`t.status = $${paramIndex++}`);
        params.push(status);
      }

      if (priority) {
        conditions.push(`t.priority = $${paramIndex++}`);
        params.push(priority);
      }

      if (search) {
        conditions.push(`t.title ILIKE $${paramIndex++}`);
        params.push(`%${search}%`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Priority sort order
      const priorityOrder = `CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`;
      const sortColumn =
        sort_by === 'priority'
          ? priorityOrder
          : `t.${sort_by}`;

      const orderClause = `ORDER BY ${sortColumn} ${sort_order.toUpperCase()} NULLS LAST`;

      const offset = (page - 1) * limit;

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM tasks t ${where}`,
        params
      );

      const tasksResult = await pool.query(
        `SELECT t.*, u.name as user_name, u.email as user_email,
          (SELECT COUNT(*) FROM task_attachments ta WHERE ta.task_id = t.id) as attachment_count
         FROM tasks t
         LEFT JOIN users u ON t.user_id = u.id
         ${where}
         ${orderClause}
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      );

      const total = parseInt(countResult.rows[0].count, 10);

      res.json({
        tasks: tasksResult.rows,
        pagination: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /tasks/:id
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid task ID')],
  validate,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT t.*, u.name as user_name, u.email as user_email FROM tasks t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Task not found' });
      }

      const task = result.rows[0];

      if (task.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      }

      // Fetch attachments
      const attachments = await pool.query(
        'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at DESC',
        [task.id]
      );

      // Fetch activity log
      const logs = await pool.query(
        `SELECT al.*, u.name as user_name FROM activity_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.task_id = $1 ORDER BY al.created_at DESC LIMIT 50`,
        [task.id]
      );

      res.json({ task, attachments: attachments.rows, activity: logs.rows });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /tasks/:id
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid task ID'),
    body('title').optional().trim().notEmpty().isLength({ max: 500 }),
    body('description').optional().trim().isLength({ max: 5000 }),
    body('status').optional().isIn(['todo', 'in_progress', 'done']),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('due_date')
      .optional({ nullable: true })
      .custom((val) => {
        if (val === '' || val === null || val === undefined) return true;
        if (!/^\d{4}-\d{2}-\d{2}/.test(val)) throw new Error('Invalid date format');
        return true;
      }),
  ],
  validate,
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Task not found' });
      }

      const task = existing.rows[0];
      if (task.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      }

      const allowed = ['title', 'description', 'status', 'priority', 'due_date'];
      const updates = [];
      const values = [];
      let idx = 1;

      await client.query('BEGIN');

      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          // Treat empty string due_date as null
          const value = field === 'due_date' && req.body[field] === '' ? null : req.body[field];
          updates.push(`${field} = $${idx++}`);
          values.push(value);

          if (task[field] !== value) {
            await logActivity(
              client, task.id, req.user.id, 'updated',
              field, task[field], value
            );
          }
        }
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'Validation Error', message: 'No fields to update' });
      }

      values.push(req.params.id);
      const result = await client.query(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      await client.query('COMMIT');

      const updatedTask = result.rows[0];
      broadcastToUser(req.user.id, { type: 'TASK_UPDATED', task: updatedTask });

      res.json({ task: updatedTask });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// DELETE /tasks/:id
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid task ID')],
  validate,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT * FROM tasks WHERE id = $1',
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Task not found' });
      }

      const task = result.rows[0];
      if (task.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      }

      await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);

      broadcastToUser(req.user.id, { type: 'TASK_DELETED', taskId: req.params.id });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// GET /tasks/:id/activity
router.get(
  '/:id/activity',
  [param('id').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
      if (task.rows.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Task not found' });
      }
      if (task.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      }

      const logs = await pool.query(
        `SELECT al.*, u.name as user_name FROM activity_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.task_id = $1 ORDER BY al.created_at DESC`,
        [req.params.id]
      );

      res.json({ activity: logs.rows });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
