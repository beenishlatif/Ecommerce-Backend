// Centralized Express error handler — the last line of defense so a thrown
// error in any controller never crashes the whole server process.
export function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err?.message || err);
  if (process.env.NODE_ENV !== 'production' && err?.stack) console.error(err.stack);

  // If a response has already started streaming, we can't send a fresh
  // JSON body — handing off to Express's default handler avoids a
  // "Cannot set headers after they are sent" crash.
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err?.message || 'Internal Server Error';

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `${field ? field : 'Field'} already exists`;
  }

  // Bad JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired, please log in again';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && err?.stack && { stack: err.stack }),
  });
}

export function notFound(req, res, next) {
  // Friendly response for the bare root URL instead of a confusing 404 —
  // this endpoint isn't a real API route, just a sanity-check landing spot.
  if (req.originalUrl === '/') {
    return res.status(200).json({
      success: true,
      message: 'Backend API is live. Try /api/health for a full status check.',
    });
  }

  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
}