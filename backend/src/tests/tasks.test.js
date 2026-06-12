const request = require('supertest');
const { app, server } = require('../server');
const pool = require('../db/pool');

let authToken;
let userId;
let createdTaskId;
const userEmail = `tasktest_${Date.now()}@taskflow.com`;

beforeAll(async () => {
  const res = await request(app)
    .post('/auth/signup')
    .send({ name: 'Task Tester', email: userEmail, password: 'Test1234!' });
  authToken = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', [userEmail]);
  await pool.end();
  server.close();
});

describe('Tasks API', () => {
  describe('POST /tasks', () => {
    it('should create a task', async () => {
      const res = await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test Task', description: 'A test', priority: 'high', status: 'todo' });
      expect(res.status).toBe(201);
      expect(res.body.task.title).toBe('Test Task');
      expect(res.body.task.user_id).toBe(userId);
      createdTaskId = res.body.task.id;
    });

    it('should reject task without title', async () => {
      const res = await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'No title here' });
      expect(res.status).toBe(422);
    });

    it('should reject invalid status', async () => {
      const res = await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Bad status', status: 'invalid_status' });
      expect(res.status).toBe(422);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Unauthorized task' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /tasks', () => {
    it('should list tasks with pagination', async () => {
      const res = await request(app)
        .get('/tasks?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tasks');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.tasks)).toBe(true);
    });

    it('should filter tasks by status', async () => {
      const res = await request(app)
        .get('/tasks?status=todo')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      res.body.tasks.forEach((t) => expect(t.status).toBe('todo'));
    });

    it('should search tasks by title', async () => {
      const res = await request(app)
        .get('/tasks?search=Test Task')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBeGreaterThan(0);
    });
  });

  describe('GET /tasks/:id', () => {
    it('should fetch a single task', async () => {
      const res = await request(app)
        .get(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.task.id).toBe(createdTaskId);
      expect(res.body).toHaveProperty('attachments');
      expect(res.body).toHaveProperty('activity');
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app)
        .get('/tasks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('should update a task', async () => {
      const res = await request(app)
        .patch(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'in_progress', priority: 'low' });
      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('in_progress');
      expect(res.body.task.priority).toBe('low');
    });

    it('should reject invalid status update', async () => {
      const res = await request(app)
        .patch(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'flying' });
      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete a task', async () => {
      const res = await request(app)
        .delete(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 after deletion', async () => {
      const res = await request(app)
        .get(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });
  });
});
