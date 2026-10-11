// Smoke tests that need NO database: they only exercise code paths that answer
// before any query runs (routing, auth gate, input validation, error format).
process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const config = require('../src/config');

test('health check responds', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('unknown routes return a JSON 404', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.ok(res.body.message);
});

test('protected routes reject missing, malformed and forged tokens', async () => {
  for (const path of ['/api/auth/me', '/api/leaves/mine', '/api/leaves']) {
    assert.equal((await request(app).get(path)).status, 401, path);
  }
  const malformed = await request(app).get('/api/leaves/mine').set('Authorization', 'Token abc');
  assert.equal(malformed.status, 401);

  const forged = jwt.sign({ sub: '64b7f0c2a1b2c3d4e5f60718', role: 'manager' }, 'not-the-real-secret');
  const res = await request(app).get('/api/leaves').set('Authorization', `Bearer ${forged}`);
  assert.equal(res.status, 401);
  assert.notEqual(forged, jwt.sign({ sub: 'x' }, config.jwtSecret));
});

test('login rejects missing fields and NoSQL operator injection', async () => {
  assert.equal((await request(app).post('/api/auth/login').send({})).status, 400);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: { $ne: '' }, password: { $ne: '' } });
  assert.equal(res.status, 400);
});

test('register validates name, email and password before touching the database', async () => {
  const post = (body) => request(app).post('/api/auth/register').send(body);
  assert.equal((await post({ name: 'A', email: 'a@b.co', password: 'longenough1' })).status, 400);
  assert.equal((await post({ name: 'Alice', email: 'not-an-email', password: 'longenough1' })).status, 400);
  assert.equal((await post({ name: 'Alice', email: 'a@b.co', password: 'short' })).status, 400);
});

test('malformed JSON bodies get a clean 400', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"email": ');
  assert.equal(res.status, 400);
});

test('security headers are set', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-powered-by'], undefined);
});
