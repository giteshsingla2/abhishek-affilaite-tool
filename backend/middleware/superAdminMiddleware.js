const User = require('../models/User');

module.exports = async function(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ msg: 'No user found, authorization denied' });
    }

    const user = await User.findById(req.user.id);

    if (user && user.role === 'superadmin') {
      next();
    } else {
      res.status(403).json({ msg: 'Access denied. Super Admin role required.' });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server error during super admin check' });
  }
};
