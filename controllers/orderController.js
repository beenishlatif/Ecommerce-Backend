import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Payment from '../models/Payment.js';
import Coupon from '../models/Coupon.js';
import { initiatePayment } from '../services/paymentService.js';
import { emitNewOrder, emitOrderStatusChange } from '../services/socketService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// @route POST /api/orders (customer) — creates a real order, decrements stock
export const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod, couponCode } = req.body;

  if (!items?.length) {
    return res.status(400).json({ success: false, message: 'Order must include at least one item' });
  }

  // Re-price server-side from the database — never trust client-sent prices
  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product || product.status !== 'active') {
      return res.status(400).json({ success: false, message: `Product unavailable: ${item.productId}` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
    }
    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images?.[0] || '',
      price: product.price,
      quantity: item.quantity,
    });
    subtotal += product.price * item.quantity;
  }

  let discount = 0;
  let coupon = null;
  if (couponCode) {
    coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    if (coupon && subtotal >= coupon.minOrderAmount) {
      discount = coupon.type === 'percentage' ? (subtotal * coupon.value) / 100 : coupon.value;
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    }
  }

  const shippingFee = subtotal > 5000 ? 0 : 200; // simple placeholder shipping rule
  const total = Math.max(0, subtotal - discount + shippingFee);

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod,
    coupon: coupon?._id || null,
    subtotal,
    discount,
    shippingFee,
    total,
  });

  // Decrement stock
  await Promise.all(
    orderItems.map((item) =>
      Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
    )
  );

  // Kick off payment (COD resolves immediately; gateways are architecture-only placeholders)
  const paymentResult = await initiatePayment(paymentMethod, { order }).catch((err) => ({
    status: 'failed',
    providerRef: '',
    rawResponse: { error: err.message },
  }));

  await Payment.create({
    order: order._id,
    user: req.user._id,
    method: paymentMethod,
    amount: total,
    status: paymentResult.status,
    providerRef: paymentResult.providerRef,
    rawResponse: paymentResult.rawResponse,
  });

  emitNewOrder(order);
  res.status(201).json({ success: true, data: order });
});

// @route GET /api/orders (customer) — own orders
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

// @route GET /api/orders/:id (customer, own order only)
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
  }
  res.json({ success: true, data: order });
});

// @route GET /api/admin/orders (admin) — search / filter
export const getAdminOrders = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.orderNumber = { $regex: search, $options: 'i' };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Order.countDocuments(filter),
  ]);

  res.json({ success: true, data: orders, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
});

// @route PUT /api/admin/orders/:id/status (admin)
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const valid = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value' });
  }

  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  emitOrderStatusChange(order);
  res.json({ success: true, data: order });
});
