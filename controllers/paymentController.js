import Payment from '../models/Payment.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// @route GET /api/admin/payments
export const getPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find()
    .populate('order', 'orderNumber total')
    .populate('user', 'name email')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: payments });
});

// @route GET /api/admin/payments/:id
export const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('order').populate('user', 'name email');
  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
  res.json({ success: true, data: payment });
});
