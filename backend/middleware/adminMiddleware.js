const User = require('../models/User');

module.exports = async function(req, res, next) {
  try {
    // The auth middleware should have already attached the user object
    if (!req.user) {
      return res.status(401).json({ msg: 'No user found, authorization denied' });
    }

    // Find the full user document to check the role
    const user = await User.findById(req.user.id);

    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server error during admin check' });
  }
};
