import { BusinessService } from './business.service';

/** the sign-in page's name and logo: given only when the install belongs to exactly one business */
function serviceWith(rows: any[]): BusinessService {
  const s = Object.create(BusinessService.prototype) as any;
  s.manager = { query: jest.fn().mockResolvedValue(rows) };
  return s;
}

describe('sign-in brand', () => {
  it('one business: its name and logo', async () => {
    expect(await serviceWith([{ name: 'Ramesh Generic Pharmacy', logo: 'data:image/png;base64,AAAA' }]).publicBrand()).toEqual({ name: 'Ramesh Generic Pharmacy', logo: 'data:image/png;base64,AAAA' });
  });
  it('one business without a logo: the name and no logo', async () => {
    expect(await serviceWith([{ name: 'Sri Medicals', logo: null }]).publicBrand()).toEqual({ name: 'Sri Medicals', logo: null });
  });
  it('several businesses: nothing, so the page keeps its default', async () => {
    expect(await serviceWith([{ name: 'A', logo: null }, { name: 'B', logo: null }]).publicBrand()).toEqual({});
  });
  it('no business: nothing', async () => {
    expect(await serviceWith([]).publicBrand()).toEqual({});
  });
});
