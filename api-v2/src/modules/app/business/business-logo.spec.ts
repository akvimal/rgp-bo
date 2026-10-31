import { checkLogo, LOGO_MAX_BYTES } from './business-logo';

const png = (extra = 0) => 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20 + extra)]).toString('base64');

describe('business logo', () => {
  it('no logo, or an empty one, removes it', () => {
    expect(checkLogo(null)).toEqual({ ok: true, logo: null });
    expect(checkLogo('')).toEqual({ ok: true, logo: null });
  });
  it('accepts a PNG, a JPEG and a WebP', () => {
    expect(checkLogo(png()).ok).toBe(true);
    expect(checkLogo('data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString('base64')).ok).toBe(true);
    expect(checkLogo('data:image/webp;base64,' + Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]).toString('base64')).ok).toBe(true);
  });
  it('refuses an SVG, a GIF and anything that is not a data URL', () => {
    expect(checkLogo('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=').ok).toBe(false);
    expect(checkLogo('data:image/gif;base64,R0lGODlh').ok).toBe(false);
    expect(checkLogo('https://example.com/logo.png').ok).toBe(false);
    expect(checkLogo(42).ok).toBe(false);
  });
  it('refuses a file that only claims to be a picture', () => {
    const r = checkLogo('data:image/png;base64,' + Buffer.from('this is plain text, not a PNG').toString('base64'));
    expect(r).toEqual({ ok: false, error: 'That file is not really a picture of that kind.' });
  });
  it('refuses one over the size limit', () => {
    const r = checkLogo(png(LOGO_MAX_BYTES));
    expect(r.ok).toBe(false);
  });
});
