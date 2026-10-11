require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const jwtSecret = process.env.JWT_SECRET || (NODE_ENV === 'test' ? 'test-secret' : undefined);
if (!jwtSecret) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}
if (NODE_ENV === 'production' && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

module.exports = {
  nodeEnv: NODE_ENV,
  port: Number(process.env.PORT) || 3000,
  mongoUri: NODE_ENV === 'test' ? process.env.MONGODB_URI || '' : required('MONGODB_URI'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
