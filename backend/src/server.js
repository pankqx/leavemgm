const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  const server = app.listen(config.port, () => {
    console.log(`Leave Management API listening on port ${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
