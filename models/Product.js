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

    attributes: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);