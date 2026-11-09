import { classifyForm, dosageFormLabel, DOSAGE_FORMS, formRelation, isDosageForm } from './dosage-form';

describe('dosage form', () => {
  it('reads the form from the titles the shop writes', () => {
    expect(classifyForm("EZENTIB 10MG TAB 10'S")).toBe('tablet');
    expect(classifyForm("ALPREK 0.5MG TAB 30'S")).toBe('tablet');
    expect(classifyForm("BICIPHAGE 500MG SR TAB 10'S")).toBe('tablet_sr');
    expect(classifyForm("MIRABEN ER 25MG TAB 10'S")).toBe('tablet_sr');
    expect(classifyForm("FORMADAX 200MCG CAPS 30'S")).toBe('capsule');
    expect(classifyForm("OMEGA SOFT CAPS 10'S")).toBe('capsule');
    expect(classifyForm('RABEPRAZOLE DSR CAPSULE SR')).toBe('capsule_sr');
    expect(classifyForm("AUGMENTIN DUO SYP 60ML")).toBe('syrup');
    expect(classifyForm('PARACETAMOL 250MG SUSPENSION')).toBe('syrup');
    expect(classifyForm('CEFIXIME 50MG DRY SYRUP')).toBe('syrup');
    expect(classifyForm('SKINDID-B CREAM 15GM')).toBe('topical');
    expect(classifyForm('ORASORE GEL 12GM')).toBe('topical');
    expect(classifyForm('NOVAMOX 1G INJ')).toBe('injection');
    expect(classifyForm('OMEE G POWDER LEMON')).toBe('powder');
    expect(classifyForm('OFLOX EYE DROPS 5ML')).toBe('drops');
    expect(classifyForm('SALBUTAMOL ROTACAPS')).toBe('inhaler');
  });

  it('keeps release forms apart', () => {
    expect(classifyForm('Tablet Sr')).toBe('tablet_sr');
    expect(classifyForm('Capsule Sr')).toBe('capsule_sr');
    expect(classifyForm('Tablet Dt')).toBe('tablet_dt');
    expect(classifyForm('Chewable tablet')).toBe('tablet_dt');
    expect(classifyForm('Prolonged-release tablet')).toBe('tablet_sr');
    expect(classifyForm('Modified-release capsule')).toBe('capsule_sr');
  });

  it('reads the dictionary and drug-form words', () => {
    expect(classifyForm('Tablet')).toBe('tablet');
    expect(classifyForm('Oral Suspension')).toBe('syrup');
    expect(classifyForm('Dry Syrup')).toBe('syrup');
    expect(classifyForm('Eye Drop')).toBe('drops');
    expect(classifyForm('Powder for solution for injection')).toBe('injection');
    expect(classifyForm('Inhalation powder')).toBe('inhaler');
    expect(classifyForm('Oral solution')).toBe('syrup');
    expect(classifyForm('Film coated tablet')).toBe('tablet');
    expect(classifyForm('Sachet')).toBe('powder');
  });

  it('does not guess: a device, a bare name or an empty text has no form', () => {
    expect(classifyForm('DISPOVAN SYRINGE 5ML')).toBeNull();
    expect(classifyForm('GLYCOMET 500')).toBeNull();
    expect(classifyForm('METFORMIN SR 500')).toBeNull();          // a release word with no form word
    expect(classifyForm('')).toBeNull();
    expect(classifyForm(null)).toBeNull();
    expect(classifyForm('THYRODAX 100MCG TAB 100\'S')).toBe('tablet');
  });

  it('does not take letters inside a longer word for a form', () => {
    expect(classifyForm('CAPSAICIN CREAM')).toBe('topical');      // capsaicin is not a capsule
    expect(classifyForm('TABBY 5MG')).toBeNull();                 // nor is tabby a tablet
    expect(classifyForm('PROSTAR 5MG')).toBeNull();               // nor is star... "sr" inside a word
  });

  it('has a closed list with labels, and compares two forms', () => {
    expect(isDosageForm('tablet_sr')).toBe(true);
    expect(isDosageForm('pill')).toBe(false);
    expect(isDosageForm(null)).toBe(false);
    expect(dosageFormLabel('capsule_sr')).toBe('Capsule, sustained release');
    expect(dosageFormLabel(null)).toBe('');
    expect(new Set(DOSAGE_FORMS.map((f) => f.key)).size).toBe(DOSAGE_FORMS.length);
    expect(formRelation('tablet', 'tablet')).toBe('same');
    expect(formRelation('tablet', 'tablet_sr')).toBe('different');
    expect(formRelation(null, 'tablet')).toBe('unknown');
    expect(formRelation('tablet', undefined)).toBe('unknown');
  });
});

describe('dosage form list and the migration', () => {
  it('has the same keys in the database check as in the code', () => {
    const sql = require('fs').readFileSync(require('path').resolve(__dirname, '../../../../../sql/migrations/176_brand_dictionary.sql'), 'utf8') as string;
    const inCheck = (re: RegExp) => (sql.match(re)?.[1] || '').split(',').map((x) => x.trim().replace(/'/g, '')).sort();
    const keys = DOSAGE_FORMS.map((f) => f.key).sort();
    expect(inCheck(/product_dosage_form_chk CHECK \(dosage_form IS NULL OR dosage_form IN \(([^)]*)\)/)).toEqual(keys);
    expect(inCheck(/drug_ref_brand_form_chk CHECK \(dosage_form IS NULL OR dosage_form IN \(([^)]*)\)/)).toEqual(keys);
  });
});
