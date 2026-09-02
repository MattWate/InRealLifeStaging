import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, options);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const parts = String(encoded || '').split('$');
  const valid = parts.length === 3 && parts[0] === 'scrypt-v1'
    && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  // Always run the KDF, including for unknown accounts.
  const key = await derive(password, valid ? parts[1] : '0'.repeat(32), 64, options);
  const expected = Buffer.from(valid ? parts[2] : '0'.repeat(128), 'hex');
  return timingSafeEqual(key, expected) && valid;
}
