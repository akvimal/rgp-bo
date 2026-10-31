/** The business logo is kept as a small image data URL; this checks one before it is stored. Pure, so it is tested without a database. */
export const LOGO_MAX_BYTES = 60 * 1024;   // the API accepts a 100 KB request body, and base64 adds a third

const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/png': (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};

/** null or an empty value removes the logo; anything else must be a real PNG, JPEG or WebP of at most 60 KB. SVG is refused: it can carry scripts. */
export function checkLogo(value: any): { ok: true; logo: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') return { ok: true, logo: null };
  if (typeof value !== 'string') return { ok: false, error: 'The logo is not a picture.' };
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!m) return { ok: false, error: 'Use a PNG, JPEG or WebP picture.' };
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > LOGO_MAX_BYTES) return { ok: false, error: `The logo is ${Math.ceil(bytes.length / 1024)} KB; keep it under ${LOGO_MAX_BYTES / 1024} KB.` };
  if (!SIGNATURES[m[1]](bytes)) return { ok: false, error: 'That file is not really a picture of that kind.' };
  return { ok: true, logo: value };
}
