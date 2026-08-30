import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../utils/generateToken.js';

// @route POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const user = await User.create({ name, email, password, role: 'customer' });
  const token = generateToken({ id: user._id, role: user.role });
  setAuthCookie(res, token);

  res.status(201).json({ success: true, data: user.toSafeObject() });
});

// @route POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated' });
  }

  const token = generateToken({ id: user._id, role: user.role });
  setAuthCookie(res, token);

  res.json({ success: true, data: user.toSafeObject() });
});

// @route POST /api/auth/admin/login — same logic, restricted to admin role
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase(), role: 'admin' }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }

  const token = generateToken({ id: user._id, role: user.role });
  setAuthCookie(res, token);

  res.json({ success: true, data: user.toSafeObject() });
});

// @route POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

// @route GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.toSafeObject() });
});

// @route POST /api/auth/forgot-password (placeholder — wire up email sending later)
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });
  // Always respond the same way whether or not the user exists, to avoid leaking data
  res.json({
    success: true,
    message: 'If that email is registered, a reset link has been sent.',
  });
  if (user) {
    // TODO: generate reset token, email it via a mail service
  }
});

// @route POST /api/auth/reset-password (placeholder)
export const resetPassword = asyncHandler(async (req, res) => {
  // TODO: verify reset token, then update user.password
  res.status(501).json({ success: false, message: 'Reset-password flow not yet implemented' });
});
