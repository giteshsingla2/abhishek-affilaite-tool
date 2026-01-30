const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const User = require('../models/User');
const Template = require('../models/Template');
const bcrypt = require('bcryptjs');

// @route   POST api/admin/templates
// @desc    Create a new template
// @access  Admin
router.post('/templates', [auth, admin], async (req, res) => {
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
// @desc    Get templates added by the current admin
// @access  Admin
router.get('/templates', [auth, admin], async (req, res) => {
  try {
    const templates = await Template.find({ addedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/templates/:id
// @desc    Update a template (only if owner)
// @access  Admin
router.put('/templates/:id', [auth, admin], async (req, res) => {
  let { name, thumbnailUrl, systemPrompt, requiredCsvHeaders } = req.body;

  // If requiredCsvHeaders is a string, split it into an array
  if (typeof requiredCsvHeaders === 'string') {
    requiredCsvHeaders = requiredCsvHeaders.split(',').map((h) => h.trim()).filter((h) => h !== '');
  }

  try {
    let template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ msg: 'Template not found' });

    // Check ownership
    if (template.addedBy.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to edit this template' });
    }

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
// @desc    Delete a template (only if owner)
// @access  Admin
router.delete('/templates/:id', [auth, admin], async (req, res) => {
  try {
    let template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ msg: 'Template not found' });

    // Check ownership
    if (template.addedBy.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to delete this template' });
    }

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
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/admin/users
// @desc    Create a new user or admin
// @access  Admin
router.post('/users', [auth, admin], async (req, res) => {
  const { email, password, role } = req.body;

  try {
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
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Prevent deleting self
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ msg: 'Cannot delete yourself' });
    }

    await user.deleteOne();
    res.json({ msg: 'User removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
