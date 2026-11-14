import { peekFrom } from './peek-address.service';

describe('peek address', () => {
  it('reads the peek id from the address', () => {
    expect(peekFrom('/secure/customers/cust/list?peek=12')).toBe('12');
    expect(peekFrom('/secure/customers/cust/list?status=active&peek=ab-3#top')).toBe('ab-3');
  });
  it('gives null when there is none, or it is not a plain id', () => {
    expect(peekFrom('/secure/customers/cust/list')).toBeNull();
    expect(peekFrom('/x?peek=')).toBeNull();
    expect(peekFrom('/x?peek=<script>')).toBeNull();
    expect(peekFrom('/x?peek=' + 'a'.repeat(41))).toBeNull();
  });
});
