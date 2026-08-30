import express from 'express';
import { getProducts, getProductBySlug } from '../controllers/productController.js';
import { getProductReviews, createReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/:slug', getProductBySlug);
router.get('/:productId/reviews', getProductReviews);
router.post('/:productId/reviews', protect, createReview);

export default router;
