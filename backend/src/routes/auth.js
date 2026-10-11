const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const config = require('../config');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

// POST /api/auth/register  { name, email, password } -> { user, token }
// Public sign-up always creates an *employee*. Managers are created by the seed script
// (or directly in the database), never through the open API.
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      return res.status(400).json({ message: 'Please enter your name (2–80 characters).' });
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return res.status(400).json({ message: 'Password must be 8–72 characters long.' });
    }

    const normalised = email.trim().toLowerCase();
    if (await User.exists({ email: normalised })) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalised,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'employee',
    });

    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login  { email, password } -> { user, token }
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    // Reject non-strings so operators like {"$ne": ""} can never reach the query.
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    res.json({ user, token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me -> User (fresh from the DB, so the leave balance is current)
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
