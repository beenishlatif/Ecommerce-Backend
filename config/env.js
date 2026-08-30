import dotenv from 'dotenv';
dotenv.config();

const required = ['MONGO_URI', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];

// Throws instead of exiting the process. On a traditional/long-running
// server (server.js) it's fine to exit on a thrown error at boot — but
// process.exit() inside a Vercel serverless function kills the whole
// function invocation and produces an ugly, un-catchable crash for every
// request on that instance. So this module never calls process.exit()
// itself; each entrypoint decides how to react.
export function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Copy server/.env.example to server/.env locally, or set these in your hosting ` +
        `provider's dashboard (e.g. Vercel → Project → Settings → Environment Variables).`
    );
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  // Comma-separated list supported so both a local and a deployed frontend
  // origin can be allowed at once, e.g. "http://localhost:5173,https://mystore.vercel.app"
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.COOKIE_NAME || 'token',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  adminName: process.env.ADMIN_NAME || 'Store Admin',
};
