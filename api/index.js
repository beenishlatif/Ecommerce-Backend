// Vercel serverless entrypoint. Vercel auto-detects any file under /api as a
// serverless function — this one wraps the whole Express app, so every
// /api/* route is handled by the same app.js used for local dev.
//
// CRASH SAFETY: this handler never lets a startup or DB-connection error
// escape unhandled — if connectDB() fails (bad URI, network issue, IP not
// whitelisted, etc.) the function still returns a clean JSON 500 instead of
// a raw platform crash page. CORS headers are set manually in that case
// since a failure here means we never reach app.js's own cors() middleware.
import app from '../app.js';
import { connectDB } from '../config/db.js';

function sendFailureResponse(req, res, err) {
  console.error('❌ Serverless handler error:', err?.message || err);

  const rawClientUrl = process.env.CLIENT_URL || '';
  const allowedOrigins = rawClientUrl.split(',').map((o) => o.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  return res.status(500).json({
    success: false,
    message: 'Server is temporarily unavailable (database connection or server startup failed). Please try again shortly.',
  });
}

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    return sendFailureResponse(req, res, err);
  }

  try {
    if (req.query?.path && !req.url.startsWith('/api')) {
      const rawPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
      req.url = `/api/${rawPath}`;
    }

    return app(req, res);
  } catch (err) {
    return sendFailureResponse(req, res, err);
  }
}