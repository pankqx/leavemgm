process.env.NODE_ENV = 'test';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const User = require('../src/models/User');
const LeaveRequest = require('../src/models/LeaveRequest');

let mongod;

function isoOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function login(email, password = 'Password@123') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.token;
}

before(async () => {
  // Use your own throwaway database if TEST_MONGODB_URI is set (e.g. a local mongod:
  //   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/leavemgm_test npm test
  // Otherwise spin up an in-memory MongoDB (downloads a mongod binary on first run).
  // WARNING: every collection touched here is wiped before each test - never point this at real data.
  if (process.env.TEST_MONGODB_URI) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  } else {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }
});

after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), LeaveRequest.deleteMany({})]);
  const passwordHash = await bcrypt.hash('Password@123', 4);
  await User.create([
    { name: 'Boss', email: 'boss@test.dev', passwordHash, role: 'manager', leaveBalance: 18 },
    { name: 'Emp One', email: 'emp1@test.dev', passwordHash, role: 'employee', leaveBalance: 5 },
    { name: 'Emp Two', email: 'emp2@test.dev', passwordHash, role: 'employee', leaveBalance: 5 },
  ]);
});

test('health check responds', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('register creates an employee, ignores a client-supplied role, and never leaks the hash', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'New Person', email: 'New@Test.dev', password: 'longenough1', role: 'manager' });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'employee');
  assert.equal(res.body.user.email, 'new@test.dev');
  assert.ok(res.body.token);
  assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);

  const dup = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Again', email: 'new@test.dev', password: 'longenough1' });
  assert.equal(dup.status, 409);
});

test('login succeeds with the right password and fails otherwise', async () => {
  const ok = await request(app).post('/api/auth/login').send({ email: 'emp1@test.dev', password: 'Password@123' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.role, 'employee');
  assert.equal(ok.body.user.leaveBalance, 5);

  const bad = await request(app).post('/api/auth/login').send({ email: 'emp1@test.dev', password: 'nope' });
  assert.equal(bad.status, 401);
});

test('login rejects NoSQL operator injection', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: { $ne: '' }, password: { $ne: '' } });
  assert.equal(res.status, 400);
});

test('protected routes need a token', async () => {
  assert.equal((await request(app).get('/api/leaves/mine')).status, 401);
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
});

