import mongoose from 'mongoose';

// Tracks a single "sale campaign" — a percentage discount applied across a
// set of products, a whole category (including its subcategories), or the
// entire catalog. Each affected product's pre-sale price is snapshotted here
// so removeSale/expireEndedSales can restore it exactly, instead of guessing
// what the "original" price was.
const saleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    discountPercent: { type: Number, required: true, min: 1, max: 90 },
    scope: { type: String, enum: ['products', 'category', 'all'], required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    affectedProducts: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        originalPrice: { type: Number, required: true },
        originalCompareAtPrice: { type: Number, default: null },
      },
    ],
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Sale', saleSchema);