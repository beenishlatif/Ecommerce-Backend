// Run with: npm run seed:admin
// Creates the initial admin account from env vars. Safe to re-run — it's idempotent.
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/db.js';
import { validateEnv, env } from '../config/env.js';
import { configureDNS } from '../config/dns.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

async function run() {
  validateEnv();
  configureDNS();
  await connectDB();

  const existing = await User.findOne({ email: env.adminEmail.toLowerCase() });
  if (existing) {
    console.log('ℹ️  Admin account already exists, skipping seed.');
  } else {
    await User.create({
      name: env.adminName,
      email: env.adminEmail,
      password: env.adminPassword, // hashed automatically by the User model's pre-save hook
      role: 'admin',
    });
    console.log('✅ Initial admin account created.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Failed to seed admin:', err.message);
  process.exit(1);
});
