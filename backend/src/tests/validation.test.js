const request = require('supertest');
const { app, server } = require('../server');
const pool = require('../db/pool');

afterAll(async () => {
  await pool.end();
  server.close();
});

describe('Input Validation', () => {
  describe('Signup validation', () => {
    it('should reject missing name', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@test.com', password: 'Test1234!' });
      expect(res.status).toBe(422);
      expect(res.body.details.some((d) => d.field === 'name')).toBe(true);
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ name: 'Test', password: 'Test1234!' });
      expect(res.status).toBe(422);
    });

    it('should return validation error structure', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({});
      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('error', 'Validation Error');
      expect(res.body).toHaveProperty('details');
      expect(Array.isArray(res.body.details)).toBe(true);
    });
  });

  describe('Health check', () => {
    it('GET /health should return 200', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('404 handler', () => {
    it('unknown routes should return 404', async () => {
      const res = await request(app).get('/this-route-does-not-exist');
      expect(res.status).toBe(404);
    });
  });
});
