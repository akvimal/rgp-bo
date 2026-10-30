import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserService } from './user.service';

/** the service over stubbed repositories: the callers, the target, and how many other heads the business has */
function setup(opts: { caller: any; target: any; targetRole: string; otherHeads?: number; emailHolder?: any }) {
  const users: any = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where.email !== undefined) return opts.emailHolder ?? null;
      return where.id === opts.caller.id ? opts.caller : where.id === opts.target.id ? opts.target : null;
    }),
    count: jest.fn(async () => opts.otherHeads ?? 0),
    update: jest.fn(async () => ({})),
  };
  const roles: any = {
    findOne: jest.fn(async () => ({ id: opts.target.roleid, name: opts.targetRole })),
    find: jest.fn(async () => [{ id: 1, name: 'Business Head' }, { id: 2, name: 'Owner-operator' }]),
  };
  const service = new UserService(users, roles, {} as any, {} as any, {} as any, {} as any, {} as any);
  const del = jest.spyOn(service, 'delete').mockResolvedValue({} as any);
  return { service, users, del };
}

const head = { id: 10, businessid: 7, roleid: 1, role: { name: 'Business Head' }, email: 'head@x.test' };

describe('UserService.deleteScoped guards', () => {
  it('refuses a Business Head removing their own account', async () => {
    const { service, del } = setup({ caller: head, target: head, targetRole: 'Business Head', otherHeads: 5 });
    await expect(service.deleteScoped(10, 10)).rejects.toThrow('your own account');
    expect(del).not.toHaveBeenCalled();
  });
  it('refuses it when the id arrives as text, as it does from the URL', async () => {
    const { service, del } = setup({ caller: head, target: head, targetRole: 'Business Head', otherHeads: 5 });
    await expect(service.deleteScoped('10' as any, 10)).rejects.toThrow('your own account');
    expect(del).not.toHaveBeenCalled();
  });
  it('refuses removing the last active Business Head of the business', async () => {
    const other = { id: 11, businessid: 7, roleid: 1, email: 'b@x.test' };
    const { service, del } = setup({ caller: head, target: other, targetRole: 'Business Head', otherHeads: 0 });
    await expect(service.deleteScoped(11, 10)).rejects.toBeInstanceOf(BadRequestException);
    expect(del).not.toHaveBeenCalled();
  });
  it('removes a Business Head when another is active, and any other role regardless', async () => {
    const other = { id: 11, businessid: 7, roleid: 1, email: 'b@x.test' };
    const a = setup({ caller: head, target: other, targetRole: 'Business Head', otherHeads: 1 });
    await a.service.deleteScoped(11, 10);
    expect(a.del).toHaveBeenCalledWith(11, { id: 10 });
    const staff = { id: 12, businessid: 7, roleid: 4, email: 's@x.test' };
    const b = setup({ caller: head, target: staff, targetRole: 'Sales Staff', otherHeads: 0 });
    await b.service.deleteScoped(12, 10);
    expect(b.del).toHaveBeenCalledWith(12, { id: 10 });
  });
});

describe('UserService.updateScoped email', () => {
  const staff = { id: 12, businessid: 7, roleid: 4, email: 's@x.test' };
  it('refuses an email another login holds, saying whether that login was removed', async () => {
    const live = setup({ caller: head, target: staff, targetRole: 'Sales Staff', emailHolder: { id: 99, isActive: true, isArchived: false } });
    await expect(live.service.updateScoped(12, { email: 'taken@x.test' }, 10)).rejects.toBeInstanceOf(ConflictException);
    await expect(live.service.updateScoped(12, { email: 'taken@x.test' }, 10)).rejects.toThrow('already used');
    const gone = setup({ caller: head, target: staff, targetRole: 'Sales Staff', emailHolder: { id: 99, isActive: false, isArchived: false } });
    await expect(gone.service.updateScoped(12, { email: 'taken@x.test' }, 10)).rejects.toThrow('removed');
    expect(live.users.update).not.toHaveBeenCalled();
  });
  it('refuses an email that is too long or malformed, before touching the database', async () => {
    const { service, users } = setup({ caller: head, target: staff, targetRole: 'Sales Staff' });
    await expect(service.updateScoped(12, { email: 'nope' }, 10)).rejects.toBeInstanceOf(BadRequestException);
    expect(users.update).not.toHaveBeenCalled();
  });
  it('saves a free email trimmed, and leaves an unchanged email alone even if it is odd', async () => {
    const free = setup({ caller: head, target: staff, targetRole: 'Sales Staff' });
    await free.service.updateScoped(12, { email: '  new@x.test ' }, 10);
    expect(free.users.update).toHaveBeenCalledWith(12, expect.objectContaining({ email: 'new@x.test' }));
    const odd = { ...staff, email: 'admin' };
    const same = setup({ caller: head, target: odd, targetRole: 'Sales Staff' });
    await same.service.updateScoped(12, { email: 'admin', fullname: 'A' }, 10);
    expect(same.users.update).toHaveBeenCalled();
  });
});
