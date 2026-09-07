import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import { withDescendantCategoryIds } from '../utils/categoryTree.js';
import { emitInventoryChange } from '../services/socketService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Resolves a { scope, productIds, categoryId } request body into the actual
// list of Product documents the sale should touch. Shared by previewSale
// (read-only) and applySale (which then mutates and snapshots them).
async function resolveTargetProducts({ scope, productIds, categoryId }) {
  if (scope === 'products') {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw Object.assign(new Error('productIds is required when scope is "products"'), { statusCode: 400 });
    }
    return Product.find({ _id: { $in: productIds }, status: 'active' });
  }

  if (scope === 'category') {
    if (!categoryId) {
      throw Object.assign(new Error('categoryId is required when scope is "category"'), { statusCode: 400 });
    }
    // Include the category itself and every subcategory beneath it, no
    // matter how deep — same helper used by the public product filter.
    const categoryIds = await withDescendantCategoryIds(categoryId);
    return Product.find({ category: { $in: categoryIds }, status: 'active' });
  }

  if (scope === 'all') {
    return Product.find({ status: 'active' });
  }

  throw Object.assign(new Error('scope must be one of: products, category, all'), { statusCode: 400 });
}

// @route POST /api/admin/sales/preview (admin)
// Read-only — shows what a sale WOULD do (which products, old vs new price)
// without changing anything, so the admin can review before applying.
export const previewSale = asyncHandler(async (req, res) => {
  const { scope, discountPercent, productIds, categoryId } = req.body;

  if (!discountPercent || discountPercent <= 0 || discountPercent >= 100) {
    return res.status(400).json({ success: false, message: 'discountPercent must be between 1 and 99' });
  }

  const targetProducts = await resolveTargetProducts({ scope, productIds, categoryId });

  const preview = targetProducts.map((p) => ({
    _id: p._id,
    name: p.name,
    currentPrice: p.price,
    newPrice: Math.round(p.price * (1 - discountPercent / 100)),
  }));

  res.json({
    success: true,
    data: {
      affectedCount: preview.length,
      products: preview,
    },
  });
});

// @route POST /api/admin/sales/apply (admin)
// Applies a percentage discount to every matching product, snapshotting each
// product's pre-sale price so it can be restored later by removeSale.
export const applySale = asyncHandler(async (req, res) => {
  const { name, scope, discountPercent, productIds, categoryId, endsAt } = req.body;

  if (!name) return res.status(400).json({ success: false, message: 'name is required' });
  if (!discountPercent || discountPercent <= 0 || discountPercent >= 100) {
    return res.status(400).json({ success: false, message: 'discountPercent must be between 1 and 99' });
  }

  const targetProducts = await resolveTargetProducts({ scope, productIds, categoryId });
  if (targetProducts.length === 0) {
    return res.status(400).json({ success: false, message: 'No matching products found for this sale' });
  }

  const affectedProducts = targetProducts.map((p) => ({
    product: p._id,
    originalPrice: p.price,
    originalCompareAtPrice: p.compareAtPrice ?? null,
  }));

  const sale = await Sale.create({
    name,
    scope,
    discountPercent,
    products: scope === 'products' ? productIds : [],
    category: scope === 'category' ? categoryId : null,
    affectedProducts,
    endsAt: endsAt || null,
    isActive: true,
  });

  await Promise.all(
    targetProducts.map(async (p) => {
      const newPrice = Math.round(p.price * (1 - discountPercent / 100));
      p.compareAtPrice = p.price; // shows the pre-sale price struck through
      p.price = newPrice;
      await p.save();
      emitInventoryChange(p);
    })
  );

  res.status(201).json({ success: true, data: sale });
});

// @route POST /api/admin/sales/remove (admin)
// Restores every product this sale touched back to its pre-sale price.
export const removeSale = asyncHandler(async (req, res) => {
  const { saleId } = req.body;
  if (!saleId) return res.status(400).json({ success: false, message: 'saleId is required' });

  const sale = await Sale.findById(saleId);
  if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
  if (!sale.isActive) return res.status(400).json({ success: false, message: 'This sale has already been removed' });

  await Promise.all(
    sale.affectedProducts.map(async ({ product, originalPrice, originalCompareAtPrice }) => {
      const p = await Product.findById(product);
      if (!p) return; // product may have been deleted since the sale was applied
      p.price = originalPrice;
      p.compareAtPrice = originalCompareAtPrice;
      await p.save();
      emitInventoryChange(p);
    })
  );

  sale.isActive = false;
  await sale.save();

  res.json({ success: true, message: 'Sale removed and prices restored', data: sale });
});

// @route GET /api/admin/sales/active (admin)
export const getActiveSales = asyncHandler(async (req, res) => {
  const sales = await Sale.find({ isActive: true })
    .populate('products', 'name slug price')
    .populate('category', 'name slug')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: sales });
});

// @route POST /api/admin/sales/expire-check (admin)
// Finds any active sale whose endsAt has passed and reverts it, same as
// removeSale. Intended to be called periodically (e.g. a cron hitting this
// route, or manually from the admin panel) since Vercel serverless has no
// long-running background timers.
export const expireEndedSales = asyncHandler(async (req, res) => {
  const now = new Date();
  const expiredSales = await Sale.find({ isActive: true, endsAt: { $ne: null, $lte: now } });

  for (const sale of expiredSales) {
    await Promise.all(
      sale.affectedProducts.map(async ({ product, originalPrice, originalCompareAtPrice }) => {
        const p = await Product.findById(product);
        if (!p) return;
        p.price = originalPrice;
        p.compareAtPrice = originalCompareAtPrice;
        await p.save();
        emitInventoryChange(p);
      })
    );
    sale.isActive = false;
    await sale.save();
  }

  res.json({ success: true, message: `${expiredSales.length} expired sale(s) reverted`, data: expiredSales });
});