import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, WEBP and AVIF images are allowed'), false);
  }
};

// Vercel sets this env var automatically on every deployment/invocation —
// used to pick a storage backend that actually works there.
const isServerless = Boolean(process.env.VERCEL);

let storage;

if (isCloudinaryConfigured()) {
  // Works everywhere (local, traditional hosting, AND Vercel serverless)
  // because files live in Cloudinary's cloud storage, not on local disk.
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'lumiere-ecommerce',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    },
  });
} else if (!isServerless) {
  // Local-disk fallback — only safe for local dev or a traditional
  // long-running host with a persistent filesystem (Railway, Render, a VPS).
  // NEVER used on Vercel: its filesystem is read-only outside /tmp, and
  // /tmp is wiped between invocations, so files would silently disappear.
  const uploadDir = path.resolve('uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${ext}`);
    },
  });
} else {
  // On Vercel with no Cloudinary configured: memory storage is a safe no-op
  // target so multer doesn't crash at import time. The route itself blocks
  // this combination with a clear error before any file reaches here — see
  // guardUploadCapability in routes/uploadRoutes.js.
  storage = multer.memoryStorage();
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

export { isCloudinaryConfigured };