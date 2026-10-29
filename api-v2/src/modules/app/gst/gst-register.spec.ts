import { closeProblem, findGaps, groupHsn, hsnIssues, isMonth, monthBounds, monthIsOver, monthLabel, netByRate, parseArn, payable, sumTotals } from './gst-register';

describe('months', () => {
  it('knows its bounds, label and when it is over', () => {
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds('2028-02').to).toBe('2028-02-29');
    expect(monthBounds('2026-12').to).toBe('2026-12-31');
    expect(monthLabel('2026-09')).toBe('September 2026');
    expect(monthIsOver('2026-09', '2026-10-01')).toBe(true);
    expect(monthIsOver('2026-10', '2026-10-31')).toBe(false);
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('2026-9')).toBe(false);
    expect(isMonth('2026-09')).toBe(true);
  });
});

describe('HSN summary', () => {
  const lines = [
    { hsn: '30049099', source: 'own' as const, rate: 5, qty: 10, taxable: 100, tax: 5, product: 'A' },
    { hsn: '30049099', source: 'own' as const, rate: 5, qty: 5, taxable: 50, tax: 2.5, product: 'B' },
    { hsn: '3004', source: 'category' as const, rate: 5, qty: 2, taxable: 20, tax: 1, product: 'C' },
    { hsn: null, source: 'none' as const, rate: 12, qty: 1, taxable: 10, tax: 1.2, product: 'D' },
    { hsn: '30049099', source: 'own' as const, rate: 5, qty: -1, taxable: -10, tax: -0.5, product: 'A' },      // a credit note
  ];

  it('groups by code and rate, nets credit notes, and counts the products', () => {
    const rows = groupHsn(lines);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ hsn: '3004', source: 'category', qty: 2, taxable: 20 });
    expect(rows[1]).toMatchObject({ hsn: '30049099', source: 'own', rate: 5, qty: 14, taxable: 140, tax: 7, products: 2 });
    expect(rows[2]).toMatchObject({ hsn: '', source: 'none', rate: 12 });                  // not known comes last
  });

  it('lists what stands between the summary and a return', () => {
    const i = hsnIssues(groupHsn(lines), 6);
    expect(i).toMatchObject({ unknown_rows: 1, unknown_value: 10, provisional_rows: 1, provisional_value: 20, short_rows: 1, digits: 6, clean: false });
    expect(hsnIssues(groupHsn(lines.slice(0, 2)), 4).clean).toBe(true);
  });
});

describe('totals', () => {
  const inv = [{ rate: 5, taxable: 100, cgst: 2.5, sgst: 2.5, igst: 0, tax: 5 }, { rate: 12, taxable: 100, cgst: 6, sgst: 6, igst: 0, tax: 12 }, { rate: 5, taxable: 100, cgst: 0, sgst: 0, igst: 5, tax: 5 }];
  const cn = [{ rate: 5, taxable: 20, cgst: 0.5, sgst: 0.5, igst: 0, tax: 1 }];

  it('takes credit notes off the tax invoices, rate by rate', () => {
    const net = netByRate(inv, cn);
    expect(net).toEqual([
      { rate: 5, taxable: 180, cgst: 2, sgst: 2, igst: 5, tax: 9 },
      { rate: 12, taxable: 100, cgst: 6, sgst: 6, igst: 0, tax: 12 },
    ]);
    expect(sumTotals(net)).toEqual({ taxable: 280, cgst: 8, sgst: 8, igst: 5, tax: 21 });
  });

  it('shows tax payable after the credit, or credit to carry forward', () => {
    expect(payable(21, 10)).toEqual({ payable: 11, carry_forward: 0 });
    expect(payable(10, 21)).toEqual({ payable: 0, carry_forward: 11 });
    expect(payable(10, 10)).toEqual({ payable: 0, carry_forward: 0 });
  });
});

describe('gaps and ARN', () => {
  it('finds numbers missing from a series, each prefix and year on its own', () => {
    expect(findGaps(['INV/26-27/000001', 'INV/26-27/000002', 'INV/26-27/000005', 'CN/26-27/000001'])).toEqual(['INV/26-27/000003', 'INV/26-27/000004']);
    expect(findGaps(['INV/26-27/000001', 'INV/27-28/000001'])).toEqual([]);
    expect(findGaps([])).toEqual([]);
  });

  it('accepts an ARN as letters and digits, or none', () => {
    expect(parseArn(' aa330126123456z ').value).toBe('AA330126123456Z');
    expect(parseArn('').value).toBeNull();
    expect(parseArn('a b').error).toBeTruthy();
    expect(parseArn('AB1').error).toBeTruthy();
  });
});

describe('closing a month', () => {
  const ok = { registered: true, goLive: '2026-04-01', month: '2026-09', today: '2026-10-25', alreadyClosed: false, issues: { unknown_rows: 0, provisional_rows: 0, short_rows: 0, digits: 4 }, acceptHsn: false };

  it('closes a finished month of a registered business with a clean HSN summary', () => {
    expect(closeProblem(ok)).toBeNull();
  });

  it('refuses a business not registered, a month not over, a month before go-live and a month already closed', () => {
    expect(closeProblem({ ...ok, registered: false })).toMatch(/registered/);
    expect(closeProblem({ ...ok, month: '2026-10' })).toMatch(/once it is over/);
    expect(closeProblem({ ...ok, month: '2026-03' })).toMatch(/before the go-live/);
    expect(closeProblem({ ...ok, alreadyClosed: true })).toMatch(/already closed/);
  });

  it('needs the Business Head to accept HSN codes that are unknown, provisional or too short', () => {
    const bad = { ...ok, issues: { unknown_rows: 2, provisional_rows: 1, short_rows: 0, digits: 4 } };
    expect(closeProblem(bad)).toMatch(/2 line\(s\) with no HSN, 1 on a provisional/);
    expect(closeProblem({ ...bad, acceptHsn: true })).toBeNull();
  });
});
