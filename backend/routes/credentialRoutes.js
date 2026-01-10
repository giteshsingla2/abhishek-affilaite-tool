const express = require('express');
const router = express.Router();
const { addCredential, getCredentials, deleteCredential } = require('../controllers/credentialController');
const auth = require('../middleware/authMiddleware');

// @route   POST api/credentials
// @desc    Add a new credential
// @access  Private
router.post('/', auth, addCredential);

// @route   GET api/credentials
// @desc    Get user credentials
// @access  Private
router.get('/', auth, getCredentials);

// @route   DELETE api/credentials/:id
// @desc    Delete a credential
// @access  Private
router.delete('/:id', auth, deleteCredential);

module.exports = router;
