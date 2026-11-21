import { detectColumns, makeBrandIndex, packFromCell, rowsFromTable } from './price-sheet-rules';

describe('finding the columns', () => {
  it('reads common headings', () => {
    expect(detectColumns(['Product Name', 'Composition', 'Pack Size', 'MRP', 'Selling Price'])).toEqual({ name: 'Product Name', composition: 'Composition', pack: 'Pack Size', mrp: 'MRP', price: 'Selling Price' });
    expect(detectColumns(['Item', 'Generic Name', 'Unit', 'M.R.P', 'Our Price', 'Dosage Form', 'Item Code'])).toMatchObject({ name: 'Item', composition: 'Generic Name', pack: 'Unit', mrp: 'M.R.P', price: 'Our Price', form: 'Dosage Form', code: 'Item Code' });
  });
  it('uses a column for one field only', () => {
    const m = detectColumns(['Name', 'Price']);
    expect(m).toEqual({ name: 'Name', price: 'Price' });
  });
});

describe('pack cells', () => {
  it('reads a plain number, a strip, tablets and millilitres', () => {
    expect(packFromCell('10')).toMatchObject({ qty: 10, kind: 'units', unitSize: "10's" });
    expect(packFromCell("15's")).toMatchObject({ qty: 15, kind: 'units' });
    expect(packFromCell('Strip of 10')).toMatchObject({ qty: 10, kind: 'units' });
    expect(packFromCell('10 tablets')).toMatchObject({ qty: 10, kind: 'units' });
    expect(packFromCell('60 ml')).toMatchObject({ qty: 60, kind: 'ml' });
    expect(packFromCell('')).toMatchObject({ qty: null, kind: 'other' });
  });
});

describe('rows of a table', () => {
  const map = { name: 'Product', composition: 'Composition', pack: 'Pack', mrp: 'MRP', price: 'Price' };
  const rec = (o: Record<string, any>) => ({ Product: '', Composition: '', Pack: '', MRP: '', Price: '', ...o });

  it('makes items with the composition from the file, per-pack prices and a form', () => {
    const r = rowsFromTable([rec({ Product: 'Telma 40', Composition: 'Telmisartan 40mg', Pack: '10', MRP: '120', Price: '96' })], map, null);
    expect(r.problems).toEqual([]);
    expect(r.rows[0]).toMatchObject({ name: 'Telma 40', composition: 'Telmisartan 40 mg', compositionKey: 'telmisartan40mg', packQty: 10, mrp: 120, sellPrice: 96, hasStrength: true });
  });

  it('reads a composition written as a generic name the same way as the PMBI list', () => {
    const r = rowsFromTable([rec({ Product: 'X', Composition: 'Aceclofenac 100mg and Paracetamol 325mg Tablets', MRP: '10' })], map, null);
    expect(r.rows[0]).toMatchObject({ composition: 'Aceclofenac 100 mg + Paracetamol 325 mg', form: 'tablet' });
  });

  it('takes one price as both MRP and selling price, and leaves out a row with no price or a selling price above the MRP', () => {
    const r = rowsFromTable([
      rec({ Product: 'A', Price: '50' }), rec({ Product: 'B' }), rec({ Product: 'C', MRP: '100', Price: '120' }), rec({ Product: '', MRP: '5' }),
    ], map, null);
    expect(r.rows.map((x) => [x.name, x.mrp, x.sellPrice])).toEqual([['A', 50, 50]]);
    expect(r.problems.join(' | ')).toMatch(/B\): no price/);
    expect(r.problems.join(' | ')).toMatch(/C\): the selling price is above the MRP/);
  });

  it('finds the composition of a product from the brand dictionary when the file has none, only when the matching brands agree', () => {
    const brands = makeBrandIndex([
      { brand_key: 'telmiten40mgoraltablet', composition: 'Telmisartan 40 mg', composition_key: 'telmisartan40mg', dosage_form: 'tablet' },
      { brand_key: 'telmiten20mgoraltablet', composition: 'Telmisartan 20 mg', composition_key: 'telmisartan20mg', dosage_form: 'tablet' },
      { brand_key: 'zolpidem10mgoraltablet', composition: 'Zolpidem 10 mg', composition_key: 'zolpidem10mg', dosage_form: 'tablet' },
    ]);
    const m = { name: 'Product', mrp: 'MRP' };
    const r = rowsFromTable([{ Product: 'Telmiten 40', MRP: '90' }, { Product: 'Telmiten', MRP: '90' }, { Product: 'Unknownbrand 5', MRP: '10' }], m, brands);
    expect(r.rows[0]).toMatchObject({ composition: 'Telmisartan 40 mg', form: 'tablet', hasStrength: true });
    expect(r.rows[1].composition).toBeNull();            // "Telmiten" could be 20 or 40: not guessed
    expect(r.rows[2].composition).toBeNull();
    expect(r.fromDictionary).toBe(1);
  });

  it('asks for the product and price columns', () => {
    expect(rowsFromTable([rec({ Product: 'A', MRP: '5' })], { name: 'Product' }, null).problems[0]).toMatch(/MRP or the selling price/);
    expect(rowsFromTable([rec({ Product: 'A', MRP: '5' })], { mrp: 'MRP' }, null).problems[0]).toMatch(/product name/);
  });
});
