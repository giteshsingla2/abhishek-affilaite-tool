const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const superAdmin = require('../middleware/superAdminMiddleware');
const User = require('../models/User');
const Template = require('../models/Template');
const bcrypt = require('bcryptjs');

// @route   POST api/admin/templates
// @desc    Create a new template
// @access  Admin
router.post('/templates', [auth, superAdmin], async (req, res) => {
  let { name, thumbnailUrl, systemPrompt, requiredCsvHeaders } = req.body;

  // If requiredCsvHeaders is a string, split it into an array
  if (typeof requiredCsvHeaders === 'string') {
    requiredCsvHeaders = requiredCsvHeaders.split(',').map((h) => h.trim()).filter((h) => h !== '');
  }

  try {
    const newTemplate = new Template({
      name,
      thumbnailUrl,
      systemPrompt,
      requiredCsvHeaders,
      addedBy: req.user.id,
    });

    const template = await newTemplate.save();
    res.json(template);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/templates
// @desc    Get templates added by any admin/superadmin (as only superadmin manages them now)
// @access  SuperAdmin
router.get('/templates', [auth, superAdmin], async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/templates/:id
// @desc    Update a template
// @access  SuperAdmin
router.put('/templates/:id', [auth, superAdmin], async (req, res) => {
  let { name, thumbnailUrl, systemPrompt, requiredCsvHeaders } = req.body;

  // If requiredCsvHeaders is a string, split it into an array
  if (typeof requiredCsvHeaders === 'string') {
    requiredCsvHeaders = requiredCsvHeaders.split(',').map((h) => h.trim()).filter((h) => h !== '');
  }

  try {
    let template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ msg: 'Template not found' });

    template.name = name || template.name;
    template.thumbnailUrl = thumbnailUrl || template.thumbnailUrl;
    template.systemPrompt = systemPrompt || template.systemPrompt;
    template.requiredCsvHeaders = requiredCsvHeaders || template.requiredCsvHeaders;

    await template.save();
    res.json(template);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/admin/templates/:id
// @desc    Delete a template
// @access  SuperAdmin
router.delete('/templates/:id', [auth, superAdmin], async (req, res) => {
  try {
    let template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ msg: 'Template not found' });

    await template.deleteOne();
    res.json({ msg: 'Template removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- USER MANAGEMENT ROUTES ---

// @route   GET api/admin/users
// @desc    Get all users
// @access  Admin
router.get('/users', [auth, admin], async (req, res) => {
  try {
    const requestingUser = await User.findById(req.user.id);
    
    let query = {};
    
    if (requestingUser.role === 'superadmin') {
      // Superadmin can see everyone
      query = {};
    } else {
      // Regular admin cannot see superadmin accounts
      query = { role: { $in: ['user', 'admin'] } };
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/admin/users
// @desc    Create a new user or admin
// @access  Admin/SuperAdmin
router.post('/users', [auth, admin], async (req, res) => {
  const { email, password, role } = req.body;

  try {
    // Only superadmin can create admin or superadmin accounts
    const requestingUser = await User.findById(req.user.id);
    
    if ((role === 'admin' || role === 'superadmin') && requestingUser.role !== 'superadmin') {
      return res.status(403).json({ msg: 'Only Super Admins can create admin or super admin accounts.' });
    }

    // Prevent creating superadmin if requester is not superadmin (double check)
    if (role === 'superadmin' && requestingUser.role !== 'superadmin') {
      return res.status(403).json({ msg: 'Only Super Admins can create other Super Admins.' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      email,
      password,
      role: role || 'user',
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/admin/users/:id
// @desc    Delete a user
// @access  Admin
router.delete('/users/:id', [auth, admin], async (req, res) => {
  try {
    const requestingUser = await User.findById(req.user.id);
    const userToDelete = await User.findById(req.params.id);
    
    if (!userToDelete) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Prevent deleting self
    if (userToDelete._id.toString() === req.user.id) {
      return res.status(400).json({ msg: 'Cannot delete yourself' });
    }

    // Regular admin cannot delete superadmin accounts
    if (requestingUser.role !== 'superadmin' && userToDelete.role === 'superadmin') {
      return res.status(403).json({ msg: 'You do not have permission to delete a Super Admin account.' });
    }

    // Regular admin cannot delete other admin accounts either
    if (requestingUser.role !== 'superadmin' && userToDelete.role === 'admin') {
      return res.status(403).json({ msg: 'Only Super Admins can delete Admin accounts.' });
    }

    await userToDelete.deleteOne();
    res.json({ msg: 'User removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/users/:id/overview
// @desc    Get comprehensive overview of a specific user
// @access  Admin/SuperAdmin
router.get('/users/:id/overview', [auth, admin], async (req, res) => {
  try {
    const requestingUser = await User.findById(req.user.id);
    const targetUser = await User.findById(req.params.id).select('-password');

    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Regular admin cannot view superadmin data
    if (requestingUser.role !== 'superadmin' && targetUser.role === 'superadmin') {
      return res.status(403).json({ msg: 'Access denied.' });
    }

    const userId = targetUser._id;

    const [
      credentials,
      domains,
      websites,
      staticWebsites,
      totalWebsitesLive,
      totalWebsitesFailed,
      totalWebsitesPending,
      totalStaticLive,
      totalStaticFailed,
      totalStaticPending,
    ] = await Promise.all([
      require('../models/Credential').find({ userId }).select('-accessKey -secretKey -netlifyAccessToken -accountId').lean(),
      require('../models/Domain').find({ userId }).lean(),
      require('../models/Website').find({ userId }).sort({ createdAt: -1 }).select('productName status url createdAt platform subdomain domain').lean(),
      require('../models/StaticWebsite').find({ userId }).sort({ createdAt: -1 }).select('productName status url createdAt platform subdomain domain staticTemplateId').lean(),
      require('../models/Website').countDocuments({ userId, status: 'Live' }),
      require('../models/Website').countDocuments({ userId, status: 'Failed' }),
      require('../models/Website').countDocuments({ userId, status: 'Pending' }),
      require('../models/StaticWebsite').countDocuments({ userId, status: 'Live' }),
      require('../models/StaticWebsite').countDocuments({ userId, status: 'Failed' }),
      require('../models/StaticWebsite').countDocuments({ userId, status: 'Pending' }),
    ]);

    res.json({
      user: targetUser,
      stats: {
        totalWebsitesLive,
        totalWebsitesFailed,
        totalWebsitesPending,
        totalWebsites: websites.length,
        totalStaticLive,
        totalStaticFailed,
        totalStaticPending,
        totalStaticWebsites: staticWebsites.length,
        totalCredentials: credentials.length,
        totalDomains: domains.length,
      },
      credentials,
      domains,
      websites,
      staticWebsites,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
