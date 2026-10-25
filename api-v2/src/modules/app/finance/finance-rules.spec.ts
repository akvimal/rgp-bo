import { bridge, channel, classify, counterpartyOf, dedupeKeys, kindOf, monthBounds, signoffProblems, vendorMatch, within } from './finance-rules';

describe('finance rules', () => {
  it('reads what a narration is', () => {
    expect(kindOf('NEFT CR-YESB0000001-PAYTM PAYMENTS SERVICES LIMITED-SHOP-YESAP1')).toBe('NEFT');
    expect(kindOf('CASH DEPOSIT BY - A PERSON - AREA')).toBe('CASH');
    expect(kindOf('57500001200193-TPT-100392-ACME PHARMA-MOG')).toBe('TRANSFER');
    expect(kindOf('UPI-SOMEONE-x@bank-ICIC0001-123')).toBe('UPI');
    expect(kindOf('SMS CHARGES 1Q26')).toBe('CHARGE');
    expect(kindOf('SOMETHING ELSE')).toBe('OTHER');
  });

  it('finds who the money came from or went to', () => {
    expect(counterpartyOf('NEFT DR-BARB0X-ACME PHARMA-SHOP,MUM-HDFCH000-2307')).toBe('ACME PHARMA');
    expect(counterpartyOf('57500001200193-TPT-100392-ACME PHARMA DISTRIBUTORS PVT LTD-MOG')).toBe('ACME PHARMA DISTRIBUTORS PVT LTD');
    expect(counterpartyOf('UPI-RAVI KUMAR-ravi@okbank-ICIC0001-998')).toBe('RAVI KUMAR');
    expect(counterpartyOf('CASH DEPOSIT BY - A PERSON - AREA')).toBe('A PERSON');
    expect(counterpartyOf('ATM WDL 1234')).toBeNull();
  });

  it('tags the lines that are always the same kind of money', () => {
    expect(classify('NEFT CR-YESB0000001-PAYTM PAYMENTS SERVICES LIMITED-SHOP-YESAP1', 0, 6340).tag).toBe('DIGITAL_SETTLEMENT');
    expect(classify('CASH DEPOSIT BY - A PERSON - AREA', 0, 35020).tag).toBe('CASH_DEPOSIT');
    expect(classify('NEFT DR-TNSC0001-LANDLORD-SHOP,MUM-HDFCH000-RENT', 25000, 0)).toMatchObject({ tag: 'EXPENSE', category: 'Rent' });
    expect(classify('SMS CHARGES', 20, 0).tag).toBe('BANK_CHARGES');
    expect(classify('INT.PD:01-07-2026 TO 30-09-2026', 0, 120).tag).toBe('OTHER_INCOME');
    expect(classify('SALARY SEP', 15000, 0).tag).toBe('SALARY');
    expect(classify('UPI-GOODS AND SERVICE TA-GOODSANDSERVICETAX@SBI-SBIN0000-1', 6696, 0).tag).toBe('GST_TAX');
    expect(classify('UPI-AUTOPAY-WWW AIRTEL IN-AIRTELAUTOPAY.PAYU@AXISBANK-UTIB0001-9', 588.82, 0)).toMatchObject({ tag: 'EXPENSE', category: 'Internet and phone' });
  });

  it('leaves a payment to a person or a supplier untagged until someone says what it is', () => {
    expect(classify('NEFT DR-BARB0X-ACME PHARMA-SHOP,MUM-HDFCH000-2307', 2000, 0).tag).toBeNull();
    expect(classify('UPI-RAVI KUMAR-ravi@okbank-ICIC0001-998', 500, 0).tag).toBeNull();
  });

  it('applies a rule a person made before the built-in ones, in its own direction', () => {
    const rules = [{ pattern: 'ravi kumar', direction: 'DEBIT' as const, tag: 'OWNER', vendor_id: null, expense_category: null }];
    expect(classify('UPI-RAVI KUMAR-ravi@okbank-ICIC0001-998', 500, 0, rules)).toMatchObject({ tag: 'OWNER', reason: 'Your rule: ravi kumar' });
    expect(classify('UPI-RAVI KUMAR-ravi@okbank-ICIC0001-998', 0, 500, rules).tag).toBeNull();   // a credit is not covered by a debit rule
  });

  it('matches a payee to one vendor only when it is clear', () => {
    const vendors = [
      { id: 1, names: ['Acme Pharma Distributors Private Limited'] },
      { id: 2, names: ['Wings Sales Corporation'] },
      { id: 3, names: ['Acme Drug House', 'Acme Drugs'] },
    ];
    expect(vendorMatch('ACME PHARMA DISTRIBUTORS PVT LTD', vendors)).toBe(1);
    expect(vendorMatch('WINGS SALES CORPORATION', vendors)).toBe(2);
    expect(vendorMatch('ACME', vendors)).toBeNull();                       // one word is shared by two vendors: not clear
    expect(vendorMatch('SOMEONE UNKNOWN', vendors)).toBeNull();
    expect(vendorMatch(null, vendors)).toBeNull();
  });

  it('keeps one key per line, and tells two identical lines in a file apart', () => {
    const row = { date: '2026-09-01', narration: 'CASH DEPOSIT', debit: 0, credit: 500, balance: null, ref: '' };
    const a = dedupeKeys([row, row]);
    expect(a[0]).not.toBe(a[1]);
    expect(dedupeKeys([row])[0]).toBe(a[0]);                               // the same line in another file is the same line
    expect(dedupeKeys([{ ...row, narration: 'cash   deposit' }])[0]).toBe(a[0]);
    expect(dedupeKeys([{ ...row, credit: 501 }])[0]).not.toBe(a[0]);
  });

  it('bridges the opening balance to the closing balance', () => {
    expect(bridge(1000, 500, 200, 1300)).toEqual({ expected: 1300, difference: 0 });
    expect(bridge(1000, 500, 200, 1250)).toEqual({ expected: 1300, difference: -50 });
  });

  it('accepts a difference up to the tolerance, either way', () => {
    expect(within(100, 100)).toBe(true);
    expect(within(-100, 100)).toBe(true);
    expect(within(100.01, 100)).toBe(false);
    expect(channel('digital', 'Card / UPI', 214431, 169131.31, 100)).toMatchObject({ difference: 45299.69, within: false });
    expect(channel('cash', 'Cash', 1000, 950, 100).within).toBe(true);
  });

  it('needs a reason and a note for every difference outside the tolerance before a month is signed', () => {
    const ch = [channel('digital', 'Card / UPI', 1000, 500, 100), channel('cash', 'Cash', 100, 50, 100)];
    expect(signoffProblems(ch, undefined)).toHaveLength(1);
    expect(signoffProblems(ch, { digital: { code: 'FEES' } })[0]).toMatch(/note/);
    expect(signoffProblems(ch, { digital: { code: 'NOPE', note: 'because' } })[0]).toMatch(/reason/);
    expect(signoffProblems(ch, { digital: { code: 'OTHER_ACCOUNT', note: 'owner QR' } })).toEqual([]);
  });

  it('finds the bounds of a month', () => {
    expect(monthBounds('2026-09-15')).toEqual({ start: '2026-09-01', next: '2026-10-01' });
    expect(monthBounds('2026-12')).toEqual({ start: '2026-12-01', next: '2027-01-01' });
  });
});
