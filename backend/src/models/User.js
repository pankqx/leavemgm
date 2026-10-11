const mongoose = require('mongoose');

const ROLES = ['employee', 'manager'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'employee', required: true },
    // Remaining paid leave days. Reduced when a manager approves a paid leave.
    leaveBalance: { type: Number, default: 12, min: 0 },
  },
  { timestamps: true }
);

// Shape matches the Angular `User` interface: { id, name, email, role, leaveBalance }
userSchema.set('toJSON', {
  transform(_doc, ret) {
    return {
      id: String(ret._id),
      name: ret.name,
      email: ret.email,
      role: ret.role,
      leaveBalance: ret.leaveBalance,
    };
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
