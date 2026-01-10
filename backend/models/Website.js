const mongoose = require('mongoose');

const WebsiteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Pending', 'Live', 'Failed'],
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Website', WebsiteSchema);
