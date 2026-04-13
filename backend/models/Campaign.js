const mongoose = require('mongoose');

const FailedRowSchema = new mongoose.Schema({
  row: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String },
}, { _id: false });

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
    enum: ['pending', 'processing', 'queuing', 'completed', 'failed'],
    default: 'pending',
  },
  campaignType: {
    type: String,
    enum: ['ai', 'static'],
    default: 'ai',
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
  },
  staticTemplateId: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'StaticTemplate' }
  ],
  bucketName: { type: String },
  rootFolder: { type: String },
  model: { type: String },
  useDynamicDomain: { type: Boolean, default: false },

  // CSV processing fields
  csvFilePath: { type: String, default: '' },
  totalJobs: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  failedJobs: { type: Number, default: 0 },
  failedRows: { type: [FailedRowSchema], default: [] },
  errorMessage: { type: String, default: '' },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

CampaignSchema.index({ userId: 1, createdAt: -1 });
CampaignSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
