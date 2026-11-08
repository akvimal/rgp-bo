import * as crypto from 'crypto';

/** The AI key is kept encrypted in the database (AES-256-GCM); the secret that opens it lives only in the server's environment. */
const secretKey = (): Buffer => crypto.createHash('sha256').update('ai-key|' + String(process.env.JWT_KEY || 'dev-only-secret')).digest();

export function encryptKey(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

/** the key, or null when the stored text is damaged or was sealed with another secret */
export function decryptKey(sealed: string | null | undefined): string | null {
  try {
    const [iv, tag, enc] = String(sealed || '').split('.').map((s) => Buffer.from(s, 'base64'));
    if (!iv || !tag || !enc) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch { return null; }
}

/** the last characters of a key, to recognise it by; never the whole key */
export const keyHint = (key: string): string => (key.length > 8 ? '...' + key.slice(-4) : '');

/** a key as pasted: no spaces or quotes; a plausible length */
export function cleanKey(v: any): string | null {
  const k = String(v ?? '').trim().replace(/^["']|["']$/g, '');
  return k.length >= 20 && k.length <= 300 && /^[\x21-\x7e]+$/.test(k) ? k : null;
}
