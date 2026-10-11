/**
 * Seeds demo data for development, demos and the academic viva.
 *   npm run seed
 *
 * Re-running it resets the demo accounts and their leave requests. It never touches
 * accounts that were created through the sign-up form.
 */
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('./config');
const User = require('./models/User');
const LeaveRequest = require('./models/LeaveRequest');

const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'Leaflet@123';

const DEMO_USERS = [
  { name: 'Devika Menon', email: 'manager@leaflet.dev', role: 'manager', leaveBalance: 18 },
  { name: 'Asha Rao', email: 'employee@leaflet.dev', role: 'employee', leaveBalance: 12 },
  { name: 'Rohan Shetty', email: 'rohan@leaflet.dev', role: 'employee', leaveBalance: 12 },
];

function daysFromToday(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  await mongoose.connect(config.mongoUri);

  const emails = DEMO_USERS.map((u) => u.email);
  const existing = await User.find({ email: { $in: emails } }).select('_id');
  await LeaveRequest.deleteMany({ employee: { $in: existing.map((u) => u._id) } });
  await User.deleteMany({ email: { $in: emails } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [manager, asha, rohan] = await User.create(DEMO_USERS.map((u) => ({ ...u, passwordHash })));

  await LeaveRequest.create([
    {
      employee: asha._id,
      employeeName: asha.name,
      type: 'Casual',
      startDate: daysFromToday(-30),
      endDate: daysFromToday(-30),
      days: 1,
      reason: 'Family function',
      status: 'approved',
      managerComment: 'Enjoy the day off.',
      decidedBy: manager._id,
      decidedOn: new Date(),
    },
    {
      employee: asha._id,
      employeeName: asha.name,
      type: 'Earned',
      startDate: daysFromToday(10),
      endDate: daysFromToday(12),
      days: 3,
      reason: 'Travelling for a wedding',
    },
    {
      employee: rohan._id,
      employeeName: rohan.name,
      type: 'Sick',
      startDate: daysFromToday(1),
      endDate: daysFromToday(2),
      days: 2,
      reason: 'Fever, resting at home',
    },
  ]);

  console.log('Seeded demo data.');
  console.log(`  Manager : manager@leaflet.dev  / ${DEMO_PASSWORD}`);
  console.log(`  Employee: employee@leaflet.dev / ${DEMO_PASSWORD}`);
  console.log(`  Employee: rohan@leaflet.dev    / ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
