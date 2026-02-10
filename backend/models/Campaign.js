const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
  },
  platform: {
    type: String,
    enum: ['aws_s3', 'digital_ocean', 'netlify', 'backblaze', 'cloudflare_r2', 'custom_domain'],
    required: true,
  },
  credentialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Credential',
    required: function() { return this.platform !== 'custom_domain'; },
  },
  domainName: { type: String },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    required: true,
  },
  bucketName: { type: String },
  rootFolder: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Campaign', CampaignSchema);
