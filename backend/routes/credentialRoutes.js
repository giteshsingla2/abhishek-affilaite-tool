const express = require('express');
const router = express.Router();
const { addCredential, getCredentials, deleteCredential, getBuckets, getFolders } = require('../controllers/credentialController');
const auth = require('../middleware/authMiddleware');

const { body } = require('express-validator');
const validate = require('../middleware/validate');

// @route   POST api/credentials
// @desc    Add a new credential
// @access  Private
router.post('/', [
    auth,
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('platform').isIn(['aws_s3', 'digital_ocean', 'netlify', 'backblaze', 'cloudflare_r2']).withMessage('Invalid platform'),
    body('accessKey').if(body('platform').isIn(['aws_s3', 'digital_ocean', 'backblaze', 'cloudflare_r2'])).notEmpty().withMessage('accessKey is required'),
    body('secretKey').if(body('platform').isIn(['aws_s3', 'digital_ocean', 'backblaze', 'cloudflare_r2'])).notEmpty().withMessage('secretKey is required'),
    body('region').if(body('platform').isIn(['aws_s3', 'digital_ocean', 'backblaze'])).notEmpty().withMessage('region is required'),
    body('accountId').if(body('platform').equals('cloudflare_r2')).notEmpty().withMessage('accountId is required'),
    body('netlifyAccessToken').if(body('platform').equals('netlify')).notEmpty().withMessage('netlifyAccessToken is required'),
    validate
], addCredential);

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
