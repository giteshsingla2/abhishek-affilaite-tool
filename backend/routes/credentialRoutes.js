const express = require('express');
const router = express.Router();
const { addCredential, getCredentials, deleteCredential, getBuckets, getFolders } = require('../controllers/credentialController');
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

// @route   GET api/credentials/:id/buckets
// @desc    Get S3 buckets for a credential
// @access  Private
router.get('/:id/buckets', auth, getBuckets);

// @route   GET api/credentials/:id/folders
// @desc    Get S3 folders for a bucket
// @access  Private
router.get('/:id/folders', auth, getFolders);

module.exports = router;
