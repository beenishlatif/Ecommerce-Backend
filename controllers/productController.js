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

// ---------------------------------------------------------------------------
// Bulk sale management — matches adminApi.sales in endpoints.js
// (active / preview / apply / remove). All four resolve their target
// products the same way: either a category (including its subcategories)
// or an explicit list of product ids.
// ---------------------------------------------------------------------------

// Shared helper: resolve { category, productIds } from a request body into
// an actual list of matching, currently-active products.
async function resolveSaleTargets({ category, productIds }) {
  if (category) {
    const categoryIds = await withDescendantCategoryIds(category);
    return Product.find({ category: { $in: categoryIds } });
  }
  if (productIds && productIds.length > 0) {
    return Product.find({ _id: { $in: productIds } });
  }
  return [];
}

// @route GET /api/admin/sales/active (admin) — every product currently on sale
export const getActiveSales = asyncHandler(async (req, res) => {
  const products = await Product.find({ saleDiscountPercent: { $gt: 0 } })
    .populate('category', 'name slug')
    .sort({ updatedAt: -1 });
  res.json({ success: true, data: products });
});

// @route POST /api/admin/sales/preview (admin)
// Body: { category?, productIds?, discountPercent }
// Returns how many products would be affected and a small sample of
// before/after prices, without writing anything to the database.
export const previewSale = asyncHandler(async (req, res) => {
  const { category, productIds, discountPercent } = req.body;

  if (!discountPercent || discountPercent <= 0 || discountPercent >= 100) {
    return res.status(400).json({ success: false, message: 'Invalid discount percent' });
  }

  const products = await resolveSaleTargets({ category, productIds });

  const sample = products.slice(0, 5).map((p) => {
    // If a product is already on sale, its true regular price lives in
    // compareAtPrice — reuse that so discounts never stack on each other.
    const regularPrice = p.saleDiscountPercent > 0 ? p.compareAtPrice : p.price;
    return {
      _id: p._id,
      name: p.name,
      regularPrice,
      newPrice: Math.round(regularPrice * (1 - discountPercent / 100)),
    };
  });

  res.json({ success: true, data: { count: products.length, sample } });
});

// @route POST /api/admin/sales/apply (admin)
// Body: { category?, productIds?, discountPercent, saleEndsAt? }
export const applySale = asyncHandler(async (req, res) => {
  const { category, productIds, discountPercent, saleEndsAt } = req.body;

  if (!discountPercent || discountPercent <= 0 || discountPercent >= 100) {
    return res.status(400).json({ success: false, message: 'Invalid discount percent' });
  }
  if (!category && (!productIds || productIds.length === 0)) {
    return res.status(400).json({ success: false, message: 'Provide a category or a list of product ids' });
  }

  const products = await resolveSaleTargets({ category, productIds });

  const ops = products.map((p) => {
    const regularPrice = p.saleDiscountPercent > 0 ? p.compareAtPrice : p.price;
    const newPrice = Math.round(regularPrice * (1 - discountPercent / 100));
    return {
      updateOne: {
        filter: { _id: p._id },
        update: {
          price: newPrice,
          compareAtPrice: regularPrice,
          saleDiscountPercent: discountPercent,
          saleEndsAt: saleEndsAt || null,
        },
      },
    };
  });

  const result = ops.length > 0 ? await Product.bulkWrite(ops) : { modifiedCount: 0 };

  if (result.modifiedCount > 0) {
    const updated = await Product.find({ _id: { $in: products.map((p) => p._id) } });
    updated.forEach(emitInventoryChange);
  }

  res.json({ success: true, data: { modifiedCount: result.modifiedCount || 0 } });
});

// @route POST /api/admin/sales/remove (admin)
// Body: { category?, productIds? } — clears the sale, restoring each
// product's price back to its saved regular price (compareAtPrice).
export const removeSale = asyncHandler(async (req, res) => {
  const { category, productIds } = req.body;

  if (!category && (!productIds || productIds.length === 0)) {
    return res.status(400).json({ success: false, message: 'Provide a category or a list of product ids' });
  }

  const products = await resolveSaleTargets({ category, productIds });
  const onSaleProducts = products.filter((p) => p.saleDiscountPercent > 0);

  const ops = onSaleProducts.map((p) => ({
    updateOne: {
      filter: { _id: p._id },
      update: {
        price: p.compareAtPrice,
        compareAtPrice: 0,
        saleDiscountPercent: 0,
        saleEndsAt: null,
      },
    },
  }));

  const result = ops.length > 0 ? await Product.bulkWrite(ops) : { modifiedCount: 0 };

  if (result.modifiedCount > 0) {
    const updated = await Product.find({ _id: { $in: onSaleProducts.map((p) => p._id) } });
    updated.forEach(emitInventoryChange);
  }

  res.json({ success: true, data: { modifiedCount: result.modifiedCount || 0 } });
});