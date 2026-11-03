import { detailProblems, distinctPatients, distinctPrescribers, draftEntries, normaliseDetail, parseRequired, requiredLines, scheduledLines, schedulesOf, serialLabel, normaliseRx, parseStandingMonths, rxProblems, standingState, validUntil } from './drug-register-rules';

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

  it('reads how the prescription stands: a prescription on the bill is attached, "Other" needs words, "Later" needs a day within 30 days', () => {
    const today = '2026-11-01';
    const rx = { id: 9, category: 'Prescription' };
    expect(normaliseRx({}, [])).toEqual({ basis: null, note: '', due: null, documentId: null });
    expect(normaliseRx({}, [rx])).toMatchObject({ basis: 'ATTACHED', documentId: 9 });
    expect(normaliseRx({ rx_basis: 'LATER', rx_due: '2026-11-04' }, [rx])).toMatchObject({ basis: 'ATTACHED', due: null });    // it arrived: nothing to chase
    expect(normaliseRx({ rx_basis: 'ON_FILE', rx_document_id: 4 }, [])).toMatchObject({ basis: 'ON_FILE', documentId: 4 });
    expect(normaliseRx({ rx_basis: 'nonsense' }, []).basis).toBeNull();
    expect(rxProblems({ rx_basis: 'OTHER' }, [], today)).toEqual(['a few words on why there is no prescription']);
    expect(rxProblems({ rx_basis: 'OTHER', rx_note: 'doctor is a relative' }, [], today)).toEqual([]);
    expect(rxProblems({ rx_basis: 'LATER' }, [], today).length).toBe(1);
    expect(rxProblems({ rx_basis: 'LATER', rx_due: '2026-10-31' }, [], today).length).toBe(1);
    expect(rxProblems({ rx_basis: 'LATER', rx_due: '2026-12-02' }, [], today).length).toBe(1);
    expect(rxProblems({ rx_basis: 'LATER', rx_due: '2026-12-01' }, [], today)).toEqual([]);
    expect(rxProblems({ rx_basis: 'REGULAR' }, [], today)).toEqual([]);
  });

  it('says how long a prescription can be used again: months from its date, the last day of a shorter month, and expired when it has no date', () => {
    expect(validUntil('2026-10-03', 6)).toBe('2027-04-03');
    expect(validUntil('2026-08-31', 6)).toBe('2027-02-28');
    expect(validUntil('2026-12-15', 1)).toBe('2027-01-15');
    expect(standingState('2026-05-01', '2026-11-01', 6)).toEqual({ valid_until: '2026-11-01', expired: false });   // the last day still counts
    expect(standingState('2026-05-01', '2026-11-02', 6)).toEqual({ valid_until: '2026-11-01', expired: true });
    expect(standingState('', '2026-11-01', 6)).toEqual({ valid_until: null, expired: true });
    expect(parseStandingMonths('6')).toBe(6);
    expect(parseStandingMonths('0')).toBe(6);
    expect(parseStandingMonths('99')).toBe(6);
    expect(parseStandingMonths(undefined)).toBe(6);
    expect(parseStandingMonths('12')).toBe(12);
  });
});

describe('people offered for copying on the counter', () => {
  const rows = [
    { patient_name: 'Meena Kumar', patient_address: '', patient_age: '67', prescriber_name: 'Dr Rao', prescriber_reg_no: '', prescriber_address: '', entry_on: '2026-11-02' },
    { patient_name: 'RAVI KUMAR', patient_address: '12 Main Road', patient_age: '42', prescriber_name: 'Dr Anitha', prescriber_reg_no: 'TN8821', prescriber_address: 'Clinic A', entry_on: '2026-10-20' },
    { patient_name: 'meena kumar', patient_address: '12 Main Road', patient_age: '66', prescriber_name: 'DR RAO', prescriber_reg_no: 'TN4455', prescriber_address: 'Rao Clinic', entry_on: '2026-10-12' },
    { patient_name: ' ', patient_address: 'x', patient_age: '', prescriber_name: 'Dr', prescriber_reg_no: '', prescriber_address: '', entry_on: '2026-10-01' },
  ];

  it('lists each patient once, newest first, whatever the case of the name', () => {
    expect(distinctPatients(rows).map((p) => p.name)).toEqual(['Meena Kumar', 'RAVI KUMAR']);
  });

  it('keeps the newest values and fills what is missing from an older line of the same person', () => {
    const meena = distinctPatients(rows)[0];
    expect(meena).toMatchObject({ name: 'Meena Kumar', age: '67', address: '12 Main Road', last_on: '2026-11-02' });   // newest age, address from the older line
  });

  it('lists each doctor once, with the registration number and clinic from an older line when the newest has none', () => {
    const list = distinctPrescribers(rows);
    expect(list.map((d) => d.name)).toEqual(['Dr Rao', 'Dr Anitha']);
    expect(list[0]).toMatchObject({ reg_no: 'TN4455', address: 'Rao Clinic' });
  });

  it('leaves out lines with no usable name, honours the limit, and copes with nothing', () => {
    expect(distinctPatients([{ patient_name: '' }, { patient_name: 'A' }])).toEqual([]);
    expect(distinctPrescribers([{ prescriber_name: 'Dr' }])).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => ({ patient_name: `Patient ${i}`, prescriber_name: `Doctor ${i}` }));
    expect(distinctPatients(many, 3)).toHaveLength(3);
    expect(distinctPrescribers(many)).toHaveLength(5);
    expect(distinctPatients(undefined as any)).toEqual([]);
  });
});

