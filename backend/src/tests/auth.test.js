const request = require('supertest');
const { app, server } = require('../server');
const pool = require('../db/pool');

let testUser = { email: `test_${Date.now()}@taskflow.com`, password: 'Test1234!', name: 'Test User' };
let authToken;

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
  await pool.end();
  server.close();
});

describe('Auth API', () => {
  describe('POST /auth/signup', () => {
    it('should register a new user', async () => {
      const res = await request(app).post('/auth/signup').send(testUser);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user).not.toHaveProperty('password_hash');
      authToken = res.body.token;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app).post('/auth/signup').send(testUser);
      expect(res.status).toBe(409);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ ...testUser, email: 'other@test.com', password: '123' });
      expect(res.status).toBe(422);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ ...testUser, email: 'not-an-email' });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'nobody@test.com', password: 'Test1234!' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
