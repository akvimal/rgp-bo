import { mayRate } from './hr-kpi-raters';

const owner = { owner: true, roleCan: true, positionId: null };
const storeHead = { owner: false, roleCan: true, positionId: 7 };
const pharmacist = { owner: false, roleCan: false, positionId: 3 };
const salesStaff = { owner: false, roleCan: false, positionId: 1 };

describe('mayRate', () => {
  it('the owner may rate any measure, listed or not', () => {
    expect(mayRate(owner, null)).toBe(true);
    expect(mayRate(owner, [3])).toBe(true);
  });

  it('a measure with no list is rated, as before, by whoever holds the KPI rating permission', () => {
    expect(mayRate(storeHead, null)).toBe(true);
    expect(mayRate(storeHead, [])).toBe(true);
    expect(mayRate(pharmacist, null)).toBe(false);
    expect(mayRate(salesStaff, undefined)).toBe(false);
  });

  it('a measure with a list is rated only by the listed job roles', () => {
    expect(mayRate(pharmacist, [3])).toBe(true);
    expect(mayRate(pharmacist, [3, 7])).toBe(true);
    expect(mayRate(salesStaff, [3])).toBe(false);
  });

  it('a Store Head not named in the list may not rate that measure, even with the permission', () => {
    expect(mayRate(storeHead, [3])).toBe(false);
    expect(mayRate(storeHead, [3, 7])).toBe(true);
  });

  it('a person with no job role on their staff record is not a listed rater', () => {
    expect(mayRate({ owner: false, roleCan: true, positionId: null }, [3])).toBe(false);
  });
});
