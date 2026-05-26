import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/** AES-GCM 加密，返回 base64(iv+ciphertext+tag) */
export function encryptSecret(plain: string, secretKey: string): string {
  if (!plain) {
    return '';
  }
  const key = deriveKey(secretKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/** 解密 encryptSecret 产物；非加密格式则原样返回（兼容历史明文） */
export function decryptSecret(encoded: string, secretKey: string): string {
  if (!encoded) {
    return '';
  }
  try {
    const buf = Buffer.from(encoded, 'base64');
    if (buf.length < IV_LEN + 16 + 1) {
      return encoded;
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + 16);
    const data = buf.subarray(IV_LEN + 16);
    const decipher = createDecipheriv(ALGO, deriveKey(secretKey), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return encoded;
  }
}