test('employee can apply, and the server sets owner, days and status', async () => {
  const token = await login('emp1@test.dev');
  const res = await request(app)
    .post('/api/leaves')
    .set('Authorization', `Bearer ${token}`)
    .send({
      type: 'Casual',
      startDate: isoOffset(5),
      endDate: isoOffset(7),
      reason: 'Family trip',
      status: 'approved', // must be ignored
      days: 99, // must be ignored
      employeeName: 'Hacker', // must be ignored
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.status, 'pending');
  assert.equal(res.body.days, 3);
  assert.equal(res.body.employeeName, 'Emp One');

  const mine = await request(app).get('/api/leaves/mine').set('Authorization', `Bearer ${token}`);
  assert.equal(mine.body.length, 1);
});

test('validation: bad dates, reversed range, past non-sick, too many days, short reason', async () => {
  const token = await login('emp1@test.dev');
  const post = (body) =>
    request(app).post('/api/leaves').set('Authorization', `Bearer ${token}`).send(body);

  assert.equal((await post({ type: 'Casual', startDate: '2026-02-30', endDate: '2026-03-01', reason: 'valid reason' })).status, 400);
  assert.equal((await post({ type: 'Casual', startDate: isoOffset(5), endDate: isoOffset(3), reason: 'valid reason' })).status, 400);
  assert.equal((await post({ type: 'Casual', startDate: isoOffset(-3), endDate: isoOffset(-2), reason: 'valid reason' })).status, 400);
  assert.equal((await post({ type: 'Unpaid', startDate: isoOffset(1), endDate: isoOffset(40), reason: 'valid reason' })).status, 400);
  assert.equal((await post({ type: 'Casual', startDate: isoOffset(1), endDate: isoOffset(1), reason: 'hi' })).status, 400);
  assert.equal((await post({ type: 'Holiday', startDate: isoOffset(1), endDate: isoOffset(1), reason: 'valid reason' })).status, 400);
  // Sick leave may be backdated
  assert.equal((await post({ type: 'Sick', startDate: isoOffset(-2), endDate: isoOffset(-1), reason: 'was unwell' })).status, 201);
});

test('paid leave beyond the balance is refused, unpaid is allowed', async () => {
  const token = await login('emp1@test.dev'); // balance 5
  const post = (body) =>
    request(app).post('/api/leaves').set('Authorization', `Bearer ${token}`).send(body);

  const tooMany = await post({ type: 'Earned', startDate: isoOffset(10), endDate: isoOffset(16), reason: 'long holiday' });
  assert.equal(tooMany.status, 400);
  const unpaid = await post({ type: 'Unpaid', startDate: isoOffset(10), endDate: isoOffset(16), reason: 'long holiday' });
  assert.equal(unpaid.status, 201);
});

test('overlapping pending/approved requests are refused', async () => {
  const token = await login('emp1@test.dev');
  const post = (body) =>
    request(app).post('/api/leaves').set('Authorization', `Bearer ${token}`).send(body);

  assert.equal((await post({ type: 'Casual', startDate: isoOffset(5), endDate: isoOffset(7), reason: 'first request' })).status, 201);
  const clash = await post({ type: 'Casual', startDate: isoOffset(7), endDate: isoOffset(9), reason: 'second request' });
  assert.equal(clash.status, 409);
});

test('employees cannot list everyone or decide requests', async () => {
  const token = await login('emp1@test.dev');
  assert.equal((await request(app).get('/api/leaves').set('Authorization', `Bearer ${token}`)).status, 403);

  const created = await request(app)
    .post('/api/leaves')
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'Casual', startDate: isoOffset(5), endDate: isoOffset(5), reason: 'errand to run' });
  const patch = await request(app)
    .patch(`/api/leaves/${created.body.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'approved' });
  assert.equal(patch.status, 403);
});

test('manager sees all requests, approves one, and the balance is deducted exactly once', async () => {
  const empToken = await login('emp1@test.dev');
  const mgrToken = await login('boss@test.dev');

  const created = await request(app)
    .post('/api/leaves')
    .set('Authorization', `Bearer ${empToken}`)
    .send({ type: 'Casual', startDate: isoOffset(5), endDate: isoOffset(7), reason: 'family wedding' });

  const all = await request(app).get('/api/leaves').set('Authorization', `Bearer ${mgrToken}`);
  assert.equal(all.status, 200);
  assert.equal(all.body.length, 1);

  const decided = await request(app)
    .patch(`/api/leaves/${created.body.id}`)
    .set('Authorization', `Bearer ${mgrToken}`)
    .send({ status: 'approved', managerComment: 'Enjoy' });
  assert.equal(decided.status, 200);
  assert.equal(decided.body.status, 'approved');
  assert.equal(decided.body.managerComment, 'Enjoy');

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${empToken}`);
  assert.equal(me.body.leaveBalance, 2); // 5 - 3

  const again = await request(app)
    .patch(`/api/leaves/${created.body.id}`)
    .set('Authorization', `Bearer ${mgrToken}`)
    .send({ status: 'rejected' });
  assert.equal(again.status, 409);
  const me2 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${empToken}`);
  assert.equal(me2.body.leaveBalance, 2);
});

test('rejecting or approving unpaid leave leaves the balance untouched', async () => {
  const empToken = await login('emp1@test.dev');
  const mgrToken = await login('boss@test.dev');

  const a = await request(app).post('/api/leaves').set('Authorization', `Bearer ${empToken}`)
    .send({ type: 'Unpaid', startDate: isoOffset(5), endDate: isoOffset(6), reason: 'personal work' });
  const b = await request(app).post('/api/leaves').set('Authorization', `Bearer ${empToken}`)
    .send({ type: 'Casual', startDate: isoOffset(20), endDate: isoOffset(21), reason: 'short break' });

  await request(app).patch(`/api/leaves/${a.body.id}`).set('Authorization', `Bearer ${mgrToken}`).send({ status: 'approved' });
  await request(app).patch(`/api/leaves/${b.body.id}`).set('Authorization', `Bearer ${mgrToken}`).send({ status: 'rejected' });

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${empToken}`);
  assert.equal(me.body.leaveBalance, 5);
});

test('a manager cannot decide their own request', async () => {
  const mgrToken = await login('boss@test.dev');
  const created = await request(app)
    .post('/api/leaves')
    .set('Authorization', `Bearer ${mgrToken}`)
    .send({ type: 'Casual', startDate: isoOffset(5), endDate: isoOffset(5), reason: 'my own errand' });
  const res = await request(app)
    .patch(`/api/leaves/${created.body.id}`)
    .set('Authorization', `Bearer ${mgrToken}`)
    .send({ status: 'approved' });
  assert.equal(res.status, 403);
});

test('approval is refused (and the request stays pending) if the balance can no longer cover it', async () => {
  const empToken = await login('emp1@test.dev');
  const mgrToken = await login('boss@test.dev');

  const created = await request(app).post('/api/leaves').set('Authorization', `Bearer ${empToken}`)
    .send({ type: 'Casual', startDate: isoOffset(5), endDate: isoOffset(9), reason: 'five day trip' });
  await User.updateOne({ email: 'emp1@test.dev' }, { leaveBalance: 1 });

  const res = await request(app).patch(`/api/leaves/${created.body.id}`)
    .set('Authorization', `Bearer ${mgrToken}`).send({ status: 'approved' });
  assert.equal(res.status, 409);

  const after = await LeaveRequest.findById(created.body.id);
  assert.equal(after.status, 'pending');
});

test('unknown routes return a JSON 404', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.ok(res.body.message);
});
