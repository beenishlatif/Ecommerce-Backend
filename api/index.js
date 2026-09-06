import app from '../app.js';
import { connectDB } from '../config/db.js';

export default async function handler(req, res) {
  await connectDB();

  if (req.query?.path && !req.url.startsWith('/api')) {
    const rawPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    req.url = `/api/${rawPath}`;
  }

  return app(req, res);
}