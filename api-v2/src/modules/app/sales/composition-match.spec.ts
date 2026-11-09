import { compositionKey, needsPrescription } from './composition-match';

describe('composition match', () => {
  it('ignores case, spaces and brackets', () => {
    const k = (t: string) => compositionKey(t)!.key;
    expect(k('Acarbose (25mg)')).toBe(k('acarbose 25mg'));
    expect(k('ACARBOSE 25MG')).toBe(k(' Acarbose (25 mg) '));
    expect(k('Atorvastatin (10mg) + Clopidogrel (75mg)')).toBe(k('Atorvastatin 10 MG + Clopidogrel 75 MG'));
  });

  it('ignores the order of the ingredients of a combination', () => {
    expect(compositionKey('Telmisartan (40mg) + Amlodipine (5mg)')!.key).toBe(compositionKey('Amlodipine (5mg) + Telmisartan (40mg)')!.key);
  });

  it('never matches a different strength or a different ingredient', () => {
    expect(compositionKey('Metformin (500mg)')!.key).not.toBe(compositionKey('Metformin (850mg)')!.key);
    expect(compositionKey('Metformin (500mg)')!.key).not.toBe(compositionKey('Metformin (500mg) + Glimepiride (1mg)')!.key);
    expect(compositionKey('Amoxycillin (500mg)')!.key).not.toBe(compositionKey('Amoxycillin (500mg) + Clavulanic Acid (125mg)')!.key);
  });

  it('keeps a release form as part of the medicine', () => {
    expect(compositionKey('GLICLAZIDE ER 60MG')!.key).not.toBe(compositionKey('Gliclazide 60mg')!.key);
  });

  it('groups the same ingredient across strengths', () => {
    expect(compositionKey('Metformin (500mg)')!.salts).toBe(compositionKey('Metformin (850mg)')!.salts);
    expect(compositionKey('Metformin (500mg)')!.salts).not.toBe(compositionKey('Glimepiride (1mg)')!.salts);
  });

  it('says when no strength is recorded', () => {
    expect(compositionKey('Probiotics ')!.hasStrength).toBe(false);
    expect(compositionKey('Vitamin E 400mg')!.hasStrength).toBe(true);
    expect(compositionKey('Zinc + Folic Acid (5mg)')!.hasStrength).toBe(false);
  });

  it('has nothing to compare for empty text', () => {
    expect(compositionKey(null)).toBeNull();
    expect(compositionKey('  ')).toBeNull();
    expect(compositionKey('+ +')).toBeNull();
  });

  it('knows which schedules need a prescription', () => {
    expect(['H', 'H1', 'X'].every(needsPrescription)).toBe(true);
    expect(needsPrescription('Other')).toBe(false);
    expect(needsPrescription(undefined)).toBe(false);
  });
});

describe('composition match: names from the official list', () => {
  const k = (t: string) => compositionKey(t)!.key;

  it('treats the salt a medicine comes as as the same medicine', () => {
    expect(k('Metformin hydrochloride 500 mg')).toBe(k('Metformin (500mg)'));
    expect(k('Pantoprazole (as pantoprazole sodium) 40 mg')).toBe(k('Pantoprazole 40mg'));
    expect(k('Atorvastatin calcium 10 mg')).toBe(k('Atorvastatin (10mg)'));
    expect(k('Bisacodyl IP 5mg')).toBe(k('Bisacodyl 5mg'));
    expect(k('Salbutamol sulphate 2 mg')).toBe(k('Salbutamol 2mg'));
  });

  it('reads a combination written with "and" and with the brackets of the official list', () => {
    expect(k('Amoxicillin 500 mg and clavulanic acid (as clavulanate potassium) 125 mg')).toBe(k('Clavulanic Acid (125mg) + Amoxycillin (500mg)'));
    expect(k('Aspirin 75 mg and atorvastatin (as Atorvastatin calcium) 10 mg')).toBe(k('Atorvastatin 10mg + Aspirin 75mg'));
  });

  it('maps the international names and units to the ones used here', () => {
    expect(k('Acetaminophen 650 mg')).toBe(k('Paracetamol (650mg)'));
    expect(k('Amoxicillin 500 mg')).toBe(k('Amoxycillin 500mg'));
    expect(k('Levothyroxine sodium 50 microgram')).toBe(k('Thyroxine (50mcg)'));
    expect(k('Paracetamol 250 mg/5 mL')).toBe(k('Paracetamol (250mg/5ml)'));
  });

  it('still keeps different medicines, strengths and release forms apart', () => {
    expect(k('Metformin hydrochloride 500 mg')).not.toBe(k('Metformin 850mg'));
    expect(k('Sodium chloride 0.9 %')).not.toBe(k('Potassium chloride 0.9 %'));
    expect(k('Gliclazide ER 60mg')).not.toBe(k('Gliclazide hydrochloride 60mg'));
    expect(compositionKey('Pantoprazole sodium 40mg')!.salts).toBe('pantoprazole');
  });
});
