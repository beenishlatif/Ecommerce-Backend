import mongoose from 'mongoose';

// A single settings document keyed by `key` — e.g. "homepage" holds
// site-wide homepage content like the hero image. Add more keys later
// (e.g. "footer", "announcement") without changing the schema.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    heroImage: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);