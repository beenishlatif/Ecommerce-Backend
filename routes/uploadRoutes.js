import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import {
  uploadSingleImage,
  uploadMultipleImages,
  listGalleryImages,
} from '../controllers/uploadController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/gallery', protect, adminOnly, listGalleryImages);
router.post('/', protect, adminOnly, upload.single('image'), uploadSingleImage);
router.post('/multiple', protect, adminOnly, upload.array('images', 6), uploadMultipleImages);

export default router;