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
    expect(packFromCell('10 Tablets in 1 Strip')).toMatchObject({ qty: 10, kind: 'units' });
    expect(packFromCell('1 Tablets in 1 Strip')).toMatchObject({ qty: 1, kind: 'units' });
    expect(packFromCell('10 x 10')).toMatchObject({ qty: 100, kind: 'units', unitSize: '10 x 10' });        // 10 strips of 10
    expect(packFromCell('1 x 30')).toMatchObject({ qty: 30, kind: 'units' });
    expect(packFromCell('15 ML')).toMatchObject({ qty: 15, kind: 'ml' });
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

  it('takes one price as both MRP and selling price, and leaves out a row with no price', () => {
    const r = rowsFromTable([rec({ Product: 'A', Price: '50' }), rec({ Product: 'B' }), rec({ Product: '', MRP: '5' })], map, null);
    expect(r.rows.map((x) => [x.name, x.mrp, x.sellPrice])).toEqual([['A', 50, 50]]);
    expect(r.problems.join(' | ')).toMatch(/B\): no price/);
  });

  it('keeps a product that sells a little above the MRP the file shows, and says how many', () => {
    const r = rowsFromTable([
      rec({ Product: 'A', MRP: '100', Price: '80' }), rec({ Product: 'B', MRP: '100', Price: '90' }), rec({ Product: 'C', MRP: '100', Price: '105' }),
    ], map, null);
    expect(r.rows.map((x) => [x.name, x.mrp, x.sellPrice])).toEqual([['A', 100, 80], ['B', 100, 90], ['C', 100, 105]]);
    expect(r.notes).toEqual(['1 product(s) sell above the MRP shown in the file: kept as listed.']);
  });

  it('loads nothing when most selling prices are above the MRP: the columns are probably the wrong way round', () => {
    const r = rowsFromTable([rec({ Product: 'A', MRP: '80', Price: '100' }), rec({ Product: 'B', MRP: '90', Price: '100' }), rec({ Product: 'C', MRP: '100', Price: '90' })], map, null);
    expect(r.rows).toEqual([]);
    expect(r.problems[0]).toMatch(/Most selling prices \(2 of 3\) are above the MRP/);
  });

  it('reads the composition from a generic product name when the file has no composition column', () => {
    const m = { name: 'Product', pack: 'Pack', mrp: 'MRP', price: 'Price' };
    const r = rowsFromTable([
      { Product: 'Telmisartan 40 mg + Cilnidipine 10 mg Tabs (SWASCILTEL)- GA', Pack: '10 Tablets in 1 Strip', MRP: '85.1', Price: '19.74' },
      { Product: 'Albendazole 200 mg + Ivermectin 1.5 mg Oral Suspension', Pack: '15 ml', MRP: '50', Price: '15.2' },
      { Product: 'Some Brand', Pack: '10', MRP: '10', Price: '9' },
    ], m, null);
    expect(r.fromName).toBe(2);
    expect(r.rows[0]).toMatchObject({ composition: 'Telmisartan 40 mg + Cilnidipine 10 mg', form: 'tablet', packQty: 10, hasStrength: true });
    expect(r.rows[1]).toMatchObject({ composition: 'Albendazole 200 mg + Ivermectin 1.5 mg', form: 'syrup', packKind: 'ml', packQty: 15 });
    expect(r.rows[2].composition).toBeNull();
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
