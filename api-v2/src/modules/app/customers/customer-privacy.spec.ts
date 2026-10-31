import { MASK, isMasked, maskAddress, maskContact, maskEmail, maskMobile } from './customer-privacy';

describe('customer privacy masks', () => {
  it('keeps the first two and last three digits of a mobile', () => {
    expect(maskMobile('9876543210')).toBe(`98${MASK.repeat(5)}210`);
    expect(maskMobile(null)).toBeNull();
    expect(maskMobile('')).toBeNull();
    expect(isMasked(maskMobile('9876543210'))).toBe(true);
  });

  it('hides an odd-shaped number completely rather than leaking part of it', () => {
    expect(maskMobile('12345')).toBe(MASK.repeat(6));
  });

  it('keeps the first letter and the domain of an email, and hides an address whole', () => {
    expect(maskEmail('jane.doe@gmail.com')).toBe(`j${MASK.repeat(3)}@gmail.com`);
    expect(maskEmail('')).toBeNull();
    expect(maskAddress('21 Park Road')).toBe(MASK.repeat(6));
    expect(maskAddress(null)).toBeNull();
  });

  it('never mistakes real data for a mask, so a real edit is never dropped', () => {
    for (const v of ['9876543210', 'jane@x.com', '21 Park Rd, Xxxx', 'Alex']) expect(isMasked(v)).toBe(false);
    expect(isMasked(undefined)).toBe(false);
  });

  it('masks every contact field of a customer and leaves the name and place readable', () => {
    const out = maskContact({ id: 1, name: 'Jane', locality: 'Adyar', mobile: '9876543210', altmobile: '9123456780', email: 'jane@x.com', address: '1 Road' } as any);
    expect(out.name).toBe('Jane');
    expect((out as any).locality).toBe('Adyar');
    for (const f of ['mobile', 'altmobile', 'email', 'address'] as const) expect(isMasked(out[f])).toBe(true);
    expect(out.masked).toBe(true);
  });
});
