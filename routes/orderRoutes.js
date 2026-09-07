import express from 'express';
import { createOrder, getMyOrders, getOrderById } from '../controllers/orderController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Guest-friendly: works whether or not the customer is logged in
router.post('/', optionalAuth, createOrder);
router.get('/:id', optionalAuth, getOrderById);

// Requires an account: listing "my orders" only makes sense for a logged-in user
router.get('/', protect, getMyOrders);

export default router;