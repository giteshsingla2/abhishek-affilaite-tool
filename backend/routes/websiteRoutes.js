const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/authMiddleware');
const Website = require('../models/Website');
const Campaign = require('../models/Campaign');
const Credential = require('../models/Credential');
const { deleteFromS3 } = require('../services/uploaders/s3Adapter');
const { deleteFromNetlify } = require('../services/uploaders/netlifyAdapter');

const USER_SITES_BASE_DIR = process.env.USER_SITES_BASE_DIR || '/var/www/user_sites';

// @route   GET api/websites
// @desc    Get all websites for a user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const websites = await Website.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(websites);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/websites/:id
// @desc    Delete website from DB and Cloud Provider
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    // 1. Find Website
    const website = await Website.findById(req.params.id);
    if (!website) return res.status(404).json({ msg: 'Website not found' });

    // Ensure user owns this website
    if (website.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    // 2. Fetch Context (Campaign)
    const campaign = await Campaign.findById(website.campaignId);
    
    // 3. Perform Deletion based on Platform
    const platform = website.platform;

    // --- CUSTOM DOMAIN (Local Server) ---
    if (platform === 'custom_domain') {
      const domainName = campaign?.domainName;
      const subDomain = website.subdomain;
      
      if (domainName && subDomain) {
        const localPath = path.join(USER_SITES_BASE_DIR, domainName, subDomain);
        if (fs.existsSync(localPath)) {
          fs.rmSync(localPath, { recursive: true, force: true });
          console.log(`Deleted local folder: ${localPath}`);
        }
      }
    }
    
    // --- CLOUD PLATFORMS ---
    else if (campaign && campaign.credentialId) {
      const credential = await Credential.findById(campaign.credentialId);
      const decryptedCreds = credential ? credential.getDecrypted() : null;

      if (decryptedCreds) {
        // S3 / DO / B2 / R2
        if (['aws_s3', 'digital_ocean', 'backblaze', 'cloudflare_r2'].includes(platform)) {
           await deleteFromS3(
             website.subdomain, 
             { ...decryptedCreds, platform }, 
             campaign.bucketName, 
             campaign.rootFolder
           );
        }
        // NETLIFY
        else if (platform === 'netlify') {
           // We need siteId. If you saved it in Website model, use it.
           // Assuming you added 'siteId' to Website model:
           if (website.siteId) {
             await deleteFromNetlify(website.siteId, decryptedCreds.netlifyAccessToken);
           }
        }
      }
    }

    // 4. Delete Record from DB
    await website.deleteOne();

    res.json({ msg: 'Website deleted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error during deletion' });
  }
});

module.exports = router;
