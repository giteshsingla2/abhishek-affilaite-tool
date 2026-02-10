const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const CredentialSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    enum: ['aws_s3', 'digital_ocean', 'netlify', 'backblaze', 'cloudflare_r2', 'custom_domain'],
    required: true,
  },
  // AWS S3 / DigitalOcean Spaces / Backblaze B2 / Cloudflare R2
  accessKey: { type: String },
  secretKey: { type: String },
  region: { type: String },
  // Cloudflare R2 specific
  accountId: { type: String },
  cdnUrl: { type: String },
  // Netlify
  netlifyAccessToken: { type: String },
  siteId: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Encrypt sensitive fields before saving
CredentialSchema.pre('save', function (next) {
  const fieldsToEncrypt = ['accessKey', 'secretKey', 'netlifyAccessToken', 'accountId'];
  fieldsToEncrypt.forEach(field => {
    if (this.isModified(field) && this[field]) {
      this[field] = encrypt(this[field]);
    }
  });
  next();
});

// Method to decrypt fields (use with caution)
CredentialSchema.methods.getDecrypted = function () {
  const decrypted = { ...this.toObject() };
  const fieldsToDecrypt = ['accessKey', 'secretKey', 'netlifyAccessToken', 'accountId'];
  fieldsToDecrypt.forEach(field => {
    if (decrypted[field]) {
      decrypted[field] = decrypt(decrypted[field]);
    }
  });
  return decrypted;
};

module.exports = mongoose.model('Credential', CredentialSchema);
