const express = require('express');
const router = express.Router();
const { register, login, logout, refresh } = require('../controllers/authController');

const { body } = require('express-validator');
const validate = require('../middleware/validate');

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', [
    body('email').isEmail().withMessage('Please include a valid email').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
], register);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
    body('email').isEmail().withMessage('Please include a valid email').normalizeEmail(),
    body('password').exists().withMessage('Password is required'),
    validate
], login);

// @route   POST api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', refresh);

// @route   POST api/auth/logout
// @desc    Logout user
// @access  Public
router.post('/logout', logout);

module.exports = router;
