const fs = require('fs');
const path = require('path');

const CSV_UPLOAD_DIR = process.env.CSV_UPLOAD_DIR || '/tmp/campaigns';

const ensureUploadDir = () => {
  if (!fs.existsSync(CSV_UPLOAD_DIR)) {
    fs.mkdirSync(CSV_UPLOAD_DIR, { recursive: true });
  }
  return CSV_UPLOAD_DIR;
};

module.exports = { ensureUploadDir, CSV_UPLOAD_DIR };
