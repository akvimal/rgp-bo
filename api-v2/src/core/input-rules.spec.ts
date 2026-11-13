import { BUSINESS_NAME, GSTIN, IFSC, PAN, PERSON_NAME, PINCODE, personNameProblem } from './input-rules';

describe('person name', () => {
  it.each(['Ramesh Kumar', "D'Souza", 'Mary-Ann', 'A. K. Raj', 'ரமேஷ் குமார்', 'Li', 'K S'])('accepts %s', (n) => {
    expect(PERSON_NAME.test(n)).toBe(true);
  });
  it.each(['1234', 'R@mesh', 'Ramesh #2', '###', 'A', '.', '-Ram', 'Ram_Kumar', '9876543210', 'Ram$'])('refuses %s', (n) => {
    expect(PERSON_NAME.test(n)).toBe(false);
  });
  it('collapses spaces, treats blank as nothing and refuses a long name', () => {
    expect(personNameProblem('  Ramesh   Kumar ')).toEqual({ value: 'Ramesh Kumar' });
    expect(personNameProblem('   ')).toEqual({ value: null });
    expect(personNameProblem(null)).toEqual({ value: null });
    expect('error' in personNameProblem('A'.repeat(81))).toBe(true);
    expect('error' in personNameProblem('R@mesh')).toBe(true);
  });
});

describe('business name', () => {
  it.each(['Sri Murugan Medicals', 'A&B Distributors (P) Ltd.', '3M India', "St. Mary's Agency"])('accepts %s', (n) => expect(BUSINESS_NAME.test(n)).toBe(true));
  it.each(['###', '12345', '@shop', ''])('refuses %s', (n) => expect(BUSINESS_NAME.test(n)).toBe(false));
});

describe('identifiers', () => {
  it('GSTIN', () => {
    expect(GSTIN.test('33ABCDE1234F1Z5')).toBe(true);
    expect(GSTIN.test('33ABCDE1234F1X5')).toBe(false);
    expect(GSTIN.test('33abcde1234f1z5')).toBe(false);
  });
  it('PAN', () => {
    expect(PAN.test('ABCDE1234F')).toBe(true);
    expect(PAN.test('ABCD12345F')).toBe(false);
  });
  it('IFSC', () => {
    expect(IFSC.test('HDFC0001234')).toBe(true);
    expect(IFSC.test('HDFC1001234')).toBe(false);
  });
  it('pincode', () => {
    expect(PINCODE.test('600001')).toBe(true);
    expect(PINCODE.test('060001')).toBe(false);
    expect(PINCODE.test('60001')).toBe(false);
  });
});
