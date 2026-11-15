// Encrypts marketplace credentials before they go into Redis.
//
// AES-256-GCM with a key derived (HKDF) from CONNECTIONS_SECRET, or from
// SESSION_SECRET when that isn't set. The Steam ID is bound in as associated
// data, so a sealed blob copied into another user's record fails to open.
//
// Changing the secret makes every stored key unreadable: users then see
// "Reconnect" and paste their key again. Nothing else breaks.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const VERSION = 'v1';

function key() {
  const raw = process.env.CONNECTIONS_SECRET || process.env.SESSION_SECRET;
  if (!raw) throw new Error('CONNECTIONS_SECRET (or SESSION_SECRET) env var is not set');
  return Buffer.from(hkdfSync('sha256', raw, 'skinroi', 'marketplace-connections-v1', 32));
}

export function seal(value, steamId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(String(steamId)));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

// Returns the original value, or null when the blob can't be opened (wrong
// secret, wrong user, tampered).
export function open(sealed, steamId) {
  try {
    const [version, iv, tag, data] = String(sealed).split('.');
    if (version !== VERSION || !iv || !tag || !data) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(String(steamId)));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    return null;
  }
}
