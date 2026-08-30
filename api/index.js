// Vercel serverless entrypoint. Vercel auto-detects any file under /api as a
// serverless function — this one wraps the whole Express app, so every
// /api/* route is handled by the same app.js used for local dev. The DB
// connection itself is established lazily inside app.js's own middleware.
//
// CRASH SAFETY: this file never calls process.exit() and never lets a
// startup error escape unhandled — a config problem (e.g. a missing env
// var) always results in a clean JSON 500 response, never a dead function
// or a raw platform error page. That matters specifically on serverless:
// process.exit() inside a Lambda/Vercel function kills the whole invocation
// abruptly instead of just failing one request.
//
// IMPORTANT: Socket.IO real-time features (services/socketService.js) do NOT
// run here — Vercel's serverless functions are stateless/short-lived and
// can't hold open WebSocket connections. If you need real-time order/
// inventory updates in production, deploy server.js to a persistent host
// (Railway, Render, Fly.io, a VPS) instead of, or alongside, Vercel.
import { configureDNS } from '../config/dns.js';
import { validateEnv } from '../config/env.js';
import app from '../app.js';

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

export default function handler(req, res) {
  if (configError) {
    return res.status(500).json({
      success: false,
      message:
        'Server is misconfigured (missing environment variables). Check your Vercel project ' +
        'settings → Environment Variables, then redeploy.',
    });
  }
  return app(req, res);
}
