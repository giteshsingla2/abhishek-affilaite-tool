const Credential = require('../models/Credential');

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

module.exports = { addCredential, getCredentials, deleteCredential };
