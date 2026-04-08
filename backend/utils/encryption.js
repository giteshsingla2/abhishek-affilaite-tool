const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

// Key and IV should be stored securely in environment variables
// The key must be 32 bytes (256 bits) and the IV must be 16 bytes for AES-256-CBC
const secret = process.env.CRYPTO_SECRET || 'default_secret_must_be_32_bytes_long';

// Create a 32-byte key from the secret
const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);

// Legacy static IV for backward compatibility
const staticIv = Buffer.alloc(16, 0);

const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Prepend IV to ciphertext as hex: "ivHex:ciphertext"
  return `${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (encryptedText) => {
  try {
    if (!encryptedText) return '';

    let ivToUse;
    let dataToDecrypt;

    if (encryptedText.includes(':')) {
      const parts = encryptedText.split(':');
      ivToUse = Buffer.from(parts[0], 'hex');
      dataToDecrypt = parts[1];
    } else {
      // Fallback: if the stored value does not contain ":", attempt decryption with the old static IV
      console.warn('[WARNING] Decryption using legacy static IV fallback. Please re-save this credential to update encryption.');
      ivToUse = staticIv;
      dataToDecrypt = encryptedText;
    }

    const decipher = crypto.createDecipheriv(algorithm, key, ivToUse);
    let decrypted = decipher.update(dataToDecrypt, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[ERROR] Decryption failed:', err.message);
    return ''; // Return empty string or handle as needed
  }
};

module.exports = { encrypt, decrypt };
