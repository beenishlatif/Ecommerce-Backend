import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: '' },
    details: { type: String, default: '' },
    fit: { type: String, default: '' },
    sku: { type: String, required: true, unique: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    coverImage: { type: String, default: '' },
    images: [{ type: String }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active' },
    featured: { type: Boolean, default: false },
    bestseller: { type: Boolean, default: false },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // Product type + type-specific attributes
    productType: {
      type: String,
      enum: ['dress', 'shoes', 'jewelry', 'other'],
      default: 'dress',
    },
    fabricType: { type: String, enum: ['Stitched', 'Unstitched', ''], default: '' }, // dress only
    material: { type: String, default: '' }, // fabric/leather/metal etc — used by all types
    sizes: [{ type: String }], // clothing sizes (XS-XXL) or shoe sizes (36-45)
    colors: [{ type: String }],
    jewelrySize: {
      type: String,
      enum: ['Adjustable', 'Small', 'Medium', 'Large', ''],
      default: '',
    },

    // Sale campaign metadata. compareAtPrice doubles as "the price before the
    // sale" — when a sale is applied, compareAtPrice stores the original
    // price and `price` becomes the discounted price. saleDiscountPercent is
    // kept alongside purely so the UI can show an exact "-30%" badge without
    // re-deriving it (and risking rounding drift) from price/compareAtPrice.
    saleDiscountPercent: { type: Number, default: 0, min: 0, max: 95 },
    saleEndsAt: { type: Date, default: null },

    attributes: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);