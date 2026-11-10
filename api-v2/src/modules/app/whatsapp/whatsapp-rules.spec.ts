import { billLabel, billParams, canSendService, classifyMetaError, isStopWord, normaliseMobile, overMonthlyCap, retryInMinutes, templateName } from './whatsapp-rules';

describe('whatsapp rules', () => {
  it('normalises Indian mobiles', () => {
    expect(normaliseMobile('98765 43210')).toBe('919876543210');
    expect(normaliseMobile('+91 98765-43210')).toBe('919876543210');
    expect(normaliseMobile('09876543210')).toBe('919876543210');
    expect(normaliseMobile('919876543210')).toBe('919876543210');
  });
  it('rejects numbers that are not mobiles', () => {
    for (const v of [null, '', '12345', '5876543210', '98765432101', 'abc']) expect(normaliseMobile(v)).toBeNull();
  });
  it('names templates by kind and language', () => {
    expect(templateName('BILL', 'en')).toBe('bill_copy_en');
    expect(templateName('REFILL', 'ta')).toBe('refill_due_ta');
  });
  it('lets service messages go unless the customer said no or switched contact off', () => {
    expect(canSendService({ mobile: '9876543210', do_not_contact: false, contact_consent: null }).ok).toBe(true);
    expect(canSendService({ mobile: '9876543210', do_not_contact: false, contact_consent: 'YES' }).ok).toBe(true);
    expect(canSendService({ mobile: '9876543210', do_not_contact: false, contact_consent: 'NO' }).ok).toBe(false);
    expect(canSendService({ mobile: '9876543210', do_not_contact: true, contact_consent: 'YES' }).ok).toBe(false);
    expect(canSendService({ mobile: null, do_not_contact: false, contact_consent: null }).ok).toBe(false);
  });
  it('builds the bill parameters without line breaks or long text', () => {
    expect(billParams('Ravi\nKumar', 'RGP  Pharmacy', 'INV/1', 1234.5)).toEqual(['Ravi Kumar', 'RGP Pharmacy', 'INV/1', '1234.50']);
    expect(billParams(null, 'S', '7', 100)[0]).toBe('Customer');
    expect(billParams('x'.repeat(100), 'S', '7', 100)[0].length).toBe(40);
  });
  it('labels a bill by tax invoice number, else bill number, else id', () => {
    expect(billLabel({ gstinvoiceno: 'A/1', billno: 5, id: 9 })).toBe('A/1');
    expect(billLabel({ gstinvoiceno: null, billno: 5, id: 9 })).toBe('5');
    expect(billLabel({ gstinvoiceno: null, billno: null, id: 9 })).toBe('9');
  });
  it('applies the monthly cap', () => {
    expect(overMonthlyCap(999, 1000)).toBe(false);
    expect(overMonthlyCap(1000, 1000)).toBe(true);
    expect(overMonthlyCap(0, 0)).toBe(true);
  });
  it('classifies Meta errors', () => {
    expect(classifyMetaError(401, 190)).toEqual({ permanent: true, auth: true });
    expect(classifyMetaError(429, 130429).permanent).toBe(false);
    expect(classifyMetaError(400, 131026).permanent).toBe(true);
    expect(classifyMetaError(400, 132001).permanent).toBe(true);
    expect(classifyMetaError(500, undefined).permanent).toBe(false);
  });
  it('retries a few times then gives up', () => {
    expect(retryInMinutes(1)).toBe(1);
    expect(retryInMinutes(4)).toBe(120);
    expect(retryInMinutes(5)).toBeNull();
  });
  it('recognises stop words in English and Tamil', () => {
    expect(isStopWord(' STOP ')).toBe(true);
    expect(isStopWord('நிறுத்து')).toBe(true);
    expect(isStopWord('thanks')).toBe(false);
  });
});
