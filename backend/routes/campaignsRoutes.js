const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const Campaign = require('../models/Campaign');
const Credential = require('../models/Credential');
const Template = require('../models/Template');
const { deployQueue } = require('../workers/deployWorker');

// @route   POST /api/campaigns/start
// @desc    Save campaign + enqueue one job per csv row (Dynamic Headers Support)
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

  const { platform, credentialId, bucketName, rootFolder } = platformConfig;

  try {
    // 1. Fetch Template to ensure it exists
    const template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }

    // 2. Fetch & Validate Credential
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

    // 3. Create Campaign Record
    const campaign = await Campaign.create({
      userId: req.user.id,
      name: String(campaignName).trim(),
      status: 'processing',
      platform,
      credentialId,
      templateId,
      bucketName,
      rootFolder,
    });

    // 4. Queue Jobs (DYNAMICALLY)
    let queued = 0;
    console.log(`[CAMPAIGN_START] csvData type: ${typeof csvData}, isArray: ${Array.isArray(csvData)}, length: ${csvData?.length}`);
    console.log(`[CAMPAIGN_START] Required Headers:`, template.requiredCsvHeaders);

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      // Basic check for empty row
      if (!row || Object.keys(row).length === 0) {
        console.log(`[CAMPAIGN_START] Skipping row ${i} - empty`);
        continue;
      }

      // Dynamic validation against template required headers
      const missing = (template.requiredCsvHeaders || []).filter(
        (h) => !row[h] || String(row[h]).trim() === ''
      );

      if (missing.length > 0) {
        console.log(`[CAMPAIGN_START] Skipping row ${i} - missing required fields: ${missing.join(', ')}`);
        continue;
      }

      await deployQueue.add('deploy-job', {
        campaignId: campaign._id,
        platform,
        credentialId,
        templateId,
        row: row, // Pass the RAW row so custom headers work
        bucketName, // Pass dynamic bucket info
        rootFolder
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
