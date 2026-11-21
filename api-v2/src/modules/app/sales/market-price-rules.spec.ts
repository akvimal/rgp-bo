import { marketInstruction, parseMarketAnswer } from './market-price-rules';

const src = [{ url: 'https://www.1mg.com/x', title: '1mg' }];
const L = (brand: string, site: string, pack: number, mrp: number, sell: number | null) => ({ brand, site, url: `https://${site}.example/${brand}`, pack_text: `strip of ${pack}`, pack_units: pack, mrp, selling_price: sell });
const reply = (listings: any[]) => JSON.stringify({ found: true, listings, note: 'n' });
const parse = (listings: any[], sources = src) => parseMarketAnswer(reply(listings), sources, 'Telmisartan 40 mg', 'tablet');

describe('market price answer', () => {
  it('gives the range per unit across brands and sites', () => {
    const a = parse([L('Telma', '1mg', 10, 120, 96), L('Telmiten', 'netmeds', 10, 100, 80), L('Telvas', 'apollo', 15, 210, 168)]);
    expect(a.found).toBe(true);
    expect(a.unitMrp).toEqual({ min: 10, max: 14 });
    expect(a.unitSell).toEqual({ min: 8, max: 11.2, median: 9.6 });
    expect(a.listings.every((l) => l.status === 'used')).toBe(true);
  });
  it('leaves out a listing whose unit price is far from the others, and one whose selling price is above its MRP', () => {
    const a = parse([L('A', 's1', 10, 100, 90), L('B', 's2', 10, 110, 99), L('C', 's3', 10, 120, 100), L('Far', 's4', 10, 2000, 1800), L('Over', 's5', 10, 50, 90)]);
    expect(a.listings.find((l) => l.brand === 'Far')?.status).toBe('differs');
    expect(a.listings.find((l) => l.brand === 'Over')).toMatchObject({ status: 'invalid', problem: 'selling price is above its own MRP' });
    expect(a.unitMrp).toEqual({ min: 10, max: 12 });
    expect(a.note).toMatch(/2 of 5 listing/);
  });
  it('does not drop anything as an outlier with fewer than three valid listings', () => {
    const a = parse([L('A', 's1', 10, 100, 90), L('B', 's2', 10, 1000, 900)]);
    expect(a.listings.every((l) => l.status === 'used')).toBe(true);
  });
  it('gives an MRP range with no selling range when no site shows a selling price', () => {
    const a = parse([L('A', 's1', 10, 100, null)]);
    expect(a).toMatchObject({ found: true, unitSell: null, unitMrp: { min: 10, max: 10 } });
  });
  it('is not found when nothing holds together, there is no source, or the text is not JSON', () => {
    expect(parse([L('A', 's1', 0, 100, 90)]).found).toBe(false);
    expect(parseMarketAnswer(reply([{ ...L('A', 's1', 10, 100, 90), url: '' }]), [], 'x', null).found).toBe(false);
    expect(parseMarketAnswer('no luck', src, 'x', null).found).toBe(false);
    expect(parseMarketAnswer('{"found": false, "note": "none"}', src, 'x', null)).toMatchObject({ found: false, note: 'none' });
  });
  it('asks for the same ingredients, strength and form', () => {
    const t = marketInstruction('Telmisartan 40 mg', 'Tablet');
    expect(t).toContain('Telmisartan 40 mg');
    expect(t).toMatch(/same dosage form/);
  });
});
