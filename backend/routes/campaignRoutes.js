const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Campaign = require('../models/Campaign');

// GET /api/campaigns — paginated list of user's campaigns
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { userId: req.user.id };

    if (req.query.status && ['pending','queuing','processing','completed','failed'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.type && ['ai', 'static'].includes(req.query.type)) {
      filter.campaignType = req.query.type;
    }

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name status campaignType platform totalJobs completedJobs failedJobs createdAt model useDynamicDomain domainName bucketName')
        .lean(),
      Campaign.countDocuments(filter),
    ]);

    res.json({
      campaigns,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE /api/campaigns/:id — delete a campaign record (not the deployed sites)
router.delete('/:id', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ msg: 'Campaign not found' });
    if (campaign.userId.toString() !== req.user.id) return res.status(403).json({ msg: 'Not authorized' });
    if (['pending', 'queuing', 'processing'].includes(campaign.status)) {
      return res.status(400).json({ msg: 'Cannot delete a campaign that is still running' });
    }
    await campaign.deleteOne();
    res.json({ msg: 'Campaign deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
