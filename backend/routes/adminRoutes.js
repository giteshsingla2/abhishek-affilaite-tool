const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const Template = require('../models/Template');

// @route   POST api/admin/templates
// @desc    Create a new template
// @access  Admin
router.post('/templates', [auth, admin], async (req, res) => {
  const { name, thumbnailUrl, systemPrompt } = req.body;

  try {
    const newTemplate = new Template({
      name,
      thumbnailUrl,
      systemPrompt,
    });

    const template = await newTemplate.save();
    res.json(template);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/templates/:id
// @desc    Update a template
// @access  Admin
router.put('/templates/:id', [auth, admin], async (req, res) => {
  const { name, thumbnailUrl, systemPrompt } = req.body;

  try {
    let template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ msg: 'Template not found' });

    template.name = name || template.name;
    template.thumbnailUrl = thumbnailUrl || template.thumbnailUrl;
    template.systemPrompt = systemPrompt || template.systemPrompt;

    await template.save();
    res.json(template);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/admin/templates/:id
// @desc    Delete a template
// @access  Admin
router.delete('/templates/:id', [auth, admin], async (req, res) => {
  try {
    let template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ msg: 'Template not found' });

    await template.remove();
    res.json({ msg: 'Template removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
