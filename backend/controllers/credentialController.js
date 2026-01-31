const Credential = require('../models/Credential');
const { listBuckets, listFolders } = require('../services/uploaders/s3Adapter');

// @desc    Add a new credential
// @route   POST /api/credentials
// @access  Private
const addCredential = async (req, res) => {
  const { name, platform, ...platformSpecificFields } = req.body;

  try {
    const newCredential = new Credential({
      userId: req.user.id,
      name,
      platform,
      ...platformSpecificFields,
    });

    const credential = await newCredential.save();
    res.json(credential);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get user credentials
// @route   GET /api/credentials
// @access  Private
const getCredentials = async (req, res) => {
  try {
    const credentials = await Credential.find({ userId: req.user.id }).select('-accessKey -secretKey -netlifyAccessToken');
    res.json(credentials);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Delete a credential
// @route   DELETE /api/credentials/:id
// @access  Private
const deleteCredential = async (req, res) => {
  try {
    let credential = await Credential.findById(req.params.id);

    if (!credential) {
      return res.status(404).json({ msg: 'Credential not found' });
    }

    // Make sure user owns credential
    if (credential.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await credential.deleteOne();

    res.json({ msg: 'Credential removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get S3 buckets for a credential
// @route   GET /api/credentials/:id/buckets
// @access  Private
const getBuckets = async (req, res) => {
  try {
    const credentialDoc = await Credential.findById(req.params.id);
    if (!credentialDoc) {
      return res.status(404).json({ msg: 'Credential not found' });
    }

    if (credentialDoc.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (!['aws_s3', 'digital_ocean', 'backblaze', 'cloudflare_r2'].includes(credentialDoc.platform)) {
      return res.status(400).json({ msg: 'Bucket listing only supported for S3-compatible platforms' });
    }

    const credential = credentialDoc.getDecrypted();
    console.log(`[DEBUG] getBuckets - Decrypted Credential:`, {
      id: credentialDoc._id,
      platform: credentialDoc.platform,
      region: credential.region,
      accountId: credential.accountId,
      hasAccessKey: !!credential.accessKey,
      hasSecretKey: !!credential.secretKey
    });
    
    try {
      const buckets = await listBuckets(credential);
      res.json(buckets);
    } catch (s3Err) {
      console.error('[ERROR] S3 SDK Error in getBuckets:', s3Err);
      res.status(500).json({ 
        msg: 'S3 SDK error occurred', 
        error: s3Err.message,
        code: s3Err.name || 'S3_SDK_ERROR',
        details: s3Err.$metadata || null
      });
    }
  } catch (err) {
    console.error('[ERROR] in getBuckets:', err);
    res.status(500).json({ 
      msg: 'Failed to fetch buckets', 
      error: err.message,
      code: err.name || 'UNKNOWN_ERROR'
    });
  }
};

// @desc    Get S3 folders (CommonPrefixes) for a bucket
// @route   GET /api/credentials/:id/folders
// @access  Private
const getFolders = async (req, res) => {
  const { bucketName, prefix } = req.query;

  try {
    const credentialDoc = await Credential.findById(req.params.id);
    if (!credentialDoc) {
      return res.status(404).json({ msg: 'Credential not found' });
    }

    if (credentialDoc.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (!['aws_s3', 'digital_ocean', 'backblaze', 'cloudflare_r2'].includes(credentialDoc.platform)) {
      return res.status(400).json({ msg: 'Folder listing only supported for S3-compatible platforms' });
    }

    if (!bucketName) {
      return res.status(400).json({ msg: 'bucketName is required' });
    }

    const credential = credentialDoc.getDecrypted();
    console.log(`[DEBUG] getFolders - Decrypted Credential:`, {
      id: credentialDoc._id,
      platform: credentialDoc.platform,
      region: credential.region,
      accountId: credential.accountId,
      hasAccessKey: !!credential.accessKey,
      hasSecretKey: !!credential.secretKey,
      bucketName,
      prefix
    });

    try {
      const folders = await listFolders(credential, bucketName, prefix || "");
      res.json(folders);
    } catch (s3Err) {
      console.error('[ERROR] S3 SDK Error in getFolders:', s3Err);
      res.status(500).json({ 
        msg: 'S3 SDK error occurred', 
        error: s3Err.message,
        code: s3Err.name || 'S3_SDK_ERROR',
        details: s3Err.$metadata || null
      });
    }
  } catch (err) {
    console.error('[ERROR] in getFolders:', err);
    res.status(500).json({ 
      msg: 'Failed to fetch folders', 
      error: err.message,
      code: err.name || 'UNKNOWN_ERROR'
    });
  }
};

module.exports = {
  addCredential,
  getCredentials,
  deleteCredential,
  getBuckets,
  getFolders,
};
