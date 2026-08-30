// Wraps an async route handler so any thrown error / rejected promise
// is forwarded to Express's centralized error handler instead of crashing the process.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
