import mongoose from 'mongoose';
import { env } from './env.js';

// Cached across invocations so Vercel serverless functions reuse the same
// connection instead of opening a new one on every request (which quickly
// exhausts MongoDB Atlas's connection limit). Also works fine for a normal
// long-running server — it just connects once and reuses that forever.
let cached = global._mongooseConn;
if (!cached) cached = global._mongooseConn = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(env.mongoUri, {
        serverSelectionTimeoutMS: 10000, // fail fast instead of hanging forever
        connectTimeoutMS: 10000,
        socketTimeoutMS: 20000,
        maxPoolSize: 10,
        family: 4, // prefer IPv4 — sidesteps some DNS/IPv6 resolution failures
      })
      .then((m) => {
        console.log(`✅ MongoDB connected: ${m.connection.host}`);

        // Registered once, on the connection that actually succeeded.
        m.connection.on('error', (err) => {
          console.error('❌ MongoDB connection error:', err.message);
        });
        m.connection.on('disconnected', () => {
          console.warn('⚠️  MongoDB disconnected.');
          // Drop the cache so the next request attempts a fresh connection
          // instead of being stuck reusing a dead one.
          cached.conn = null;
          cached.promise = null;
        });

        return m;
      })
      .catch((err) => {
        // Reset the cached promise so the NEXT call retries instead of
        // permanently reusing a rejected promise (which would make every
        // future request fail even after the underlying issue is fixed).
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
