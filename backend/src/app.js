const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

// Behind a load balancer / reverse proxy (Nginx, ALB, Elastic Beanstalk) the real client IP
// arrives in X-Forwarded-For; this keeps the rate limiter honest.
if (config.nodeEnv === 'production') app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / non-browser clients (no Origin header) and the configured Angular origins.
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: '10kb' }));
if (config.nodeEnv !== 'test') app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// Health check: used by AWS load balancers / Elastic Beanstalk to know the app is alive.
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/leaves', require('./routes/leaves'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
