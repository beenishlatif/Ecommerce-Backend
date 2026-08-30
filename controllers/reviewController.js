import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../utils/asyncHandler.js';

async function recalcProductRating(productId) {
  const stats = await Review.aggregate([
    { $match: { product: productId, status: 'approved' } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const { avg = 0, count = 0 } = stats[0] || {};
  await Product.findByIdAndUpdate(productId, { ratingAverage: avg, ratingCount: count });
}

// @route GET /api/products/:productId/reviews (public)
export const getProductReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId, status: 'approved' })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: reviews });
});

// @route POST /api/products/:productId/reviews (customer)
export const createReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const review = await Review.create({
    product: req.params.productId,
    user: req.user._id,
    rating,
    comment,
  });
  res.status(201).json({ success: true, data: review });
});

// @route GET /api/admin/reviews (admin — moderation queue)
export const getAdminReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find()
    .populate('user', 'name email')
    .populate('product', 'name slug')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: reviews });
});

// @route PUT /api/admin/reviews/:id/status (admin)
export const moderateReview = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  await recalcProductRating(review.product);
  res.json({ success: true, data: review });
});
