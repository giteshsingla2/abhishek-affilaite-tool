const mongoose = require('mongoose');

const StaticTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['review', 'listicle', 'vsl', 'comparison', 'advertorial'],
    required: true,
  },
  thumbnailUrl: {
    type: String,
    default: '',
  },
  htmlContent: {
    type: String,
    required: true, // full HTML with {{slot_key}} placeholders
  },
  jsonPrompt: {
    type: String,
    required: true, // prompt for AI to return JSON, contains {{csv_column}} placeholders
  },
  requiredCsvHeaders: {
    type: [String],
    default: [],
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('StaticTemplate', StaticTemplateSchema, 'static_templates');
