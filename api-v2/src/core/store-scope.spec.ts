import { pickStores } from './store-scope';

describe('which stores a person may read', () => {
  it('is every store of the business for an owner, whatever stores are assigned', () => {
    expect(pickStores({ owner: true, inBusiness: [1, 2, 3], assigned: [2] })).toEqual([1, 2, 3]);
  });

  it('is the assigned stores for anyone else', () => {
    expect(pickStores({ owner: false, inBusiness: [1, 2, 3], assigned: [2, 3] })).toEqual([2, 3]);
  });

  it('is the business\'s stores when none are assigned', () => {
    expect(pickStores({ owner: false, inBusiness: [1, 2], assigned: [] })).toEqual([1, 2]);
  });

  it('never includes a store of another business, even if one is assigned', () => {
    expect(pickStores({ owner: false, inBusiness: [1, 2], assigned: [2, 9] })).toEqual([2]);
    expect(pickStores({ owner: false, inBusiness: [1, 2], assigned: [9] })).toEqual([1, 2]);
  });

  it('is no limit only for a login with no business at all', () => {
    expect(pickStores({ owner: false, inBusiness: null, assigned: [1] })).toBeNull();
    expect(pickStores({ owner: true, inBusiness: [], assigned: [] })).toEqual([]);
  });
});
