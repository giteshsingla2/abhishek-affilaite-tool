const express = require('express');
const router = express.Router();

const Template = require('../models/Template');

// @route   GET /api/templates
// @desc    List templates
// @access  Public
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find({}).sort({ createdAt: -1 });
    return res.json(templates);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/templates/seed
// @desc    Seed 3 default templates (idempotent by name)
// @access  Public
router.post('/seed', async (req, res) => {
  try {
    const defaults = [
      {
        name: 'Minimalist Review',
        thumbnailUrl: '',
        systemPrompt:
          'Create a clean, white-space heavy review site. Use a minimalist aesthetic, subtle borders, and clear typography. Prioritize readability and trust. Include product hero, pros/cons, key features, review summary, and a strong call-to-action.',
      },
      {
        name: 'High Energy Sales',
        thumbnailUrl: '',
        systemPrompt:
          'Create a bold, urgent sales page with high contrast sections, strong headlines, and urgency elements (like red countdown timers). Use energetic design patterns, punchy copy, and repeated calls-to-action. The tone should feel exciting and time-sensitive.',
      },
      {
        name: 'Info-Article Style',
        thumbnailUrl: '',
        systemPrompt:
          'Create an educational blog post style page. Use an editorial layout with headings, reading-friendly spacing, and informative sections. Teach the reader, build credibility, and naturally transition to an affiliate recommendation with a compelling call-to-action.',
      },
    ];

    const results = [];

    for (const t of defaults) {
      const existing = await Template.findOne({ name: t.name });
      if (existing) {
        results.push({ name: t.name, action: 'skipped', id: existing._id });
        continue;
      }
      const created = await Template.create(t);
      results.push({ name: t.name, action: 'inserted', id: created._id });
    }

    return res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
