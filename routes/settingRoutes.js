import express from 'express';
import { getHomepageSettings, updateHomepageSettings } from '../controllers/settingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public — Home page reads this on load
router.get('/homepage', getHomepageSettings);

// Admin only — updating the hero image
router.put('/homepage', protect, authorize('admin'), updateHomepageSettings);

export default router;