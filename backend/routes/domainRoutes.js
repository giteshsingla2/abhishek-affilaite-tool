const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Domain = require('../models/Domain');

// @route   POST api/domains
// @desc    Add a new domain
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ msg: 'Domain is required' });
    }

    // Check if domain already exists
    let existingDomain = await Domain.findOne({ domain });
    if (existingDomain) {
      return res.status(400).json({ msg: 'Domain already registered' });
    }

    const newDomain = new Domain({
      userId: req.user.id,
      domain
    });

    await newDomain.save();
    res.json(newDomain);
  } catch (err) {
    console.error(err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ msg: err.message });
    }
    res.status(500).send('Server Error');
  }
});

// @route   GET api/domains
// @desc    Get all user's domains
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const domains = await Domain.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(domains);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/domains/:id
// @desc    Delete a domain
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const domain = await Domain.findById(req.params.id);

    if (!domain) {
      return res.status(404).json({ msg: 'Domain not found' });
    }

    // Check user ownership
    if (domain.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await domain.deleteOne();
    res.json({ msg: 'Domain removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


module.exports = router;
