const mongoose = require('mongoose');

const LEAVE_TYPES = ['Sick', 'Casual', 'Earned', 'Unpaid'];
const LEAVE_STATUSES = ['pending', 'approved', 'rejected'];

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeName: { type: String, required: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: String, required: true }, // ISO date, YYYY-MM-DD
    endDate: { type: String, required: true }, // ISO date, YYYY-MM-DD
    days: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: LEAVE_STATUSES, default: 'pending', index: true },
    managerComment: { type: String, trim: true, maxlength: 500 },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedOn: { type: Date },
  },
  { timestamps: true }
);

// Shape matches the Angular `LeaveRequest` interface.
leaveRequestSchema.set('toJSON', {
  transform(_doc, ret) {
    const out = {
      id: String(ret._id),
      employeeId: String(ret.employee),
      employeeName: ret.employeeName,
      type: ret.type,
      startDate: ret.startDate,
      endDate: ret.endDate,
      days: ret.days,
      reason: ret.reason,
      status: ret.status,
      appliedOn: new Date(ret.createdAt).toISOString().slice(0, 10),
    };
    if (ret.managerComment) out.managerComment = ret.managerComment;
    return out;
  },
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
module.exports.LEAVE_TYPES = LEAVE_TYPES;
module.exports.LEAVE_STATUSES = LEAVE_STATUSES;
