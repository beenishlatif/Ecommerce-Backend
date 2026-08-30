// @desc    Upload a single image
// @route   POST /api/upload
export const uploadSingleImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(201).json({ success: true, data: { url } });
};

// @desc    Upload multiple images (up to 6)
// @route   POST /api/upload/multiple
export const uploadMultipleImages = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded' });
  }

  const urls = req.files.map(
    (file) => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
  );
  res.status(201).json({ success: true, data: { urls } });
};