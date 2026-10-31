import { checkWebsite } from './website';

describe('checkWebsite', () => {
  it('keeps a web address as typed and accepts an empty box', () => {
    expect(checkWebsite(' www.yourshop.in ')).toEqual({ ok: true, value: 'www.yourshop.in' });
    expect(checkWebsite('https://shop.example.co.in/pharmacy?x=1')).toEqual({ ok: true, value: 'https://shop.example.co.in/pharmacy?x=1' });
    expect(checkWebsite('')).toEqual({ ok: true, value: null });
    expect(checkWebsite(undefined)).toEqual({ ok: true, value: null });
  });

  it('refuses text that is not an address, spaces inside, and anything too long', () => {
    expect(checkWebsite('my shop').ok).toBe(false);
    expect(checkWebsite('shop').ok).toBe(false);
    expect(checkWebsite('javascript:alert(1)').ok).toBe(false);
    expect(checkWebsite('www.' + 'a'.repeat(120) + '.in').ok).toBe(false);
  });
});
