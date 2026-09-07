import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Verifies the JWT (from httpOnly cookie or Bearer header) and attaches req.user
export const protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.[env.cookieName];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const decoded = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(decoded.id);

  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'User not found or inactive' });
  }

  req.user = user;
  next();
});

// Restricts access to specific roles, e.g. authorize('admin')
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Not authorized for this action' });
  }
  next();
};

// Like `protect`, but never blocks the request. If a valid token is present,
// req.user is attached (same as protect). If there's no token, or the token
// is missing/expired/invalid, the request just continues as a guest with
// req.user left undefined — routes using this decide for themselves what a
// guest is allowed to do (e.g. place an order but not view someone else's).
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.[env.cookieName];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Invalid or expired token — proceed as guest rather than failing the request.
  }

  next();
});