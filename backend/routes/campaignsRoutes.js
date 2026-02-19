const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const Campaign = require('../models/Campaign');
const Credential = require('../models/Credential');
const Template = require('../models/Template');
const Domain = require('../models/Domain');
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

  if (!platformConfig || !platformConfig.platform) {
    return res.status(400).json({ msg: 'platformConfig.platform is required' });
  }

  if (platformConfig.platform !== 'custom_domain' && !platformConfig.credentialId) {
    return res.status(400).json({ msg: 'platformConfig.credentialId is required for this platform' });
  }

  if (!Array.isArray(csvData) || csvData.length === 0) {
    return res.status(400).json({ msg: 'csvData must be a non-empty array' });
  }

  const { platform, credentialId, bucketName, rootFolder, domainName, useDynamicDomain } = platformConfig;

  try {
    // 1. Fetch Template to ensure it exists
    const template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }

    // 2. Fetch & Validate Credential (only if not custom_domain)
    let credential = null;
    let allowedDomains = null;

    if (platform === 'custom_domain' && useDynamicDomain) {
      const csvDomains = [...new Set(csvData.map(row => row.domain).filter(Boolean))];
      if (csvDomains.length === 0) {
        return res.status(400).json({ msg: 'CSV file must contain a non-empty `domain` column for dynamic domain mode.' });
      }

      const userDomains = await Domain.find({ userId: req.user.id, name: { $in: csvDomains } });
      allowedDomains = new Set(userDomains.map(d => d.name));

      if (allowedDomains.size === 0) {
        return res.status(403).json({ msg: 'None of the domains in the CSV are registered to your account.' });
      }
    } else if (platform !== 'custom_domain') {
      if (!credentialId) {
        return res.status(400).json({ msg: 'credentialId is required for this platform' });
      }
      credential = await Credential.findById(credentialId);
      if (!credential) {
        return res.status(404).json({ msg: 'Credential not found' });
      }

      if (credential.userId.toString() !== req.user.id) {
        return res.status(403).json({ msg: 'Not authorized to use this credential' });
      }

      if (credential.platform !== platform) {
        return res.status(400).json({ msg: 'Selected credential platform does not match selected platform' });
      }
    } else {
      if (!useDynamicDomain && !domainName) {
        return res.status(400).json({ msg: 'domainName is required for single domain mode' });
      }
    }

    // 3. Create Campaign Record
    const campaign = await Campaign.create({
      userId: req.user.id,
      name: String(campaignName).trim(),
      status: 'processing',
      platform,
      credentialId: platform === 'custom_domain' ? null : credentialId,
      domainName: platform === 'custom_domain' ? domainName : undefined,
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

      if (useDynamicDomain && platform === 'custom_domain') {
        if (!row.domain || !allowedDomains.has(row.domain)) {
          console.log(`[CAMPAIGN_START] Skipping row ${i} - invalid or unowned domain: ${row.domain}`);
          continue;
        }
      }

      await deployQueue.add('deploy-job', {
        campaignId: campaign._id,
        platform,
        credentialId: platform === 'custom_domain' ? null : credentialId,
        domainName: useDynamicDomain ? row.domain : domainName,
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
