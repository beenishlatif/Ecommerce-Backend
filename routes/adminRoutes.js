import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';

import { getDashboardStats } from '../controllers/adminController.js';
import {
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import { getAdminOrders, updateOrderStatus } from '../controllers/orderController.js';
import { getCustomers, getUsers, setUserActive } from '../controllers/userController.js';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../controllers/couponController.js';
import { getPayments, getPaymentById } from '../controllers/paymentController.js';
import { getAdminReviews, moderateReview } from '../controllers/reviewController.js';

const router = express.Router();

// Every route below requires a logged-in admin
router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboardStats);

// Products
router.get('/products', getAdminProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Categories
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Orders
router.get('/orders', getAdminOrders);
router.put('/orders/:id/status', updateOrderStatus);

// Customers & users
router.get('/customers', getCustomers);
router.get('/users', getUsers);
router.put('/users/:id/status', setUserActive);

// Coupons
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Payments
router.get('/payments', getPayments);
router.get('/payments/:id', getPaymentById);

// Reviews
router.get('/reviews', getAdminReviews);
router.put('/reviews/:id/status', moderateReview);

export default router;
