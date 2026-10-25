import { detailProblems, draftEntries, normaliseDetail, parseRequired, requiredLines, scheduledLines, schedulesOf, serialLabel } from './drug-register-rules';

const good = { patient_name: 'A Patient', patient_address: '12 Main Road, Town', prescriber_name: 'Dr B Doctor', prescriber_reg_no: 'TN12345' };

describe('drug register rules', () => {
  it('reads which schedules need details: no setting is all three, an empty one is none', () => {
    expect(parseRequired(undefined)).toEqual(['H1', 'H', 'X']);
    expect(parseRequired(null)).toEqual(['H1', 'H', 'X']);
    expect(parseRequired('')).toEqual([]);
    expect(parseRequired('h1, x')).toEqual(['H1', 'X']);
    expect(parseRequired('H1,Z,H')).toEqual(['H1', 'H']);
  });

  it('asks for the patient, the prescriber and a way to find the prescriber', () => {
    expect(detailProblems(good)).toEqual([]);
    expect(detailProblems({})).toEqual(["the patient's name", "the patient's address", "the prescriber's name", "the prescriber's registration number or address"]);
    expect(detailProblems({ ...good, prescriber_reg_no: '', prescriber_address: 'Clinic, 4 High Street' })).toEqual([]);   // an address will do in place of the number
    expect(detailProblems({ ...good, prescriber_reg_no: '' })).toEqual(["the prescriber's registration number or address"]);
    expect(detailProblems({ ...good, patient_address: 'x' })).toEqual(["the patient's address"]);
  });

  it('checks the prescription date only when one is given, and never in the future', () => {
    expect(detailProblems({ ...good, rx_date: '2026-10-01' }, '2026-10-25')).toEqual([]);
    expect(detailProblems({ ...good, rx_date: '2026-11-01' }, '2026-10-25')).toEqual(['a valid prescription date (not in the future)']);
    expect(detailProblems({ ...good, rx_date: 'yesterday' }, '2026-10-25')).toEqual(['a valid prescription date (not in the future)']);
    expect(detailProblems({ ...good, rx_date: '' }, '2026-10-25')).toEqual([]);
  });

  it('tidies what was typed', () => {
    expect(normaliseDetail({ patient_name: '  A   Patient ', rx_date: '2026-10-01' })).toMatchObject({ patient_name: 'A Patient', rx_date: '2026-10-01' });
    expect(normaliseDetail({ patient_name: 'x'.repeat(300) }).patient_name.length).toBe(100);
    expect(normaliseDetail({ rx_date: 'nope' }).rx_date).toBeNull();
  });

  it('finds the scheduled lines of a bill and the ones a setting covers', () => {
    const products = [
      { id: 1, title: 'ALPREK 0.25MG', schedule: 'H1' as const, pack: 30 },
      { id: 2, title: 'ATLOL 25MG', schedule: 'H' as const, pack: 14 },
    ];
    const lines = [{ id: 10, productid: 1, qty: 2, batch: 'G-7103' }, { id: 11, productid: 2, qty: 1 }, { id: 12, productid: 3, qty: 5 }, { id: 13, productid: 1, qty: 0 }];
    const found = scheduledLines(lines, products);
    expect(found.map((f) => f.line.id)).toEqual([10, 11]);                                   // an unscheduled product and a zero quantity are left out
    expect(requiredLines(found, ['H1']).map((f) => f.product.schedule)).toEqual(['H1']);
    expect(requiredLines(found, []).length).toBe(0);
    expect(schedulesOf(found)).toEqual(['H1', 'H']);
  });

  it('makes one register line for each scheduled drug supplied, and numbers the register per schedule', () => {
    const f = scheduledLines([{ id: 10, itemid: 77, productid: 1, qty: 2.9, batch: 'G-7103' }], [{ id: 1, title: 'ALPREK 0.25MG', schedule: 'H1', pack: 30 }]);
    expect(draftEntries(f)).toEqual([{ schedule: 'H1', sale_item_id: 10, product_id: 1, drug_name: 'ALPREK 0.25MG', batch: 'G-7103', qty: 2, pack: 30, itemid: 77 }]);
    expect(serialLabel('H1', 7)).toBe('H1-0007');
    expect(serialLabel('H', 12345)).toBe('H-12345');
  });
});
