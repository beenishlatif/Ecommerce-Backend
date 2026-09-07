// Vercel serverless entrypoint. Vercel auto-detects any file under /api as a
// serverless function — this one wraps the whole Express app, so every
// /api/* route is handled by the same app.js used for local dev.
//
// CRASH SAFETY: this handler never lets a startup, config, or DB-connection
// error escape unhandled. validateEnv() and configureDNS() run once per cold
// start below — if either throws (e.g. a missing env var), or if
// connectDB() fails (bad URI, network issue, IP not whitelisted, etc.), the
// function still returns a clean JSON 500 instead of a raw platform crash
// page.
//
// CORS ON FAILURE PATHS: these failure responses bypass app.js entirely, so
// they never go through its cors() middleware. Rather than re-implementing
// the same strict origin allow-list here (and risking a silent mismatch —
// trailing slash, missing domain, etc. — that hides the real error behind a
// confusing "CORS blocked" browser message), we simply reflect back
// whatever Origin the browser sent. The response body is never
// sensitive (just a generic "server misconfigured/unavailable" message), so
// this is safe and guarantees the real error is always visible to the
// frontend instead of being masked by a CORS failure.
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

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

function sendFailureResponse(req, res, err, message) {
  console.error('❌ Serverless handler error:', err?.message || err);
  setCorsHeaders(req, res);
  return res.status(500).json({ success: false, message });
}

export default async function handler(req, res) {
  // Answer preflight requests immediately, even on the failure paths below —
  // otherwise a misconfigured/crashing server never gets far enough to
  // respond to the OPTIONS request at all, and the browser reports a
  // confusing CORS error instead of the real 500.
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

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