import { DEFAULT_FOOTER, cleanFooter, footerText, formatPhones, renderFooter } from './bill-footer';

const ctx = { store_name: 'Main Street', business_name: 'RGP Pharmacy', store_phone: '9876543210', business_phone: '04412345678', grievance_phone: '', website: 'www.rgp.in', bill_no: 'B-12', date: '12 Nov 2026' };

describe('phone numbers on the bill', () => {
  it('lays a mobile number out three ways', () => {
    expect(formatPhones('9876543210')).toBe('98765 43210');
    expect(formatPhones('9876543210', 'intl')).toBe('+91 98765 43210');
    expect(formatPhones('98765 43210', 'plain')).toBe('9876543210');
    expect(formatPhones('+91 98765-43210')).toBe('98765 43210');
    expect(formatPhones('09876543210')).toBe('98765 43210');
  });
  it('formats each of several numbers and leaves a landline as typed', () => {
    expect(formatPhones('9876543210, 04412345678')).toBe('98765 43210, 04412345678');
    expect(formatPhones('9876543210/9123456780', 'intl')).toBe('+91 98765 43210, +91 91234 56780');
    expect(formatPhones('')).toBe('');
    expect(formatPhones(null)).toBe('');
  });
});

describe('the foot of the bill', () => {
  it('renders the standard foot, and drops the line whose number is empty', () => {
    const t = footerText(renderFooter('', ctx));
    expect(t).toContain('For refill and complaints call or WhatsApp: 98765 43210');
    expect(t).not.toContain('grievances');                       // no grievance number: no such line
    expect(t).toContain('www.rgp.in');
    expect(t).toContain('Thank you for choosing us');
    expect(renderFooter(null, ctx)).toEqual(renderFooter(DEFAULT_FOOTER, ctx));
  });

  it('fills the tokens and the phone modifiers', () => {
    const t = footerText(renderFooter('{business_name}, {store_name}\nCall {store_phone|intl} or {business_phone}', ctx));
    expect(t).toBe('RGP Pharmacy, Main Street\nCall +91 98765 43210 or 04412345678');
  });

  it('reads bold, italic and alignment', () => {
    const lines = renderFooter('[r]Thanks **a lot** from _us_ today\n[l]plain', ctx);
    expect(lines[0].align).toBe('r');
    expect(lines[0].parts).toEqual([{ text: 'Thanks ' }, { text: 'a lot', bold: true }, { text: ' from ' }, { text: 'us', italic: true }, { text: ' today' }]);
    expect(lines[1]).toEqual({ align: 'l', parts: [{ text: 'plain' }] });
    expect(renderFooter('centred by default', ctx)[0].align).toBe('c');
  });

  it('keeps underscores in words, leaves unknown tokens as written, and ignores blank lines', () => {
    expect(footerText(renderFooter('mail us at sales_team@rgp.in\n\n{nothing} stays', ctx))).toBe('mail us at sales_team@rgp.in\n{nothing} stays');
  });

  it('keeps a line with no tokens even when it is only text, and drops a line made only of empty tokens', () => {
    const t = footerText(renderFooter('Open every day\nGrievances: {grievance_phone}\nWebsite: {website} {grievance_phone}', ctx));
    expect(t).toBe('Open every day\nWebsite: www.rgp.in');
  });
});

describe('saving a template', () => {
  it('keeps the lines, trims them, and treats empty as the standard', () => {
    expect(cleanFooter('  a  b \r\n\n  c ').value).toBe('a b\nc');
    expect(cleanFooter('  \n ').value).toBeNull();
    expect(cleanFooter(null).value).toBeNull();
    expect(cleanFooter('x'.repeat(1300)).ok).toBe(false);
    expect(cleanFooter(5 as any).ok).toBe(false);
  });
});
