import { compositionOfListName, packOf, readPriceList, rowsOfPage, TextPiece } from './price-list-rules';

const piece = (x: number, y: number, str: string): TextPiece => ({ x, y, str });
/** one printed row: Sr, code, the name lines (centred on y), unit and MRP */
function row(sr: number, y: number, name: string[], unit: string, mrp: string): TextPiece[] {
  const top = y + ((name.length - 1) / 2) * 18;
  return [piece(64, y, String(sr)), piece(179, y, String(sr)), ...name.map((l, i) => piece(242, top - i * 18, l)), piece(402, y, unit), piece(512, y, mrp)];
}
const header = [piece(48, 812, 'Sr. No.'), piece(257, 812, 'Generic Name'), piece(387, 812, 'Unit Size'), piece(492, 812, 'MRP (in Rs.)')];

describe('composition of a printed generic name', () => {
  const c = (n: string) => compositionOfListName(n);
  it('reads strengths written after each ingredient', () => {
    expect(c('Aceclofenac 100mg and Paracetamol 325mg Tablets')).toEqual({ composition: 'Aceclofenac 100 mg + Paracetamol 325 mg', form: 'tablet' });
    expect(c('Chlorzoxazone 500mg, Diclofenac 50mg and Paracetamol 325mg Tablets').composition).toBe('Chlorzoxazone 500 mg + Diclofenac 50 mg + Paracetamol 325 mg');
  });
  it('reads the strength that follows the form words', () => {
    expect(c('Aceclofenac Tablets IP 100 mg')).toEqual({ composition: 'Aceclofenac 100 mg', form: 'tablet' });
    expect(c('Pregabalin Capsules IP 75 mg')).toEqual({ composition: 'Pregabalin 75 mg', form: 'capsule' });
  });
  it('knows release forms and drops release words from the ingredient', () => {
    expect(c('Metformin Hydrochloride Prolonged-release 500mg and Glimepiride 2mg Tablets IP')).toMatchObject({ form: 'tablet_sr' });
    expect(c('Amoxycillin Trihydrate Dispersible Tablets IP 125 mg')).toMatchObject({ composition: 'Amoxycillin Trihydrate 125 mg', form: 'tablet_dt' });
  });
  it('leaves out brackets that only name the salt, and uses brackets that carry the strengths', () => {
    expect(c('Diclofenac Gel IP 1.16%w/w (Diclofenac Diethylamine)')).toEqual({ composition: 'Diclofenac 1.16%w/w', form: 'topical' });
    expect(c('Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets IP').composition).toBe('Sulphamethoxazole 800 mg + Trimethoprim 160 mg');
  });
  it('has no composition when there is no strength to match on', () => {
    expect(c('Vitamin B-Complex Syrup').composition).toBeNull();
    expect(c('Calamine Lotion IP').composition).toBeNull();
  });
});

describe('pack size', () => {
  it('reads tablets, grams and millilitres', () => {
    expect(packOf("10's")).toEqual({ qty: 10, kind: 'units' });
    expect(packOf('15 g')).toEqual({ qty: 15, kind: 'g' });
    expect(packOf('60 ml')).toEqual({ qty: 60, kind: 'ml' });
    expect(packOf('2 ml Vial')).toEqual({ qty: 2, kind: 'ml' });
    expect(packOf('Vial & Wfi')).toEqual({ qty: null, kind: 'other' });
  });
});

describe('rows of a page', () => {
  it('rebuilds rows whose names run over several lines, taking each name block in order', () => {
    const page = [...header,
      ...row(1, 770, ['Aceclofenac 100mg', 'and Paracetamol', '325mg Tablets'], "10's", '9.38'),
      ...row(2, 718 - 9, ['Aceclofenac Tablets', 'IP 100 mg'], "10's", '7.5')];
    const problems: string[] = [];
    const rows = rowsOfPage(page, 1, problems);
    expect(problems).toEqual([]);
    expect(rows.map((r) => [r.sr, r.name, r.unitSize, r.mrp])).toEqual([
      [1, 'Aceclofenac 100mg and Paracetamol 325mg Tablets', "10's", 9.38],
      [2, 'Aceclofenac Tablets IP 100 mg', "10's", 7.5]]);
    expect(rows[0].compositionKey).toBe('aceclofenac100mg+paracetamol325mg');
  });
  it('joins a name broken at a hyphen without a space', () => {
    const rows = rowsOfPage([...header, ...row(4, 624, ['Aspirin Gastro-', 'resistant Tablets IP', '150 mg'], "14's", '4.69')], 1, []);
    expect(rows[0].name).toBe('Aspirin Gastro-resistant Tablets IP 150 mg');
  });
  it('keeps a unit text that starts left of the usual column out of the name', () => {
    const rows = rowsOfPage([...header, piece(64, 600, '33'), piece(179, 600, '35'), piece(242, 609, 'Amoxycillin 1g'), piece(242, 591, 'Injection IP'), piece(385, 600, 'Vial & Wfi'), piece(512, 600, '54.38')], 1, []);
    expect(rows[0].name).toBe('Amoxycillin 1g Injection IP');
    expect(rows[0].unitSize).toBe('Vial & Wfi');
  });
  it('takes a tall name that begins above its row and reaches the top of the page', () => {
    const tall = row(938, 722, ['a 170 mg', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'], "10's", '70.32');
    const rows = rowsOfPage([...tall, ...row(939, 580.5 - 9, ['Diltiazem 120 mg', 'Capsules'], "10's", '32.82')], 72, []);
    expect(rows.map((r) => r.sr)).toEqual([938, 939]);
  });
  it('skips a row with an MRP of 0 and says so, and a page whose names do not match its rows', () => {
    const problems: string[] = [];
    expect(rowsOfPage([...header, ...row(512, 198, ['Eye Drops IP 2% W/V'], '10 ml Vial', '0')], 39, problems)).toEqual([]);
    expect(problems[0]).toMatch(/row 512 .*MRP 0/);
    const bad: string[] = [];
    expect(rowsOfPage([...header, piece(64, 700, '1'), piece(402, 700, "10's"), piece(512, 700, '5')], 3, bad)).toEqual([]);
    expect(bad[0]).toMatch(/page 3: 1 rows but 0 names/);
  });
});

describe('whole list', () => {
  it('warns when the first page is not the price list, and drops repeated serial numbers', () => {
    expect(readPriceList([[piece(10, 10, 'hello')]]).problems[0]).toMatch(/does not look like the price list/);
    const p = [...header, ...row(1, 770, ['A 10mg Tablets'], "10's", '5')];
    expect(readPriceList([p, p]).rows).toHaveLength(1);
  });
});
