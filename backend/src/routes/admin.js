const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

// GET /admin/users — list all users
router.get('/users', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, avatar_url, created_at,
        (SELECT COUNT(*) FROM tasks WHERE user_id = users.id) as task_count
       FROM users ORDER BY created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /admin/tasks — list all tasks from all users
router.get('/tasks', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, priority, search } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
    if (priority) { conditions.push(`t.priority = $${idx++}`); params.push(priority); }
    if (search) { conditions.push(`t.title ILIKE $${idx++}`); params.push(`%${search}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const count = await pool.query(`SELECT COUNT(*) FROM tasks t ${where}`, params);
    const tasks = await pool.query(
      `SELECT t.*, u.name as user_name, u.email as user_email FROM tasks t
       LEFT JOIN users u ON t.user_id = u.id
       ${where} ORDER BY t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    res.json({
      tasks: tasks.rows,
      pagination: {
        total: parseInt(count.rows[0].count, 10),
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total_pages: Math.ceil(count.rows[0].count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/users/:id/role
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(422).json({ error: 'Validation Error', message: 'Invalid role' });
    }
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
      [role, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
