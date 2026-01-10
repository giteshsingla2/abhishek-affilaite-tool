const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getStats } = require('../controllers/dashboardController');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', auth, getStats);

module.exports = router;
