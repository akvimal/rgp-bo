import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** The key that locks stored customer keys: from the control plane's own secret, so a copy of the database alone shows nothing. */
function lockKey(): Buffer {
  return createHash('sha256').update(`stored-keys:${process.env.ADMIN_JWT_SECRET || 'change-me'}`).digest();
}

/** AES-256-GCM: "iv.tag.data", each base64. Every call gives a different text for the same key. */
export function lock(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', lockKey(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

/** The key back; null if the text was changed or was locked with another secret. */
export function unlock(text: string | null | undefined): string | null {
  if (!text) return null;
  try {
    const [iv, tag, data] = text.split('.').map((x) => Buffer.from(x, 'base64'));
    const d = createDecipheriv('aes-256-gcm', lockKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** What a key looks like when written into an env file: letters, digits and a few signs only (no spaces, quotes, $ or line breaks). */
export const KEY_SHAPE = /^[A-Za-z0-9._\-]{16,300}$/;
