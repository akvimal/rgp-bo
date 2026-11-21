import { cleanSources, isFresh, jsonIn, parsePriceAnswer, priceInstruction } from './brand-price-rules';

const src = [{ url: 'https://www.1mg.com/drugs/telmiten-40', title: '1mg' }];
const site = (name: string, pack: number, mrp: number, sell: number | null, url = `https://${name}.example/x`) =>
  ({ site: name, url, pack_text: `strip of ${pack}`, pack_units: pack, mrp, selling_price: sell });
const reply = (listings: any[], note = '') => JSON.stringify({ found: true, listings, note });

describe('brand price answer, site by site', () => {
  it('uses sites that agree, and gives the pack and per-unit figures', () => {
    const a = parsePriceAnswer(reply([site('1mg', 10, 120, 96), site('netmeds', 10, 120, 102)]), src);
    expect(a.found).toBe(true);
    expect([a.packUnits, a.mrp, a.sellMin, a.sellMax]).toEqual([10, 120, 96, 102]);
    expect([a.unitMrp, a.unitSellMin, a.unitSellMax]).toEqual([12, 9.6, 10.2]);
    expect(a.listings.every((l) => l.status === 'used')).toBe(true);
  });

  it('compares per unit, so a strip of 10 and a strip of 15 at the same unit price agree', () => {
    const a = parsePriceAnswer(reply([site('a', 10, 100, 90), site('b', 15, 150, 135)]), src);
    expect(a.listings.map((l) => l.status)).toEqual(['used', 'used']);
    expect(a.unitMrp).toBe(10);
  });

  it('keeps the MRP most sites agree on and marks the odd one out as differing, leaving it out of the figures', () => {
    const a = parsePriceAnswer(reply([site('a', 10, 60, 54), site('b', 10, 60, 55), site('c', 10, 27.05, 25)]), src);
    expect(a.mrp).toBe(60);
    expect([a.sellMin, a.sellMax]).toEqual([54, 55]);
    expect(a.listings.find((l) => l.site === 'c')).toMatchObject({ status: 'differs' });
    expect(a.note).toMatch(/1 of 3 site/);
  });

  it('on a tie takes the higher MRP', () => {
    const a = parsePriceAnswer(reply([site('a', 10, 50, 45), site('b', 10, 60, 54)]), src);
    expect(a.mrp).toBe(60);
  });

  it('marks a site whose selling price is above its own MRP as invalid and uses the rest', () => {
    const a = parsePriceAnswer(reply([site('a', 10, 60, 54), site('b', 10, 60, 90)]), src);
    expect(a.found).toBe(true);
    expect(a.listings.find((l) => l.site === 'b')).toMatchObject({ status: 'invalid', problem: 'selling price is above its own MRP' });
    expect([a.sellMin, a.sellMax]).toEqual([54, 54]);
  });

  it('is not found when no site holds together, and still lists what each said', () => {
    const a = parsePriceAnswer(reply([site('a', 10, 60, 90), site('b', 0, 60, 50)]), src);
    expect(a.found).toBe(false);
    expect(a.listings).toHaveLength(2);
    expect(a.note).toMatch(/No site gave a price that holds together/);
  });

  it('needs a source link', () => {
    expect(parsePriceAnswer(reply([{ ...site('a', 10, 60, 54), url: '' }]), []).found).toBe(false);
    expect(parsePriceAnswer(reply([site('a', 10, 60, 54)]), []).found).toBe(true);    // the site's own page is the source
  });

  it('gives an MRP with no selling price when the sites show none', () => {
    const a = parsePriceAnswer(reply([site('a', 10, 60, null)]), src);
    expect(a).toMatchObject({ found: true, mrp: 60, sellMin: null, sellMax: null, unitMrp: 6 });
  });

  it('reads the older single-answer shape as one site', () => {
    const a = parsePriceAnswer('{"found": true, "pack_units": 10, "mrp": 120, "sell_min": 96, "sell_max": 102}', src);
    expect(a).toMatchObject({ found: true, mrp: 120, packUnits: 10 });
  });

  it('reads JSON in words or a code fence, and prices with a rupee sign', () => {
    expect(jsonIn('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    const a = parsePriceAnswer('Sure! ' + reply([{ site: 'a', url: 'https://a.example', pack_units: 10, mrp: '₹120.50', selling_price: null }]), src);
    expect(a.mrp).toBe(120.5);
  });

  it('is not found when the model says so, or the text is not JSON', () => {
    expect(parsePriceAnswer('{"found": false, "note": "no listing"}', src)).toMatchObject({ found: false, note: 'no listing' });
    expect(parsePriceAnswer('I could not find it', src).found).toBe(false);
  });
});

describe('sources', () => {
  it('keeps http(s) links once each, at most five', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ url: `https://a.example/${i}`, title: 't' }));
    expect(cleanSources([...many, many[0], { url: 'ftp://x' }, { url: '' }, { url: 'javascript:alert(1)' }])).toHaveLength(5);
  });
});

describe('freshness and prompt', () => {
  it('is fresh for 30 days', () => {
    const now = new Date('2026-11-21T00:00:00Z');
    expect(isFresh('2026-11-01T00:00:00Z', now)).toBe(true);
    expect(isFresh('2026-10-01T00:00:00Z', now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });
  it('names the exact brand and composition and asks for each site separately', () => {
    const t = priceInstruction({ brand: 'Telmiten 40 mg oral tablet', composition: 'Telmisartan 40 mg', manufacturer: null, formLabel: 'Tablet' });
    expect(t).toContain('Telmiten 40 mg oral tablet');
    expect(t).toContain('Telmisartan 40 mg');
    expect(t).toContain('listings');
  });
});
