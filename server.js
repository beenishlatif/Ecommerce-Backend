// Local / traditional-hosting entrypoint (Railway, Render, a VPS, your own
// machine, etc). Starts a real long-running HTTP server with Socket.IO.
// For Vercel serverless, see api/index.js instead — Vercel functions don't
// support persistent connections, so Socket.IO only runs here.
import http from 'http';

import { configureDNS } from './config/dns.js';
import { env, validateEnv } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocket } from './services/socketService.js';
import app from './app.js';

// Fail fast and loud at boot if required env vars are missing — this is a
// long-running process, so exiting here (once, before accepting any
// traffic) is the correct behavior, unlike inside a serverless function.
try {
  validateEnv();
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

configureDNS();

const httpServer = http.createServer(app);
initSocket(httpServer);

async function start() {
  try {
    await connectDB();
    httpServer.listen(env.port, () => {
      console.log(`🚀 Server running in ${env.nodeEnv} mode on port ${env.port}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to the database at startup:', err.message);
    process.exit(1);
  }
}

start();

// --- Process-level safety nets so unexpected errors never crash silently ---
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err?.message || err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  // The process may be in an inconsistent state after a truly uncaught
  // exception — exit and let your process manager (pm2, systemd, Docker,
  // Railway/Render's restart policy, etc.) restart it cleanly.
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server gracefully...');
  httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Closing server gracefully...');
  httpServer.close(() => process.exit(0));
});
