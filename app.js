// The Express app itself — no app.listen() here. This file is imported by
// both server.js (local/traditional hosting) and api/index.js (Vercel
// serverless), so the same app runs identically in either environment.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import userRoutes from './routes/userRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

// --- Security & core middleware ---
app.use(helmet());
app.use(
  cors({
    // Comma-separated CLIENT_URL supports both a Vercel preview URL and a
    // production domain at once, e.g. "https://myapp.vercel.app,https://mystore.com"
    origin: env.clientUrl.split(',').map((u) => u.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (env.nodeEnv !== 'production') app.use(morgan('dev'));

// Ensures a MongoDB connection exists before any route runs. connectDB()
// caches its connection/promise (see config/db.js), so on a normal
// long-running server this resolves instantly after the first call made in
// server.js at startup; on Vercel serverless it lazily connects on each
// cold start and is a no-op on subsequent warm requests.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database connection failed. Please try again shortly.' });
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin', adminRoutes);

// --- 404 + centralized error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

export default app;
