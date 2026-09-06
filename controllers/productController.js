import Product from '../models/Product.js';
import { emitInventoryChange } from '../services/socketService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { withDescendantCategoryIds } from '../utils/categoryTree.js';

const SORT_MAP = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  newest: { createdAt: -1 },
  name_asc: { name: 1 },
  rating_desc: { ratingAverage: -1 },
};

// @route GET /api/products  (public) — list with search / filter / pagination
export const getProducts = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    featured,
    bestseller,
    minPrice,
    maxPrice,
    colors,
    sizes,
    inStock,
    onSale,
    sort,
    page = 1,
    limit = 12,
  } = req.query;

  const filter = { status: 'active' };
  if (search) filter.$text = { $search: search };

  if (category) {
    // Include products assigned to this category OR any of its subcategories,
    // no matter how many levels deep (Women -> Clothing -> Stitched -> ...).
    const categoryIds = await withDescendantCategoryIds(category);
    filter.category = categoryIds.length > 1 ? { $in: categoryIds } : category;
  }

  if (featured) filter.featured = featured === 'true';
  if (bestseller) filter.bestseller = bestseller === 'true';

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  if (colors) {
    const colorList = colors.split(',').map((c) => c.trim()).filter(Boolean);
    if (colorList.length > 0) filter.colors = { $in: colorList };
  }

  if (sizes) {
    const sizeList = sizes.split(',').map((s) => s.trim()).filter(Boolean);
    if (sizeList.length > 0) filter.sizes = { $in: sizeList };
  }

  if (inStock === 'true') {
    filter.stock = { $gt: 0 };
  }

  if (onSale === 'true') {
    filter.$expr = { $gt: ['$compareAtPrice', '$price'] };
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const sortOption = SORT_MAP[sort] || { createdAt: -1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort(sortOption)
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

// @route GET /api/admin/products/:id (admin) — single product, any status,
// used to populate the edit form efficiently instead of filtering the full list.
export const getAdminProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug');
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, data: product });
});