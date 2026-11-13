import { DEFAULT_BILL_LAYOUT, checkBillLayout, effectiveBillLayout, nameWithSuffix } from './bill-layout';

describe('bill layout', () => {
  it('a business with nothing saved prints the standard bill', () => {
    expect(effectiveBillLayout(null)).toEqual(DEFAULT_BILL_LAYOUT);
    expect(effectiveBillLayout({})).toEqual(DEFAULT_BILL_LAYOUT);
    expect(effectiveBillLayout('rubbish')).toEqual(DEFAULT_BILL_LAYOUT);
    expect(DEFAULT_BILL_LAYOUT.showwords).toBe(false);
    expect(DEFAULT_BILL_LAYOUT.showrefill).toBe(true);
  });

  it('keeps what was chosen and fixes what is damaged', () => {
    const l = effectiveBillLayout({ showwords: true, namesuffix: 'TM', showrefill: false, printer: 'LINE', socials: [{ label: ' Instagram ', handle: '@my  shop' }, { label: 'x', handle: '' }] });
    expect(l).toEqual({ printer: 'A4', showwords: true, namesuffix: 'TM', socials: [{ label: 'Instagram', handle: '@my shop' }], showrefill: false });
    expect(effectiveBillLayout({ namesuffix: 'Q', showwords: 'yes' })).toEqual(DEFAULT_BILL_LAYOUT);
  });

  it('refuses wrong settings with a message', () => {
    expect(checkBillLayout(null).ok).toBe(false);
    expect(checkBillLayout({ namesuffix: 'Q' }).ok).toBe(false);
    expect(checkBillLayout({ printer: 'LINE' }).ok).toBe(false);
    expect(checkBillLayout({ showwords: 'yes' }).ok).toBe(false);
    expect(checkBillLayout({ socials: [{ label: 'Instagram', handle: '' }] }).ok).toBe(false);
    expect(checkBillLayout({ socials: [{ label: 'a'.repeat(21), handle: '@x' }] }).ok).toBe(false);
    expect(checkBillLayout({ socials: Array.from({ length: 9 }, () => ({ label: 'a', handle: '@x' })) }).ok).toBe(false);
  });

  it('accepts a good layout, dropping empty social rows', () => {
    const r = checkBillLayout({ showwords: false, namesuffix: 'R', socials: [{ label: 'Instagram', handle: '@shop' }, { label: '', handle: '' }] });
    expect(r).toEqual({ ok: true, value: { printer: 'A4', showwords: false, namesuffix: 'R', socials: [{ label: 'Instagram', handle: '@shop' }], showrefill: true } });
  });

  it('puts the sign after the name once', () => {
    expect(nameWithSuffix('Ram Pharmacy', 'R')).toBe('Ram Pharmacy®');
    expect(nameWithSuffix('Ram Pharmacy', 'TM')).toBe('Ram Pharmacy™');
    expect(nameWithSuffix('Ram Pharmacy®', 'R')).toBe('Ram Pharmacy®');
    expect(nameWithSuffix('Ram Pharmacy', 'NONE')).toBe('Ram Pharmacy');
    expect(nameWithSuffix('Ram Pharmacy', null)).toBe('Ram Pharmacy');
    expect(nameWithSuffix('', 'R')).toBe('');
  });
});
