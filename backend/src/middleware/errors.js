const config = require('../config');

function notFound(_req, res) {
  res.status(404).json({ message: 'Route not found.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid id.' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'That value is already in use.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body.' });
  }

  console.error(err);
  res.status(500).json({
    message: 'Something went wrong on our side.',
    ...(config.nodeEnv === 'development' && { detail: err.message }),
  });
}

module.exports = { notFound, errorHandler };
