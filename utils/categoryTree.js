import mongoose from 'mongoose';
import Category from '../models/Category.js';

// Given a category id, returns [that id, ...every descendant id at any depth]
// using $graphLookup so nested subcategories (subcategory of a subcategory,
// etc.) are all included when filtering or bulk-acting on products.
// Shared by productController.js (browsing/filtering) and saleController.js
// (applying a sale to "this category and everything under it").
export async function withDescendantCategoryIds(categoryId) {
  const result = await Category.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(categoryId) } },
    {
      $graphLookup: {
        from: 'categories',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent',
        as: 'descendants',
      },
    },
  ]);

  const descendants = result[0]?.descendants || [];
  return [categoryId, ...descendants.map((d) => d._id.toString())];
}