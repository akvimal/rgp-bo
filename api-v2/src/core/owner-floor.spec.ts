import { withOwnerFloor } from './owner-floor';

const resources = (p: any[]) => p.map((x) => x.resource);
const actions = (p: any[], r: string) => (p.find((x) => x.resource === r)?.policies || []).map((x: any) => x.action);

describe('what an owner role always holds', () => {
  it('adds Customer orders and Delivery partners to an owner role that was made without them', () => {
    const p = withOwnerFloor([{ resource: 'sales', policies: [{ action: 'add' }] }], 'Business Head');
    expect(resources(p)).toEqual(['sales', 'customerorders', 'deliverypartners', 'reports']);
    expect(actions(p, 'customerorders')).toEqual(['view', 'manage']);
    expect(p.find((x) => x.resource === 'deliverypartners').path).toBe('/secure/settings/delivery-partners');
    expect(p.find((x) => x.resource === 'customerorders').path).toBe('/secure/commitments');
  });

  it('does the same for the Owner-operator', () => {
    expect(resources(withOwnerFloor([], 'Owner-operator'))).toEqual(['customerorders', 'deliverypartners', 'reports']);
  });

  it('fills in an action an owner role is missing and leaves the rest as it was', () => {
    const stored = [{ resource: 'customerorders', path: '/secure/commitments', policies: [{ action: 'view' }] }];
    const p = withOwnerFloor(stored, 'Business Head');
    expect(actions(p, 'customerorders')).toEqual(['view', 'manage']);
    expect(stored[0].policies.length).toBe(1);                      // the stored role is not changed
  });

  it('adds nothing twice', () => {
    const once = withOwnerFloor([], 'Business Head');
    expect(withOwnerFloor(once, 'Business Head')).toEqual(once);
  });

  it('gives nothing to any other role, a Store Head included (they hold what the role editor gave them)', () => {
    ['Store Head', 'Sales Staff', 'Counter', 'Personal', 'Site Admin', 'Accountant', null, undefined].forEach((r) => expect(withOwnerFloor([], r as any)).toEqual([]));
  });
});
