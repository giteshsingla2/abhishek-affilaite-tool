const express = require('express');
const router = express.Router();
const { deployQueue } = require('../workers/deployWorker');
const auth = require('../middleware/authMiddleware');

// @route   POST /api/test-upload
// @desc    Trigger a test upload job with content generation
// @access  Private
router.post('/', auth, async (req, res) => {
  const { platform, subDomain, credentialId, productName, productDescription, affiliateLink } = req.body;

  const requiredFields = { platform, subDomain, credentialId, productName, productDescription, affiliateLink };
  for (const [field, value] of Object.entries(requiredFields)) {
    if (!value) {
      return res.status(400).json({ msg: `Please provide: ${Object.keys(requiredFields).join(', ')}` });
    }
  }

  try {
    const job = await deployQueue.add('deploy-job', {
      platform,
      subDomain,
      credentialId,
      productName,
      productDescription,
      affiliateLink,
    });

    res.json({ msg: 'Deployment job has been queued.', jobId: job.id });
  } catch (err) {
    console.error('Error queuing job:', err);
    res.status(500).send('Server error while queuing job');
  }
});

module.exports = router;
