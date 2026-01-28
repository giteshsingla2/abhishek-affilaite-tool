const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

// Key and IV should be stored securely in environment variables
// The key must be 32 bytes (256 bits) and the IV must be 16 bytes for AES-256-CBC
const secret = process.env.CRYPTO_SECRET || 'default_secret_must_be_32_bytes_long';

// Create a 32-byte key from the secret
const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);

// The IV should be 16 bytes
const iv = Buffer.alloc(16, 0); // Using a static, zero-filled IV for simplicity

const encrypt = (text) => {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

const decrypt = (encryptedText) => {
  try {
    if (!encryptedText) return '';
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[ERROR] Decryption failed:', err.message);
    return ''; // Return empty string or handle as needed
  }
};

module.exports = { encrypt, decrypt };
