const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Website = require('../models/Website');

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

module.exports = router;
