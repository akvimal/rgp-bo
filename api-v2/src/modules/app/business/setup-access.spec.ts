import { SETUP_ACTIONS, SETUP_RESOURCE, canDoSetup } from './setup-access';

const perms = (resource: string, ...actions: string[]) => [{ resource, policies: actions.map((action) => ({ action })) }];

describe('who may do the Setup actions', () => {
  it('gives the owner roles every action by name, whatever their saved permissions say', () => {
    ['Business Head', 'Owner-operator'].forEach((role) => SETUP_ACTIONS.forEach((a) => expect(canDoSetup(role, [], a)).toBe(true)));
  });

  it('gives everyone else only what is granted, on the permission the action lives on', () => {
    expect(canDoSetup('Store Head', perms('businessprofile', 'transfer.export'), 'transfer.export')).toBe(true);
    expect(canDoSetup('Store Head', perms('businessprofile', 'transfer.export'), 'transfer.import')).toBe(false);
    expect(canDoSetup('Store Head', perms('businessprofile', 'transfer.export'), 'modules.manage')).toBe(false);
    expect(canDoSetup('Store Head', perms('users', 'mfareset'), 'mfareset')).toBe(true);
    expect(canDoSetup('Store Head', perms('businessprofile', 'mfareset'), 'mfareset')).toBe(false);       // the wrong permission
  });

  it('does not let the old manage box stand in for the new actions', () => {
    SETUP_ACTIONS.forEach((a) => expect(canDoSetup('Store Head', perms(SETUP_RESOURCE[a], 'manage', 'edit'), a)).toBe(false));
  });

  it('lets the platform admin reset an authenticator (as before) but not run a business setup', () => {
    expect(canDoSetup('Site Admin', [], 'mfareset')).toBe(true);
    expect(canDoSetup('Site Admin', [], 'transfer.import')).toBe(false);
    expect(canDoSetup('Site Admin', [], 'modules.manage')).toBe(false);
  });
});
