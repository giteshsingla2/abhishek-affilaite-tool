const Website = require('../models/Website');
const StaticWebsite = require('../models/StaticWebsite');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      totalWebsitesLive,
      totalDeployments,
      totalStaticWebsitesLive,
      totalStaticDeployments,
      recentWebsites
    ] = await Promise.all([
      Website.countDocuments({ userId, status: 'Live' }),
      Website.countDocuments({ userId }),
      StaticWebsite.countDocuments({ userId, status: 'Live' }),
      StaticWebsite.countDocuments({ userId }),
      Website.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('productName status url createdAt platform subdomain')
        .lean()
    ]);

    res.json({
      totalWebsitesLive,
      totalDeployments,
      totalStaticWebsitesLive,
      totalStaticDeployments,
      storageUsed: '45%',
      creditsRemaining: '2,400',
      recentWebsites
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

module.exports = { getStats };
