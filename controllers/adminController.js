import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// @route GET /api/admin/dashboard — real stats computed from MongoDB, never hardcoded
export const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalOrders, totalProducts, totalCustomers, revenueAgg, statusBreakdown, lowStock] =
    await Promise.all([
      Order.countDocuments(),
      Product.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      Order.aggregate([
        { $match: { isPaid: true } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Product.find({ stock: { $lte: 5 }, status: 'active' }).select('name stock').limit(10),
    ]);

  res.json({
    success: true,
    data: {
      totalOrders,
      totalProducts,
      totalCustomers,
      totalRevenue: revenueAgg[0]?.total || 0,
      ordersByStatus: statusBreakdown,
      lowStockProducts: lowStock,
    },
  });
});
