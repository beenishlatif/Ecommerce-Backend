import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  previewSale,
  applySale,
  removeSale,
  getActiveSales,
  expireEndedSales,
} from '../controllers/saleController.js';

const router = express.Router();

// Every route here requires a logged-in admin
router.use(protect, authorize('admin'));

router.get('/active', getActiveSales);
router.post('/preview', previewSale);
router.post('/apply', applySale);
router.post('/remove', removeSale);
router.post('/expire-check', expireEndedSales);

export default router;