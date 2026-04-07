const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const StaticWebsite = require('../models/StaticWebsite');
const StaticTemplate = require('../models/StaticTemplate');
const Campaign = require('../models/Campaign');
const Credential = require('../models/Credential');
const { uploadToS3 } = require('../services/uploaders/s3Adapter');
const { uploadToNetlify } = require('../services/uploaders/netlifyAdapter');
const { injectIntoTemplate } = require('../utils/templateInjector');
const path = require('path');
const fs = require('fs');

const USER_SITES_BASE_DIR = process.env.USER_SITES_BASE_DIR || '/var/www/user_sites';

// @route   GET /api/static-websites
// @desc    Get all static websites for logged in user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [websites, total] = await Promise.all([
      StaticWebsite.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('productName status url createdAt platform subdomain domain staticTemplateId siteId headerCode generatedJson')
        .lean(),
      StaticWebsite.countDocuments({ userId: req.user.id })
    ]);

    res.json({
      websites,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/static-websites/:id
// @desc    Get single static website by id
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const website = await StaticWebsite.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }

    // Check ownership
    if (website.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(website);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Website not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/static-websites/:id
// @desc    Delete static website from DB (does not delete from hosting provider)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const website = await StaticWebsite.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }

    // Check ownership
    if (website.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await website.deleteOne();
    res.json({ msg: 'Website removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/static-websites/:id/redeploy
// @desc    Redeploy a static website with same JSON but updated template/header
// @access  Private
router.post('/:id/redeploy', auth, async (req, res) => {
  try {
    const website = await StaticWebsite.findById(req.params.id);
    if (!website) return res.status(404).json({ msg: 'Website not found' });

    // Check ownership
    if (website.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const staticTemplate = await StaticTemplate.findById(website.staticTemplateId);
    if (!staticTemplate) return res.status(404).json({ msg: 'Template not found' });

    const campaign = await Campaign.findById(website.campaignId);
    if (!campaign) return res.status(404).json({ msg: 'Campaign not found' });

    // Reconstruct HTML
    let htmlToUpload = injectIntoTemplate(
      staticTemplate.htmlContent,
      {}, // Empty CSV row for redeploy
      website.generatedJson
    );

    // Inject header code if present
    const headerCode = website.headerCode || '';
    if (headerCode) {
      htmlToUpload = htmlToUpload.replace('</head>', `${headerCode}\n</head>`);
    }

    // Fetch credentials if needed
    let credential = null;
    if (website.platform !== 'custom_domain') {
      const campaignDoc = await Campaign.findById(website.campaignId);
      const credentialDoc = await Credential.findById(campaignDoc.credentialId);
      if (!credentialDoc) return res.status(404).json({ msg: 'Credential not found' });
      credential = credentialDoc.getDecrypted();
    }

    // Upload logic
    let result;
    const subDomain = website.subdomain;
    const targetDomain = website.domain;

    switch (website.platform) {
      case 'aws_s3':
      case 'digital_ocean':
      case 'backblaze':
      case 'cloudflare_r2':
        result = await uploadToS3(htmlToUpload, subDomain, credential, campaign);
        break;
      case 'netlify':
        result = await uploadToNetlify(htmlToUpload, subDomain, credential);
        break;
      case 'custom_domain':
        const sitePath = path.join(USER_SITES_BASE_DIR, targetDomain, subDomain);
        try {
          fs.mkdirSync(sitePath, { recursive: true });
          fs.writeFileSync(path.join(sitePath, 'index.html'), htmlToUpload);
          result = { success: true, url: `http://${subDomain}.${targetDomain}` };
        } catch (fsErr) {
          result = { success: false, error: fsErr.message };
        }
        break;
      default:
        return res.status(400).json({ msg: `Unsupported platform: ${website.platform}` });
    }

    if (!result.success) {
      return res.status(500).json({ msg: result.error || 'Upload failed' });
    }

    website.status = 'Live';
    await website.save();

    res.json(website);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
