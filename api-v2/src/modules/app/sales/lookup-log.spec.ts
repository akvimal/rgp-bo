import { LOOKUP_KINDS, LOOKUP_OUTCOMES, NO_MATCH, cleanTyped, outcomeOf } from './lookup-log';
import * as fs from 'fs';
import * as path from 'path';

describe('brand check log', () => {
  it('in stock when the same composition and form is there, or the product asked for itself', () => {
    expect(outcomeOf({ status: 'OK', same: [{}], otherForms: [] })).toBe('IN_STOCK');
    expect(outcomeOf({ status: 'OK', same: [], otherForms: [{}], askedInStock: true })).toBe('IN_STOCK');
  });

  it('only another form, or nothing in stock', () => {
    expect(outcomeOf({ status: 'OK', same: [], otherForms: [{}] })).toBe('OTHER_FORM');
    expect(outcomeOf({ status: 'OK', same: [], otherForms: [] })).toBe('NOT_STOCKED');
    expect(outcomeOf({ status: 'OK' })).toBe('NOT_STOCKED');
  });

  it('a medicine with no composition or no strength cannot say', () => {
    expect(outcomeOf({ status: 'NO_COMPOSITION' })).toBe('NO_COMP');
    expect(outcomeOf({ status: 'NO_STRENGTH', same: [{}] })).toBe('NO_COMP');
  });

  it('counts as no match: another form only, nothing in stock, or typed and not found', () => {
    expect(NO_MATCH).toEqual(['OTHER_FORM', 'NOT_STOCKED', 'NOT_FOUND']);
    expect(NO_MATCH.includes('IN_STOCK')).toBe(false);
    expect(NO_MATCH.includes('NO_COMP')).toBe(false);
  });

  it('keeps typed text tidy and ignores what is too short', () => {
    expect(cleanTyped('  telma   40 ')).toBe('telma 40');
    expect(cleanTyped('ab')).toBeNull();
    expect(cleanTyped(null)).toBeNull();
    expect(cleanTyped('x'.repeat(300))!.length).toBe(160);
  });

  it('the migration allows exactly the kinds and outcomes the code uses', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../../../../sql/migrations/177_brand_lookup_event.sql'), 'utf8');
    const list = (name: string) => [...sql.match(new RegExp(`${name} CHECK \\(\\w+ IN \\(([^)]*)\\)`))![1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(list('brand_lookup_kind_chk').sort()).toEqual([...LOOKUP_KINDS].sort());
    expect(list('brand_lookup_outcome_chk').sort()).toEqual([...LOOKUP_OUTCOMES].sort());
  });
});
