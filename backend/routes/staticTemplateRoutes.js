const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const StaticTemplate = require('../models/StaticTemplate');

// @route   GET /api/static-templates
// @desc    Get all templates (public)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const full = req.query.full === 'true';
    const selectFields = full ? '' : '-htmlContent';
    const templates = await StaticTemplate.find().select(selectFields).sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/static-templates/:id
// @desc    Get single template (public)
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const template = await StaticTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }
    res.json(template);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Template not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/static-templates
// @desc    Create new template
// @access  Private (Admin)
router.post('/', [auth, admin], async (req, res) => {
  const { name, category, thumbnailUrl, htmlContent, jsonPrompt, requiredCsvHeaders } = req.body;

  try {
    const newTemplate = new StaticTemplate({
      name,
      category,
      thumbnailUrl,
      htmlContent,
      jsonPrompt,
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

// @route   PUT /api/static-templates/:id
// @desc    Update template
// @access  Private (Admin, Owner only)
router.put('/:id', [auth, admin], async (req, res) => {
  const { name, category, thumbnailUrl, htmlContent, jsonPrompt, requiredCsvHeaders } = req.body;

  try {
    let template = await StaticTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }

    // Check ownership
    if (template.addedBy.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to edit this template' });
    }

    // Update fields
    if (name) template.name = name;
    if (category) template.category = category;
    if (thumbnailUrl !== undefined) template.thumbnailUrl = thumbnailUrl;
    if (htmlContent) template.htmlContent = htmlContent;
    if (jsonPrompt) template.jsonPrompt = jsonPrompt;
    if (requiredCsvHeaders) template.requiredCsvHeaders = requiredCsvHeaders;

    await template.save();
    res.json(template);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/static-templates/:id
// @desc    Delete template
// @access  Private (Admin, Owner only)
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    let template = await StaticTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }

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

module.exports = router;
