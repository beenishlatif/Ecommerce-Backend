// Vercel serverless entrypoint. Vercel auto-detects any file under /api as a
// serverless function — this one wraps the whole Express app, so every
// /api/* route is handled by the same app.js used for local dev.
//
// CRASH SAFETY: this handler never lets a startup, config, or DB-connection
// error escape unhandled. validateEnv() and configureDNS() run once per cold
// start below — if either throws (e.g. a missing env var), or if
// connectDB() fails (bad URI, network issue, IP not whitelisted, etc.), the
// function still returns a clean JSON 500 instead of a raw platform crash
// page. CORS headers are set manually in that case since a failure here
// means we never reach app.js's own cors() middleware.
import { configureDNS } from '../config/dns.js';
import { validateEnv } from '../config/env.js';
import app from '../app.js';
import { connectDB } from '../config/db.js';

let configError = null;
try {
  validateEnv();
  configureDNS();
} catch (err) {
  // Logged once per cold start — visible in Vercel's function logs — but
  // never thrown further, so module load always succeeds.
  configError = err;
  console.error('❌ Startup configuration error:', err.message);
}

function sendFailureResponse(req, res, err, message) {
  console.error('❌ Serverless handler error:', err?.message || err);

  const rawClientUrl = process.env.CLIENT_URL || '';
  const allowedOrigins = rawClientUrl.split(',').map((o) => o.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  return res.status(500).json({ success: false, message });
}

export default async function handler(req, res) {
  if (configError) {
    return sendFailureResponse(
      req,
      res,
      configError,
      'Server is misconfigured (missing environment variables). Check your Vercel project ' +
        'settings → Environment Variables, then redeploy.'
    );
  }

  try {
    await connectDB();
  } catch (err) {
    return sendFailureResponse(
      req,
      res,
      err,
      'Server is temporarily unavailable (database connection failed). Please try again shortly.'
    );
  }

  try {
    if (req.query?.path && !req.url.startsWith('/api')) {
      const rawPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
      req.url = `/api/${rawPath}`;
    }

    return app(req, res);
  } catch (err) {
    return sendFailureResponse(req, res, err, 'Something went wrong on the server. Please try again shortly.');
  }
}