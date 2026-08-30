import express from 'express';
import { upload, isCloudinaryConfigured } from '../middleware/uploadMiddleware.js';
import {
  uploadSingleImage,
  uploadMultipleImages,
  listGalleryImages,
} from '../controllers/uploadController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// On Vercel (serverless) without Cloudinary configured, uploads can never
// persist — fail clearly and immediately instead of accepting a file that
// will silently vanish. Locally / on traditional hosting without Cloudinary,
// the local-disk fallback in uploadMiddleware.js is used instead, so this
// only blocks the one combination that can never work.
const guardUploadCapability = (req, res, next) => {
  if (!isCloudinaryConfigured() && process.env.VERCEL) {
    return res.status(503).json({
      success: false,
      message:
        'Image uploads are not configured for this deployment. Add CLOUDINARY_CLOUD_NAME, ' +
        'CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to your environment variables — local ' +
        'disk storage does not persist on Vercel.',
    });
  }
  next();
};

router.get('/gallery', protect, authorize('admin'), listGalleryImages);
router.post('/', protect, authorize('admin'), guardUploadCapability, upload.single('image'), uploadSingleImage);
router.post(
  '/multiple',
  protect,
  authorize('admin'),
  guardUploadCapability,
  upload.array('images', 6),
  uploadMultipleImages
);

export default router;