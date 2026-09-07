import express from 'express';
import { createOrder, getMyOrders, getOrderById } from '../controllers/orderController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Guests can place an order and view their own order confirmation.
// Order history ("my orders") still requires a real account.
router.post('/', optionalAuth, createOrder);
router.get('/', protect, getMyOrders);
router.get('/:id', optionalAuth, getOrderById);

export default router;