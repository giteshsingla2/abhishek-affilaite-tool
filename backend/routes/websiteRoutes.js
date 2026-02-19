const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/authMiddleware');
const Website = require('../models/Website');
const Campaign = require('../models/Campaign');
const Credential = require('../models/Credential');
const { deleteFromS3, uploadToS3 } = require('../services/uploaders/s3Adapter');
const { deleteFromNetlify, uploadToNetlify } = require('../services/uploaders/netlifyAdapter');

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
      const domainName = website.domain; // Use website.domain instead of campaign
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

// @route   GET api/websites/:id
// @desc    Get a single website by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }

    // Ensure user owns this website
    if (website.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    res.json(website);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/websites/:id
// @desc    Update website headerCode field
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }

    // Ensure user owns this website
    if (website.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    // Update only the headerCode field
    website.headerCode = req.body.headerCode;
    await website.save();

    res.json(website);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/websites/:id/redeploy
// @desc    Redeploy website with updated headerCode
// @access  Private
router.post('/:id/redeploy', auth, async (req, res) => {
  try {
    // 1. Find Website
    const website = await Website.findById(req.params.id);
    
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }

    // Ensure user owns this website
    if (website.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    // 2. Fetch Campaign and Credential
    const campaign = await Campaign.findById(website.campaignId);
    if (!campaign) {
      return res.status(404).json({ msg: 'Campaign not found' });
    }

    // 3. Inject headerCode into htmlContent
    let updatedHtmlContent = website.htmlContent;
    
    // If headerCode exists, inject it before </head>
    if (website.headerCode) {
      updatedHtmlContent = updatedHtmlContent.replace('</head>', `${website.headerCode}\n</head>`);
    }

    // 4. Redeploy based on platform
    const platform = website.platform;
    let deployResult;

    // --- CUSTOM DOMAIN (Local Server) ---
    if (platform === 'custom_domain') {
      const domainName = campaign?.domainName;
      const subDomain = website.subdomain;
      
      if (domainName && subDomain) {
        const localPath = path.join(USER_SITES_BASE_DIR, domainName, subDomain);
        const indexPath = path.join(localPath, 'index.html');
        
        // Ensure directory exists
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath, { recursive: true });
        }
        
        // Write updated HTML to file
        fs.writeFileSync(indexPath, updatedHtmlContent);
        console.log(`Redeployed to local folder: ${indexPath}`);
        
        deployResult = { 
          success: true, 
          url: website.url // Keep the same URL
        };
      } else {
        return res.status(400).json({ msg: 'Missing domain information for custom domain deployment' });
      }
    }
    
    // --- CLOUD PLATFORMS ---
    else if (campaign && campaign.credentialId) {
      const credential = await Credential.findById(campaign.credentialId);
      const decryptedCreds = credential ? credential.getDecrypted() : null;

      if (!decryptedCreds) {
        return res.status(400).json({ msg: 'Missing or invalid credentials' });
      }

      // S3 / DO / B2 / R2
      if (['aws_s3', 'digital_ocean', 'backblaze', 'cloudflare_r2'].includes(platform)) {
        deployResult = await uploadToS3(
          updatedHtmlContent, 
          website.subdomain, 
          { ...decryptedCreds, platform }, 
          campaign
        );
      }
      // NETLIFY
      else if (platform === 'netlify') {
        if (website.siteId) {
          // For Netlify, we need to use the existing siteId
          deployResult = await uploadToNetlify(
            updatedHtmlContent,
            website.subdomain,
            decryptedCreds,
            website.siteId // Pass the existing siteId
          );
        } else {
          return res.status(400).json({ msg: 'Missing site ID for Netlify redeployment' });
        }
      } else {
        return res.status(400).json({ msg: `Unsupported platform: ${platform}` });
      }
    } else {
      return res.status(400).json({ msg: 'Missing campaign or credential information' });
    }

    // 5. Update website with new deployment info if needed
    if (deployResult && deployResult.success) {
      // We don't need to update the URL as we're redeploying to the same location
      website.status = 'Live';
      await website.save();
      
      return res.json({
        success: true,
        website,
        message: 'Website redeployed successfully'
      });
    } else {
      website.status = 'Failed';
      await website.save();
      
      return res.status(500).json({
        success: false,
        error: deployResult?.error || 'Deployment failed',
        message: 'Website redeployment failed'
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error during redeployment', error: err.message });
  }
});

module.exports = router;
