const mongoose = require('mongoose');

const StaticWebsiteSchema = new mongoose.Schema({
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
  staticTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StaticTemplate',
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  subdomain: {
    type: String,
    default: '',
  },
  domain: {
    type: String,
    default: '',
  },
  platform: {
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
  generatedJson: {
    type: mongoose.Schema.Types.Mixed,
    default: {}, // Raw AI JSON for content injection
  },
  headerCode: {
    type: String,
    default: '',
  },
  siteId: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('StaticWebsite', StaticWebsiteSchema, 'static_websites');
