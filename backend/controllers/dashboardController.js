const Website = require('../models/Website');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalWebsitesLive = await Website.countDocuments({ userId, status: 'Live' });
    const totalDeployments = await Website.countDocuments({ userId });

    // Mock data for stats that are not tracked yet
    const storageUsed = '45%'; // This would require more complex calculation
    const creditsRemaining = '2,400'; // This requires a credits system

    res.json({
      totalWebsitesLive,
      totalDeployments,
      storageUsed,
      creditsRemaining,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

module.exports = { getStats };
