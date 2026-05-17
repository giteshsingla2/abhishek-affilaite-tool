const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const Website = require('../models/Website');
const Campaign = require('../models/Campaign');
const Credential = require('../models/Credential');
const { deleteFromS3, uploadToS3 } = require('../services/uploaders/s3Adapter');
const { deleteFromNetlify, uploadToNetlify } = require('../services/uploaders/netlifyAdapter');

const USER_SITES_BASE_DIR = process.env.USER_SITES_BASE_DIR || '/var/www/user_sites';

/**
 * Strips any previously injected tracking scripts wrapped in our custom
 * comment boundaries, returning a clean base HTML document.
 */
function cleanHtmlContent(html) {
  if (!html) return '';
  // This regex safely strips out any previously injected scripts between our custom comments
  return html.replace(/[\s\S]*?<\/noscript>[\s\S]*?-->|<!--\s*TRACKING_START[\s\S]*?TRACKING_END\s*-->[\s\S]*?/gi, '').trim();
}

// @route   GET api/websites
// @desc    Get all websites for a user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [websites, total] = await Promise.all([
      Website.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('productName status url createdAt platform subdomain domain siteId headerCode htmlContent')
        .lean(),
      Website.countDocuments({ userId: req.user.id })
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
// @desc    Get a single website by ID (fetch-on-demand: live HTML if DB is empty)
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

    // Fetch-on-Demand: if htmlContent is not stored in DB, fetch live from deployed URL
    let htmlContent = website.htmlContent;
    if (!htmlContent && website.url) {
      console.log(`[FETCH_ON_DEMAND] htmlContent missing for website ${website._id}, fetching from: ${website.url}`);
      const liveResponse = await axios.get(website.url, { timeout: 15000 });
      htmlContent = cleanHtmlContent(liveResponse.data);
    }

    // Return the website document merged with the resolved (clean) htmlContent
    const websiteObj = website.toObject();
    websiteObj.htmlContent = htmlContent;

    res.json(websiteObj);
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
// @desc    Redeploy website — fetches live HTML, strips old tracking, re-injects fresh headerCode
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

    // 3. Fetch live HTML directly from the deployed URL (Fetch-on-Demand)
    if (!website.url) {
      return res.status(400).json({ msg: 'Website does not have a deployed URL to fetch from' });
    }

    console.log(`[REDEPLOY] Fetching live HTML from: ${website.url}`);
    const liveResponse = await axios.get(website.url, { timeout: 15000 });
    const fetchedHtml = liveResponse.data;

    // 4. Clean old tracking injections from fetched HTML
    const cleanHtml = cleanHtmlContent(fetchedHtml);

    // 5. Re-inject the current headerCode using comment boundary wrappers
    let updatedHtmlContent = cleanHtml;
    if (website.headerCode) {
      updatedHtmlContent = cleanHtml.replace('</head>', '\n\n' + website.headerCode + '\n\n</head>');
    }

    // 6. Redeploy based on platform
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
        console.log(`[REDEPLOY] Written to local path: ${indexPath}`);

        deployResult = {
          success: true,
          url: website.url, // Keep the same URL
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
          deployResult = await uploadToNetlify(
            updatedHtmlContent,
            website.subdomain,
            decryptedCreds,
            website.siteId // Pass existing siteId to update in-place
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

    // 7. Save metadata update — keep htmlContent empty (storage optimization)
    if (deployResult && deployResult.success) {
      website.status = 'Live';
      website.htmlContent = ''; // Fetch-on-Demand: never persist raw HTML in MongoDB
      await website.save();

      return res.json({
        success: true,
        website,
        message: 'Website redeployed successfully',
      });
    } else {
      website.status = 'Failed';
      await website.save();

      return res.status(500).json({
        success: false,
        error: deployResult?.error || 'Deployment failed',
        message: 'Website redeployment failed',
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error during redeployment', error: err.message });
  }
});

module.exports = router;
