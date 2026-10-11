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
    // Listed origins get CORS headers. Anything else simply gets none, so browsers block
    // cross-site reads, while same-origin requests (which also carry an Origin header on
    // POST/PATCH) and non-browser clients keep working.
    origin(origin, cb) {
      cb(null, Boolean(origin) && config.corsOrigins.includes(origin));
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
