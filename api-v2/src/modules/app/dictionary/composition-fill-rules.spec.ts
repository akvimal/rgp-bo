import { cleanTitle, indianNames, makeFillIndex, titleKeys } from './composition-fill-rules';

const b = (brand: string, composition: string, key: string, form: string | null = 'tablet', manufacturer: string | null = 'Maker') =>
  ({ brand, brand_key: brand.toLowerCase().replace(/[^a-z0-9]/g, ''), manufacturer, composition, composition_key: key, dosage_form: form });

const index = makeFillIndex([
  b('Telma 40 mg oral tablet', 'Telmisartan 40 mg', 'telmisartan40mg'),
  b('Telma 400 mg oral tablet', 'Something 400 mg', 'something400mg'),
  b('Telma 40H 12.5 mg + 40 mg oral tablet', 'Hydrochlorothiazide 12.5 mg + telmisartan 40 mg', 'hctz+telmi'),
  b('Ezentib 10 mg oral tablet', 'Ezetimibe 10 mg', 'ezetimibe10mg'),
  b('Dolo 650 mg oral tablet', 'Paracetamol 650 mg', 'paracetamol650mg'),
  b('Dolo 650 mg oral suspension', 'Paracetamol 650 mg', 'paracetamol650mg', 'syrup'),
  b('Augmentin DUO 500 mg + 125 mg oral tablet', 'Amoxicillin 500 mg + clavulanic acid 125 mg', 'amox+clav'),
  b('Mixy 5 mg oral tablet', 'Drug A 5 mg', 'a5mg'),
  b('Mixy 5 mg oral tablet', 'Drug B 5 mg', 'b5mg'),
]);

describe('cleaning a title', () => {
  it('drops the supplier code and the pack', () => {
    expect(cleanTitle("EZENTIB 10MG TAB 10'S")).toBe('EZENTIB 10MG TAB');
    expect(cleanTitle('Augmentin Duo [CIP12] (strip)')).toBe('Augmentin Duo');
    expect(cleanTitle('Telma 40 x 10')).toBe('Telma 40');
  });
  it('gives the key with and without the form words', () => {
    expect(titleKeys("EZENTIB 10MG TAB 10'S")).toEqual(['ezentib10mgtab', 'ezentib10mg']);
    expect(titleKeys('ab')).toEqual([]);
  });
});

describe('finding the composition of a title', () => {
  it('matches a brand with its strength written the short way', () => {
    expect(index.find('Telma 40 Tablet')).toMatchObject({ composition: 'Telmisartan 40 mg', form: 'tablet', brand: 'Telma 40 mg oral tablet' });
    expect(index.find("EZENTIB 10MG TAB 10'S")).toMatchObject({ composition: 'Ezetimibe 10 mg' });
  });
  it('does not take another strength or a variant for the same brand', () => {
    const m = index.find('Telma 40');
    expect(m?.composition).toBe('Telmisartan 40 mg');        // not Telma 400, not Telma 40H
  });
  it('uses the form in the title to choose between forms of one brand', () => {
    expect(index.find('Dolo 650 Tablet')).toMatchObject({ composition: 'Paracetamol 650 mg', form: 'tablet' });
    expect(index.find('Dolo 650 Suspension')).toMatchObject({ form: 'syrup' });
  });
  it('is not sure when the title does not say the form and the brand has several', () => {
    expect(index.find('Dolo 650')).toBeNull();
  });
  it('is not sure when the brand has more than one composition, or is not there', () => {
    expect(index.find('Mixy 5 tablet')).toBeNull();
    expect(index.find('Unknown Brand 10')).toBeNull();
    expect(index.find('')).toBeNull();
  });
  it('reads a combination brand', () => {
    expect(index.find('Augmentin Duo 500 + 125 Tab')).toBeNull();           // the strengths are not written the way the brand does: left for a person
    expect(index.find('Augmentin DUO 500 MG + 125 MG TAB')).toMatchObject({ composition: 'Amoxicillin 500 mg + clavulanic acid 125 mg' });
  });
});

describe('names', () => {
  it('uses the Indian names for the ingredients the official list names internationally', () => {
    expect(indianNames('Acetaminophen 650 mg + albuterol 2 mg')).toBe('Paracetamol 650 mg + salbutamol 2 mg');
    expect(indianNames('Telmisartan 40 mg')).toBe('Telmisartan 40 mg');
  });
});
