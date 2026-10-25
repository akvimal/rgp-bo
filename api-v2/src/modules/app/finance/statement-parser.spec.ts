import { detectDateFormat, parseAmount, parseDate, parseText, roleOf } from './statement-parser';

// a fixed-width, comma-separated text statement like the ones HDFC gives: padded fields, a blank first line, a comma inside a narration
const HDFC = [
  '',
  '  Date     ,Narration                                  ,Value Dat,Debit Amount       ,Credit Amount      ,Chq/Ref Number   ,Closing Balance',
  ' 01/09/26  ,NEFT CR-YESB0000001-PAYTM PAYMENTS SERVICES LIMITED-SHOP-YESAP1,01/09/26 ,          0.00     ,       6340.48     ,YESAP1       ,    439057.26  ',
  ' 01/09/26  ,CASH DEPOSIT BY - A PERSON - AREA                ,01/09/26 ,          0.00     ,      35020.00     ,000000000000000        ,    474077.26  ',
  ' 03/09/26  ,57500001200193-TPT-100392-ACME PHARMA DISTRIBUTORS PVT LTD-MOG,03/09/26 ,       1341.00     ,          0.00     ,0000000853365148       ,    472736.26  ',
  ' 04/09/26  ,NEFT DR-BARB0X-ACME PHARMA-SHOP,MUM-HDFCH000-2307,04/09/26 ,       2000.00     ,          0.00     ,HDFCH000       ,    470736.26  ',
].join('\r\n');

describe('statement parser', () => {
  it('reads an HDFC-style statement: padded fields, blank first line, commas in a narration', () => {
    const p = parseText(HDFC);
    expect(p.recognised).toBe(true);
    expect(p.mapping!.dateFormat).toBe('dd/mm/yy');
    expect(p.rows).toHaveLength(4);
    expect(p.rows[0]).toMatchObject({ date: '2026-09-01', credit: 6340.48, debit: 0, balance: 439057.26, ref: 'YESAP1' });
    expect(p.rows[3].narration).toBe('NEFT DR-BARB0X-ACME PHARMA-SHOP,MUM-HDFCH000-2307');   // the comma stayed in the narration
    expect(p.rows[3]).toMatchObject({ debit: 2000, ref: 'HDFCH000', balance: 470736.26 });
  });

  it('works out the opening balance and checks that the balances chain', () => {
    const p = parseText(HDFC);
    expect(p.meta).toMatchObject({ from: '2026-09-01', to: '2026-09-04', opening: 432716.78, closing: 470736.26, debits: 3341, credits: 41360.48, hasBalance: true });
    expect(p.meta.breaks).toEqual([]);
  });

  it('flags a line that is missing: the balance does not follow', () => {
    const missing = HDFC.split('\r\n').filter((l) => !l.includes('03/09/26')).join('\r\n');
    const p = parseText(missing);
    expect(p.meta.breaks).toEqual([2]);
    expect(p.warnings.join(' ')).toMatch(/may be missing/);
  });

  it('reads another bank: quoted csv, Withdrawal and Deposit columns, dd-mmm-yyyy dates, newest first', () => {
    const icici = [
      'Account Statement for something',
      'Txn Date,Description,Ref No.,Withdrawal Amt.,Deposit Amt.,Balance',
      '"05-Sep-2026","UPI/123/Rent, shop","REF9","1,500.00","","8,500.00"',
      '"04-Sep-2026","Cash deposit","","","2,000.00","10,000.00"',
    ].join('\n');
    const p = parseText(icici);
    expect(p.recognised).toBe(true);
    expect(p.meta.reversed).toBe(true);                                 // listed newest first, stored in time order
    expect(p.rows.map((r) => r.date)).toEqual(['2026-09-04', '2026-09-05']);
    expect(p.rows[1]).toMatchObject({ debit: 1500, credit: 0, balance: 8500, narration: 'UPI/123/Rent, shop' });
    expect(p.meta.breaks).toEqual([]);
    expect(p.meta.opening).toBe(8000);
  });

  it('reads a semicolon file with one amount column and Dr/Cr', () => {
    const t = ['Date;Particulars;Amount;Dr/Cr;Balance', '01/10/2026;Salary;5000;Dr;15000', '02/10/2026;Sale;2000;Cr;17000'].join('\n');
    const p = parseText(t);
    expect(p.recognised).toBe(true);
    expect(p.rows.map((r) => [r.debit, r.credit])).toEqual([[5000, 0], [0, 2000]]);
    expect(p.meta.breaks).toEqual([]);
  });

  it('reads a negative amount as a debit when there is no type column', () => {
    const p = parseText(['Date,Description,Amount', '2026-10-01,Fee,-50.00', '2026-10-02,Deposit,200.00'].join('\n'));
    expect(p.rows.map((r) => [r.debit, r.credit])).toEqual([[50, 0], [0, 200]]);
    expect(p.meta.hasBalance).toBe(false);
    expect(p.warnings.join(' ')).toMatch(/no balance column/);
  });

  it('does not recognise a file it cannot read, and returns a sample so the columns can be chosen', () => {
    const p = parseText(['a,b,c', '1,2,3', '4,5,6'].join('\n'));
    expect(p.recognised).toBe(false);
    expect(p.sample.length).toBe(3);
  });

  it('accepts the columns a person chose', () => {
    const t = ['x,y,z,w', '2026-10-01,Fee,50,1000', '2026-10-02,Deposit,200,1200'].join('\n');
    expect(parseText(t).recognised).toBe(false);
    const p = parseText(t, { headerRow: 0, columns: ['date', 'narration', 'ignore', 'balance'] });
    expect(p.recognised).toBe(false);                                   // still no money column
    const q = parseText(t, { headerRow: 0, columns: ['date', 'narration', 'amount', 'balance'], dateFormat: 'yyyy-mm-dd' });
    expect(q.recognised).toBe(true);
    expect(q.rows).toHaveLength(2);
  });

  it('skips a footer and lines without a date', () => {
    const p = parseText(HDFC + '\r\n\r\nClosing balance,470736.26\r\n*** end ***');
    expect(p.rows).toHaveLength(4);
    expect(p.skipped).toBeGreaterThanOrEqual(1);
  });

  it('understands headings, dates and amounts', () => {
    expect(roleOf('Value Dat')).toBe('valueDate');
    expect(roleOf('Chq/Ref Number')).toBe('ref');
    expect(roleOf('Transaction Date')).toBe('date');
    expect(roleOf('Transaction Remarks')).toBe('narration');
    expect(roleOf('Sr No')).toBe('ignore');
    expect(parseDate('31/04/26', 'dd/mm/yy')).toBeNull();               // April has 30 days
    expect(parseDate('15-Oct-2026', 'dd-mmm-yyyy')).toBe('2026-10-15');
    expect(detectDateFormat(['01/09/26', '15/09/26'])).toBe('dd/mm/yy');
    expect(parseAmount('1,23,456.50')).toBe(123456.5);
    expect(parseAmount('(250.00)')).toBe(-250);
    expect(parseAmount('500.00 Dr')).toBe(-500);
    expect(parseAmount('')).toBe(0);
  });
});
