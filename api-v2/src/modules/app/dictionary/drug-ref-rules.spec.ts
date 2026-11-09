import { brandKey, canonicalRow, canonicalRows, cdciToCanonical, compositionOfGeneric, detectCdciColumns, parseDelimited, readableComposition, withHeader } from './drug-ref-rules';

describe('brand dictionary import rules', () => {
  it('searches a brand by letters and digits only', () => {
    expect(brandKey('Augmentin 625 Duo')).toBe('augmentin625duo');
    expect(brandKey('AUGMENTIN-625  DUO')).toBe('augmentin625duo');
    expect(brandKey(null)).toBe('');
  });

  it('reads CSV with quotes, doubled quotes, line breaks inside a cell, CRLF and a byte-order mark', () => {
    const rows = parseDelimited('﻿a,b,c\r\n1,"x, y",3\r\n"say ""hi""","two\nlines",\r\n\r\n', ',');
    expect(rows).toEqual([['a', 'b', 'c'], ['1', 'x, y', '3'], ['say "hi"', 'two\nlines', '']]);
    expect(parseDelimited('a\tb\n1\t2', '\t')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseDelimited('', ',')).toEqual([]);
    const { headers, records } = withHeader(parseDelimited(' name , code \nA,1\nB'));
    expect(headers).toEqual(['name', 'code']);
    expect(records).toEqual([{ name: 'A', code: '1' }, { name: 'B', code: '' }]);
  });

  it('cleans a row into the canonical shape', () => {
    const r = canonicalRow({ brand: ' Dolo  650 Tablet ', manufacturer: 'Micro Labs', dosage_form: 'Tablet', composition: 'Paracetamol (650mg)', pack: 'strip of 15 tablets', discontinued: 'No', code: 'B1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row).toMatchObject({ brand: 'Dolo 650 Tablet', brandKey: 'dolo650tablet', dosageForm: 'tablet', compositionKey: 'paracetamol650mg', hasStrength: true, discontinued: false, code: 'B1' });
    }
    const sr = canonicalRow({ brand: 'Glycomet 500 SR Tablet', dosage_form: 'Tablet Sr', composition: 'Metformin (500mg)', discontinued: 'Yes' });
    expect(sr.ok && sr.row.dosageForm).toBe('tablet_sr');
    expect(sr.ok && sr.row.discontinued).toBe(true);
    const combo = canonicalRow({ brand: 'Augmentin 625', composition: 'Clavulanic Acid (125mg) + Amoxycillin (500mg)', dosage_form: '' });
    expect(combo.ok && combo.row.compositionKey).toBe('amoxicillin500mg+clavulanicacid125mg');   // ingredients in any order, the international spelling
    expect(combo.ok && combo.row.dosageForm).toBeNull();                                          // a form is never guessed
  });

  it('says why a row cannot be used', () => {
    expect(canonicalRow({ brand: '', composition: 'Paracetamol (500mg)' })).toEqual({ ok: false, reason: 'no brand name' });
    expect(canonicalRow({ brand: 'X', composition: '   ' })).toEqual({ ok: false, reason: 'no composition' });
    const out = canonicalRows([{ brand: 'A', composition: 'Paracetamol (500mg)' }, { brand: 'B', composition: '' }, { brand: '', composition: 'x' }, { brand: 'C', composition: 'Salt' }]);
    expect(out.rows.length).toBe(2);
    expect(out.skipped).toEqual({ 'no composition': 1, 'no brand name': 1 });
    expect(out.rows[1].hasStrength).toBe(false);                                                  // kept, but flagged: no strength means a match is not safe
  });
});

/*
 * The layout below is the real one of the Common Drug Codes for India Flat Files Package (release of 31 Aug 2026, checked against the downloaded files): tab-separated,
 * a Brand Master row refers to a Generic Master row and a Supplier, a generic refers to a Drug Form. Names and rows are shortened samples of the real ones.
 */
describe('CDCI Flat Files adapter (real layout)', () => {
  const H = {
    brand: ['Identifier', 'Brand Name', 'Product Identifier', 'Supplier Identifier', 'Generic Identifier', 'License Number', 'License Status', 'Excipient', 'last_updated_on'],
    generic: ['Identifier', 'Generic Name', 'Substance Identifier', 'Route of Administration', 'Dose Form', 'Therapeutic Role', 'last_updated_on'],
    form: ['Id', 'Dose Form'],
    supplier: ['Identifier', 'Supplier Name', 'Country'],
  };
  const brand = H.brand.join('\t') + '\n' +
    '1\tAugmentin DUO 500 mg + 125 mg oral tablet\t10\t100\tG1\t\tUNKNOWN\t\t20240101\n' +
    '2\tOrphan 5 mg oral tablet\t11\t100\tG9\t\tUNKNOWN\t\t20240101\n' +
    '3\tGlycomet SR 500 mg prolonged-release oral tablet\t12\t101\tG2\t\tUNKNOWN\t\t20240101\n' +
    '4\tTelmat-H 12.5 mg + 40 mg oral tablet\t13\t101\tG3\t\tUNKNOWN\t\t20240101\n';
  const generic = H.generic.join('\t') + '\r\n' +
    'G1\tAmoxicillin 500 mg and clavulanic acid (as clavulanate potassium) 125 mg oral tablet\t1+2\t26643006\tF1\t\t20240101\r\n' +
    'G2\tMetformin hydrochloride 500 mg prolonged-release oral tablet\t3\t26643006\tF2\t\t20240101\r\n' +
    'G3\tHydrochlorothiazide 12.5 mg and telmisartan 40 mg oral tablet\t4+5\t26643006\tF1\t\t20240101\r\n';
  const form = 'Id\tDose Form\r\nF1\tOral tablet\r\nF2\tProlonged-release oral tablet\r\n';
  const supplier = 'Identifier\tSupplier Name\tCountry\r\n100\tGlaxoSmithKline Pharmaceuticals Limited\t\t\r\n101\tUSV Private Limited\t\t\r\n';

  it('finds the columns of the real files by header, and says what is missing', () => {
    const ok = detectCdciColumns({ brand: H.brand, generic: H.generic, form: H.form, supplier: H.supplier });
    expect(ok.problems).toEqual([]);
    expect(ok.map?.brand).toEqual({ code: 'Identifier', name: 'Brand Name', generic: 'Generic Identifier', supplier: 'Supplier Identifier' });
    expect(ok.map?.generic).toEqual({ code: 'Identifier', name: 'Generic Name', form: 'Dose Form' });
    expect(ok.map?.form).toEqual({ code: 'Id', name: 'Dose Form' });
    expect(ok.map?.supplier).toEqual({ code: 'Identifier', name: 'Supplier Name' });
    const bad = detectCdciColumns({ brand: ['X', 'Y'], generic: ['A', 'B'] });
    expect(bad.map).toBeUndefined();
    expect(bad.problems.join(' ')).toMatch(/Brand Master: no column for the brand name \(found: X, Y\)/);
    expect(bad.problems.join(' ')).toMatch(/Generic Master: no code column/);
  });

  it('turns the masters into canonical records: composition without the form words, the form from the drug form master', () => {
    const c = cdciToCanonical({ brand, generic, form, supplier });
    expect(c.problems).toEqual([]);
    expect(c.brands).toBe(4);
    expect(c.unlinked).toBe(1);                                    // a brand whose generic is not in the Generic Master is left out and counted
    expect(c.rows.length).toBe(3);
    expect(c.rows[0]).toMatchObject({ brand: 'Augmentin DUO 500 mg + 125 mg oral tablet', manufacturer: 'GlaxoSmithKline Pharmaceuticals Limited', composition: 'Amoxicillin 500 mg + clavulanic acid 125 mg', code: '1' });
    const rows = canonicalRows(c.rows).rows;
    expect(rows[0].compositionKey).toBe('amoxicillin500mg+clavulanicacid125mg');
    expect(rows[0].dosageForm).toBe('tablet');
    expect(rows[1].dosageForm).toBe('tablet_sr');                  // prolonged-release stays apart from a plain tablet
    expect(rows[1].compositionKey).toBe('metformin500mg');          // the salt (hydrochloride) is not part of the medicine
    expect(rows[2].compositionKey).toBe('hydrochlorothiazide12.5mg+telmisartan40mg');
  });

  it('works without the optional drug form and supplier files, and reports a layout it cannot read', () => {
    const c = cdciToCanonical({ brand: 'Identifier\tBrand Name\tGeneric Identifier\n1\tPan 40 mg oral tablet\tG2\n', generic: 'Identifier\tGeneric Name\nG2\tPantoprazole (as pantoprazole sodium) 40 mg gastro-resistant oral tablet\n' });
    expect(c.problems).toEqual([]);
    expect(c.rows[0].composition).toBe('Pantoprazole 40 mg');
    expect(c.rows[0].manufacturer).toBe('');
    const bad = cdciToCanonical({ brand: 'A\tB\n1\t2\n', generic: 'C\tD\n1\t2\n' });
    expect(bad.rows).toEqual([]);
    expect(bad.problems.length).toBeGreaterThan(0);
  });

  it('cuts the form words off a generic name but keeps salt words, and writes a combination readably', () => {
    expect(compositionOfGeneric('Amoxicillin 500 mg and clavulanic acid 125 mg oral tablet', 'Oral tablet')).toBe('Amoxicillin 500 mg and clavulanic acid 125 mg');
    expect(compositionOfGeneric('Metformin hydrochloride 500 mg prolonged-release oral tablet', 'Prolonged-release oral tablet')).toBe('Metformin hydrochloride 500 mg');
    expect(compositionOfGeneric('Paracetamol 250 mg/5 mL oral suspension')).toBe('Paracetamol 250 mg/5 mL');
    expect(compositionOfGeneric('Pantoprazole 40 mg powder for solution for injection vial')).toBe('Pantoprazole 40 mg');
    expect(compositionOfGeneric('Ferrous sulfate')).toBe('Ferrous sulfate');
    expect(readableComposition('Aspirin 75 mg and atorvastatin (as Atorvastatin calcium) 10 mg')).toBe('Aspirin 75 mg + atorvastatin 10 mg');
  });
});
