import { collectorProblem } from './staff-credit-rule';

describe('who collected on a staff member\'s credit', () => {
  it('is the staff member themselves when nothing is given', () => {
    expect(collectorProblem(undefined)).toEqual({ value: null });
    expect(collectorProblem(null)).toEqual({ value: null });
    expect(collectorProblem('   ')).toEqual({ value: null });
  });
  it('keeps a family member\'s name and relation, tidied', () => {
    expect(collectorProblem('  Lakshmi,   wife ')).toEqual({ value: 'Lakshmi, wife' });
  });
  it('refuses a name too short to mean anything', () => {
    expect(collectorProblem('Ra').error).toMatch(/name of the person/);
  });
  it('cuts a very long entry to what the column holds', () => {
    expect(collectorProblem('x'.repeat(200)).value).toHaveLength(80);
  });
});
