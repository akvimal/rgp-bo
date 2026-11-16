import { PermissionService } from './permission.service';

const serviceWith = (role: any) => new PermissionService({ findById: async () => role } as any);

describe('who may use the reports', () => {
  it('lets the owner roles in', async () => {
    expect(await serviceWith({ name: 'Business Head', permissions: [] }).canUseReports(1)).toBe(true);
    expect(await serviceWith({ name: 'Owner-operator', permissions: [] }).canUseReports(1)).toBe(true);
  });

  it('lets in a role the Reports page was given to, as the role editor saves it (no actions, only its presence)', async () => {
    const role = { name: 'Accountant', permissions: [{ resource: 'reports', path: ['/secure/reports'] }] };
    expect(await serviceWith(role).canUseReports(5)).toBe(true);
  });

  it('keeps everyone else out: no Reports page, no reports', async () => {
    expect(await serviceWith({ name: 'Sales Staff', permissions: [{ resource: 'sales', policies: [{ action: 'add' }] }] }).canUseReports(2)).toBe(false);
    expect(await serviceWith({ name: 'Store Head', permissions: [] }).canUseReports(3)).toBe(false);
    expect(await serviceWith({ name: 'Personal', permissions: [{ resource: 'myhr', policies: [{ action: 'view' }] }] }).canUseReports(4)).toBe(false);
  });

  it('keeps out a login whose role cannot be found', async () => {
    expect(await serviceWith(null).canUseReports(99)).toBe(false);
  });
});
