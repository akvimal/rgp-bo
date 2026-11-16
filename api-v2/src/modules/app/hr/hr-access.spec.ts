import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { HR_ACTIONS, canDoHr, canUseHrRoute, hrActionFor } from './hr-access';
import { HrController } from './hr.controller';

const perms = (...actions: string[]) => [{ resource: 'hr', policies: actions.map((action) => ({ action })) }];

/** every route of HrController as the guard sees it: method and '/hr/<path>' */
function controllerRoutes(): Array<{ method: string; path: string }> {
  const out: Array<{ method: string; path: string }> = [];
  const proto = HrController.prototype as any;
  Object.getOwnPropertyNames(proto).forEach((name) => {
    if (name === 'constructor') return;
    const fn = proto[name];
    const path = Reflect.getMetadata(PATH_METADATA, fn);
    const method = Reflect.getMetadata(METHOD_METADATA, fn);
    if (path === undefined || method === undefined) return;
    out.push({ method: RequestMethod[method], path: `/hr/${path}` });
  });
  return out;
}

describe('who may do what in HR', () => {
  it('names an action for every route of the HR controller, so none is left to the owner by accident', () => {
    const routes = controllerRoutes();
    expect(routes.length).toBeGreaterThan(70);                 // the scan found the controller's routes, not nothing
    const unnamed = routes.filter((r) => hrActionFor(r.method, r.path) === null).map((r) => `${r.method} ${r.path}`);
    expect(unnamed).toEqual([]);
  });

  it('uses every HR action in some route', () => {
    const used = new Set(controllerRoutes().map((r) => hrActionFor(r.method, r.path)));
    HR_ACTIONS.forEach((a) => expect(used.has(a)).toBe(true));
  });

  it('gives the owner roles every route, whatever their saved permissions say', () => {
    controllerRoutes().forEach((r) => {
      expect(canUseHrRoute('Business Head', [], r.method, r.path)).toBe(true);
      expect(canUseHrRoute('Owner-operator', [], r.method, r.path)).toBe(true);
    });
  });

  it('gives everyone else only the routes of the actions granted', () => {
    const p = perms('staff.view', 'attendance.manage');
    expect(canUseHrRoute('Accountant', p, 'GET', '/hr/staff')).toBe(true);
    expect(canUseHrRoute('Accountant', p, 'GET', '/hr/attendance')).toBe(true);
    expect(canUseHrRoute('Accountant', p, 'POST', '/hr/staff')).toBe(false);                 // view is not manage
    expect(canUseHrRoute('Accountant', p, 'GET', '/hr/payroll')).toBe(false);
    expect(canUseHrRoute('Accountant', p, 'GET', '/hr/staff/:id/accounts')).toBe(false);     // bank details are pay, not staff
  });

  it('keeps pay, payroll running and payroll approval apart', () => {
    expect(hrActionFor('POST', '/hr/staff/:id/revisions')).toBe('pay.manage');
    expect(hrActionFor('GET', '/hr/staff/:id/accounts')).toBe('pay.view');
    expect(hrActionFor('POST', '/hr/payroll/:period/generate')).toBe('payroll.run');
    expect(hrActionFor('POST', '/hr/payroll/:period/approve')).toBe('payroll.approve');
    expect(hrActionFor('POST', '/hr/payroll/:period/reopen')).toBe('payroll.approve');
    expect(canUseHrRoute('Payroll clerk', perms('payroll.view', 'payroll.run'), 'POST', '/hr/payroll/:period/approve')).toBe(false);
  });

  it('does not let the old hr view or manage boxes open anything by themselves', () => {
    const old = perms('view', 'manage');
    controllerRoutes().forEach((r) => expect(canUseHrRoute('Accountant', old, r.method, r.path)).toBe(false));
  });

  it('closes a route no rule names to everyone but the owner roles', () => {
    expect(hrActionFor('GET', '/hr/brand-new')).toBeNull();
    expect(canUseHrRoute('Accountant', perms(...HR_ACTIONS), 'GET', '/hr/brand-new')).toBe(false);
    expect(canUseHrRoute('Business Head', [], 'GET', '/hr/brand-new')).toBe(true);
    expect(canDoHr('Accountant', [{ resource: 'hr' }], 'staff.view')).toBe(false);
  });
});
