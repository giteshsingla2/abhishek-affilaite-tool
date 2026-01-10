const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const Campaign = require('../models/Campaign');
const Credential = require('../models/Credential');
const Template = require('../models/Template');
const { deployQueue } = require('../workers/deployWorker');

const REQUIRED_HEADERS = [
  'name',
  'description',
  'price',
  'image_url',
  'affiliate_url',
  'logo_url',
  'sub_domain',
  'header_code',
  'meta_keywords',
];

const REQUIRED_FIELDS = ['name', 'description', 'affiliate_url', 'sub_domain'];

const normalizeRow = (row) => {
  const normalized = {};
  REQUIRED_HEADERS.forEach((h) => {
    normalized[h] = row && row[h] != null ? String(row[h]) : '';
  });
  return normalized;
};

const missingRequired = (row) => {
  return REQUIRED_FIELDS.filter((f) => String(row?.[f] || '').trim() === '');
};

// @route   POST /api/campaigns/start
// @desc    Save campaign + enqueue one job per csv row
// @access  Private
router.post('/start', auth, async (req, res) => {
  const { campaignName, templateId, platformConfig, csvData } = req.body;

  if (!campaignName || String(campaignName).trim() === '') {
    return res.status(400).json({ msg: 'campaignName is required' });
  }

  if (!templateId) {
    return res.status(400).json({ msg: 'templateId is required' });
  }

  if (!platformConfig || !platformConfig.platform || !platformConfig.credentialId) {
    return res.status(400).json({ msg: 'platformConfig.platform and platformConfig.credentialId are required' });
  }

  if (!Array.isArray(csvData) || csvData.length === 0) {
    return res.status(400).json({ msg: 'csvData must be a non-empty array' });
  }

  const platform = platformConfig.platform;
  const credentialId = platformConfig.credentialId;

  try {
    const template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }

    const credential = await Credential.findById(credentialId);
    if (!credential) {
      return res.status(404).json({ msg: 'Credential not found' });
    }

    if (credential.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to use this credential' });
    }

    if (credential.platform !== platform) {
      return res.status(400).json({ msg: 'Selected credential platform does not match selected platform' });
    }

    const campaign = await Campaign.create({
      userId: req.user.id,
      name: String(campaignName).trim(),
      status: 'processing',
      platform,
      credentialId,
      templateId,
    });

    let queued = 0;

    for (let i = 0; i < csvData.length; i++) {
      const normalized = normalizeRow(csvData[i]);
      const missing = missingRequired(normalized);

      if (missing.length) {
        continue;
      }

      await deployQueue.add('deploy-job', {
        campaignId: campaign._id,
        platform,
        credentialId,
        templateId,
        row: normalized,
      });

      queued++;
    }

    return res.json({
      success: true,
      message: `Campaign started with ${queued} sites queued`,
      queued,
      campaignId: campaign._id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
