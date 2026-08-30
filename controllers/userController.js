import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// @route PUT /api/users/me (customer)
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { name, phone, avatar } },
    { new: true, runValidators: true }
  );
  res.json({ success: true, data: user.toSafeObject() });
});

// @route POST /api/users/me/addresses
export const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses.push(req.body);
  await user.save();
  res.status(201).json({ success: true, data: user.addresses });
});

// @route PUT /api/users/me/addresses/:addressId
export const updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) return res.status(404).json({ success: false, message: 'Address not found' });
  Object.assign(address, req.body);
  await user.save();
  res.json({ success: true, data: user.addresses });
});

// @route DELETE /api/users/me/addresses/:addressId
export const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses.id(req.params.addressId)?.deleteOne();
  await user.save();
  res.json({ success: true, data: user.addresses });
});

// @route PUT /api/users/me/wishlist/:productId (toggle)
export const toggleWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const idx = user.wishlist.findIndex((id) => String(id) === req.params.productId);
  if (idx > -1) user.wishlist.splice(idx, 1);
  else user.wishlist.push(req.params.productId);
  await user.save();
  res.json({ success: true, data: user.wishlist });
});

// @route GET /api/users/me/wishlist
export const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist');
  res.json({ success: true, data: user.wishlist });
});

// --- Admin: manage customers/users ---

// @route GET /api/admin/customers
export const getCustomers = asyncHandler(async (req, res) => {
  const customers = await User.find({ role: 'customer' }).sort({ createdAt: -1 });
  res.json({ success: true, data: customers });
});

// @route GET /api/admin/users (staff/admin accounts)
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ role: 'admin' }).sort({ createdAt: -1 });
  res.json({ success: true, data: users });
});

// @route PUT /api/admin/users/:id/status (activate/deactivate)
export const setUserActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user.toSafeObject() });
});
