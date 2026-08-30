import fs from 'fs';
import path from 'path';
import { isCloudinaryConfigured } from '../middleware/uploadMiddleware.js';

function fileToUrl(req, file) {
  // Cloudinary storage sets file.path to the final hosted (secure) URL directly.
  if (isCloudinaryConfigured()) return file.path;
  // Local-disk fallback (dev / traditional hosting only) — build the URL
  // from the request itself, served via express.static in app.js.
  return `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
}

// @desc    Upload a single image
// @route   POST /api/upload
export const uploadSingleImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }
  res.status(201).json({ success: true, data: { url: fileToUrl(req, req.file) } });
};

// @desc    Upload up to 6 images at once
// @route   POST /api/upload/multiple
export const uploadMultipleImages = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No image files provided' });
  }
  const urls = req.files.map((file) => fileToUrl(req, file));
  res.status(201).json({ success: true, data: { urls } });
};

// @desc    List all previously uploaded images (for the admin gallery picker)
// @route   GET /api/upload/gallery
export const listGalleryImages = async (req, res) => {
  if (isCloudinaryConfigured()) {
    try {
      const cloudinary = (await import('../config/cloudinary.js')).default;
      const result = await cloudinary.search
        .expression('folder:lumiere-ecommerce')
        .sort_by('created_at', 'desc')
        .max_results(100)
        .execute();
      const images = result.resources.map((r) => r.secure_url);
      return res.status(200).json({ success: true, data: images });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Could not load gallery from Cloudinary' });
    }
  }

  // Local-disk fallback (dev / traditional hosting only)
  const uploadDir = path.resolve('uploads');
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      // No uploads yet is not an error — just an empty gallery.
      if (err.code === 'ENOENT') return res.status(200).json({ success: true, data: [] });
      return res.status(500).json({ success: false, message: 'Could not read uploads folder' });
    }
    const images = files
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .map((f) => `${req.protocol}://${req.get('host')}/uploads/${f}`)
      .reverse(); // newest first — filenames are timestamp-prefixed
    res.status(200).json({ success: true, data: images });
  });
};