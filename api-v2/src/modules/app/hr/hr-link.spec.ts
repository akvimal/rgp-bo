import { appliesToPosition, bandFor, groupDesignations, pickBands } from './hr-link';

const def = [{ role_name: null, position_id: null, min: 0, pct: 0, label: 'Low' }, { role_name: null, position_id: null, min: 80, pct: 5, label: 'Good' }];
const role = [{ role_name: 'Sales Staff', position_id: null, min: 0, pct: 1, label: 'R-low' }];
const job = [{ role_name: null, position_id: 7, min: 0, pct: 2, label: 'J-low' }, { role_name: null, position_id: 7, min: 70, pct: 8, label: 'J-high' }];
const all = [...def, ...role, ...job];

describe('which band set applies', () => {
  it('a job role with its own set uses it, whatever the login role', () => {
    expect(pickBands(all, 7, 'Sales Staff').map((b) => b.label)).toEqual(['J-low', 'J-high']);
  });
  it('without a set of its own the login role set applies, then the default', () => {
    expect(pickBands(all, 8, 'Sales Staff').map((b) => b.label)).toEqual(['R-low']);
    expect(pickBands(all, 8, 'Store Head').map((b) => b.label)).toEqual(['Low', 'Good']);
  });
  it('a person with no job role and no login (staff without a login) gets the default', () => {
    expect(pickBands(all, null, null).map((b) => b.label)).toEqual(['Low', 'Good']);
    expect(pickBands(all, undefined, undefined)).toHaveLength(2);
  });
  it('a person with a job role but no login still gets the job role set', () => {
    expect(pickBands(all, 7, null)).toHaveLength(2);
  });
  it('a job role set is never mistaken for a default or a login role set', () => {
    expect(pickBands(job, 8, 'Sales Staff')).toEqual([]);
  });
});

describe('measures by job role', () => {
  it('no limit applies to everyone, including people with no job role', () => {
    expect(appliesToPosition(null, null)).toBe(true);
    expect(appliesToPosition([], 3)).toBe(true);
  });
  it('a limit applies only to those holding one of the roles', () => {
    expect(appliesToPosition([3, 4], 4)).toBe(true);
    expect(appliesToPosition([3, 4], 5)).toBe(false);
    expect(appliesToPosition([3], null)).toBe(false);
  });
});

describe('band for a score', () => {
  it('is the highest band the score reaches, in any order', () => {
    expect(bandFor(job, 75)!.label).toBe('J-high');
    expect(bandFor(job, 40)!.label).toBe('J-low');
    expect(bandFor([...job].reverse(), 90)!.label).toBe('J-high');
  });
  it('is nothing when no band is reached', () => {
    expect(bandFor([{ min: 50 }], 10)).toBeUndefined();
  });
});

describe('designations to job roles', () => {
  const people = [
    { designation: 'Pharmacist', position_id: null }, { designation: ' pharmacist ', position_id: null }, { designation: 'Cashier', position_id: null },
    { designation: 'Pharmacist', position_id: null }, { designation: '', position_id: null }, { designation: null, position_id: null },
    { designation: 'Driver', position_id: 9 },
  ];
  it('groups what was typed, ignoring case and spaces, most used first, and skips blanks and people who already have a job role', () => {
    const g = groupDesignations(people, []);
    expect(g.map((x) => [x.designation, x.staff])).toEqual([['Pharmacist', 3], ['Cashier', 1]]);
  });
  it('names the group after its most common spelling and marks a job role of the same name', () => {
    const g = groupDesignations(people, [{ id: 4, name: 'pharmacist' }]);
    expect(g[0]).toMatchObject({ designation: 'Pharmacist', position_id: 4 });
    expect(g[1].position_id).toBeNull();
  });
});
