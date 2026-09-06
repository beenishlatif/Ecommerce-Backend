import Setting from '../models/Setting.js';

// @desc    Get homepage settings (hero image) — public, used by the Home page
// @route   GET /api/settings/homepage
export const getHomepageSettings = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'homepage' });
    res.status(200).json({ success: true, data: { heroImage: setting?.heroImage || '' } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load homepage settings' });
  }
};

// @desc    Update homepage settings (hero image) — admin only
// @route   PUT /api/admin/settings/homepage
export const updateHomepageSettings = async (req, res) => {
  try {
    const { heroImage } = req.body;
    const setting = await Setting.findOneAndUpdate(
      { key: 'homepage' },
      { heroImage: heroImage || '' },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, data: { heroImage: setting.heroImage } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not update homepage settings' });
  }
};