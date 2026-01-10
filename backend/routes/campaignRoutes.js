const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const Credential = require('../models/Credential');
const { deployQueue } = require('../workers/deployWorker');

const pick = (row, keys) => {
  for (const k of keys) {
    if (row && row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
  }
  return '';
};

// @route   POST /api/campaign/start
// @desc    Start a campaign by enqueuing one deploy job per CSV row
// @access  Private
router.post('/start', auth, async (req, res) => {
  const { rows, credentialId } = req.body;

  if (!credentialId) {
    return res.status(400).json({ msg: 'credentialId is required' });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ msg: 'rows must be a non-empty array' });
  }

  try {
    const credential = await Credential.findById(credentialId);

    if (!credential) {
      return res.status(404).json({ msg: 'Credential not found' });
    }

    if (credential.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to use this credential' });
    }

    const platform = credential.platform;

    const enqueueResults = await Promise.all(
      rows.map(async (row, index) => {
        const subDomain = pick(row, ['subDomain', 'subdomain', 'SubDomain', 'sub_domain']);
        const productName = pick(row, ['productName', 'Product Name', 'product_name', 'name']);
        const productDescription = pick(row, ['productDescription', 'Product Description', 'product_description', 'description']);
        const affiliateLink = pick(row, ['affiliateLink', 'Affiliate Link', 'affiliate_link', 'link', 'url']);

        if (!subDomain || !productName || !productDescription || !affiliateLink) {
          return {
            index,
            queued: false,
            error: 'Missing required fields. Required: subDomain, productName, productDescription, affiliateLink',
          };
        }

        const job = await deployQueue.add('deploy-job', {
          platform,
          subDomain,
          credentialId,
          productName,
          productDescription,
          affiliateLink,
        });

        return { index, queued: true, jobId: job.id };
      })
    );

    const queued = enqueueResults.filter((r) => r.queued).length;
    const failed = enqueueResults.filter((r) => !r.queued);

    return res.json({
      queued,
      total: rows.length,
      failed,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
