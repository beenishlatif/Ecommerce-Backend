import Product from '../models/Product.js';
import { emitInventoryChange } from '../services/socketService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// @route GET /api/products  (public) — list with search / filter / pagination
export const getProducts = asyncHandler(async (req, res) => {
  const { search, category, featured, bestseller, minPrice, maxPrice, page = 1, limit = 12 } = req.query;

  const filter = { status: 'active' };
  if (search) filter.$text = { $search: search };
  if (category) filter.category = category;
  if (featured) filter.featured = featured === 'true';
  if (bestseller) filter.bestseller = bestseller === 'true';
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: products,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
  });
});

// @route GET /api/products/:slug (public)
export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, status: 'active' }).populate(
    'category',
    'name slug'
  );
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, data: product });
});

// @route POST /api/admin/products (admin)
export const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  emitInventoryChange(product);
  res.status(201).json({ success: true, data: product });
});

// @route PUT /api/admin/products/:id (admin)
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  emitInventoryChange(product);
  res.json({ success: true, data: product });
});

// @route DELETE /api/admin/products/:id (admin)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, message: 'Product deleted' });
});

// @route GET /api/admin/products (admin) — includes drafts/archived
export const getAdminProducts = asyncHandler(async (req, res) => {
  const products = await Product.find().populate('category', 'name slug').sort({ createdAt: -1 });
  res.json({ success: true, data: products });
});
