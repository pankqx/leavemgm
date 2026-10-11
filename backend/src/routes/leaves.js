const express = require('express');
const mongoose = require('mongoose');
const LeaveRequest = require('../models/LeaveRequest');
const { LEAVE_TYPES } = require('../models/LeaveRequest');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS_PER_REQUEST = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses YYYY-MM-DD as a UTC date; returns null if it is not a real calendar date. */
function parseIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/leaves/mine -> the signed-in user's own requests, newest first
router.get('/mine', async (req, res, next) => {
  try {
    const list = await LeaveRequest.find({ employee: req.user._id }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/leaves[?status=pending] -> every request (manager only), newest first
router.get('/', requireRole('manager'), async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.status === 'string') {
      if (!LeaveRequest.LEAVE_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ message: 'Unknown status filter.' });
      }
      filter.status = req.query.status;
    }
    const list = await LeaveRequest.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/leaves  { type, startDate, endDate, reason } -> LeaveRequest
// The employee and the number of days always come from the server, never the client.
router.post('/', async (req, res, next) => {
  try {
    const { type, startDate, endDate, reason } = req.body || {};

    if (!LEAVE_TYPES.includes(type)) {
      return res.status(400).json({ message: `Leave type must be one of: ${LEAVE_TYPES.join(', ')}.` });
    }
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (!start || !end) {
      return res.status(400).json({ message: 'Dates must be valid and formatted as YYYY-MM-DD.' });
    }
    if (end < start) {
      return res.status(400).json({ message: 'End date cannot be before the start date.' });
    }
    if (type !== 'Sick' && startDate < todayIso()) {
      return res.status(400).json({ message: 'Only sick leave can start in the past.' });
    }
    if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) {
      return res.status(400).json({ message: 'Please give a reason (5–500 characters).' });
    }

    const days = Math.round((end - start) / DAY_MS) + 1;
    if (days > MAX_DAYS_PER_REQUEST) {
      return res
        .status(400)
        .json({ message: `A single request can cover at most ${MAX_DAYS_PER_REQUEST} days.` });
    }

    if (type !== 'Unpaid' && days > req.user.leaveBalance) {
      return res.status(400).json({
        message: `You only have ${req.user.leaveBalance} paid leave day(s) left. Apply for unpaid leave instead.`,
      });
    }

    // ISO date strings compare correctly as plain strings.
    const overlap = await LeaveRequest.exists({
      employee: req.user._id,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });
    if (overlap) {
      return res
        .status(409)
        .json({ message: 'You already have a pending or approved request on those dates.' });
    }

    const created = await LeaveRequest.create({
      employee: req.user._id,
      employeeName: req.user.name,
      type,
      startDate,
      endDate,
      days,
      reason: reason.trim(),
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/leaves/:id  { status: 'approved' | 'rejected', managerComment? } -> LeaveRequest
router.patch('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid id.' });
    }
    const { status, managerComment } = req.body || {};
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'." });
    }
    if (managerComment !== undefined && (typeof managerComment !== 'string' || managerComment.length > 500)) {
      return res.status(400).json({ message: 'Comment must be text of at most 500 characters.' });
    }

    const existing = await LeaveRequest.findById(id);
    if (!existing) return res.status(404).json({ message: 'Leave request not found.' });
    if (String(existing.employee) === String(req.user._id)) {
      return res.status(403).json({ message: 'You cannot decide on your own leave request.' });
    }

    // Claim the request atomically so two managers can never decide it twice.
    const claimed = await LeaveRequest.findOneAndUpdate(
      { _id: id, status: 'pending' },
      {
        status,
        managerComment: managerComment?.trim() || undefined,
        decidedBy: req.user._id,
        decidedOn: new Date(),
      },
      { new: true }
    );
    if (!claimed) {
      return res.status(409).json({ message: 'This request has already been decided.' });
    }

    // Approving paid leave spends the employee's balance. The $gte guard makes it impossible
    // to go negative; if it fails we put the request back to pending.
    if (status === 'approved' && claimed.type !== 'Unpaid') {
      const charged = await User.findOneAndUpdate(
        { _id: claimed.employee, leaveBalance: { $gte: claimed.days } },
        { $inc: { leaveBalance: -claimed.days } }
      );
      if (!charged) {
        await LeaveRequest.updateOne(
          { _id: id },
          { $set: { status: 'pending' }, $unset: { managerComment: '', decidedBy: '', decidedOn: '' } }
        );
        return res
          .status(409)
          .json({ message: "The employee doesn't have enough paid leave balance for this request." });
      }
    }

    res.json(claimed);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
