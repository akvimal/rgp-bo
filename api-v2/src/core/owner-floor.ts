import { isOwnerRole } from './roles';

/**
 * What an owner role always holds, whatever its stored permissions say. The API lets the owner roles through these checks by name (a role made
 * later by provisioning, a seed or a config import may not carry the block), so the app is told the same: without this the menu and the page
 * would be closed to an owner the API would let in. Pure; appended after the module narrowing.
 */
/** `onlyIfPresent`: fill in the missing actions of a resource the role already holds, but never add the resource (HR is offered only where the module is on) */
const OWNER_FLOOR: Array<{ resource: string; path: string; actions: string[]; onlyIfPresent?: boolean }> = [
  { resource: 'customerorders', path: '/secure/commitments', actions: ['view', 'manage'] },
  { resource: 'deliverypartners', path: '/secure/settings/delivery-partners', actions: ['manage'] },
  { resource: 'reports', path: '/secure/reports', actions: ['sales', 'purchases', 'stock', 'margin', 'ask', 'export'] },
  { resource: 'customers', path: '/secure/customers', onlyIfPresent: true, actions: ['delete', 'merge', 'creditlimit.set', 'credit.correct', 'households.manage', 'followup.wording', 'relationships.setup'] },
  { resource: 'businessprofile', path: '/secure/settings/business-profile', onlyIfPresent: true, actions: ['modules.manage', 'transfer.export', 'transfer.import'] },
  { resource: 'users', path: '/secure/settings/users', onlyIfPresent: true, actions: ['mfareset'] },
  { resource: 'finance', path: '/secure/finance', onlyIfPresent: true, actions: ['bank.import', 'reconcile', 'records'] },
  { resource: 'gstfiling', path: '/secure/gst-filing', onlyIfPresent: true, actions: ['prepare', 'export', 'lock', 'unlock'] },
  { resource: 'store', path: '/secure/store/stock', onlyIfPresent: true, actions: ['qty.adjust', 'audit.approve', 'count.perform', 'transfer.request', 'transfer.receive'] },
  { resource: 'purchases', path: '/secure/purchases', onlyIfPresent: true, actions: ['payments.view', 'payments.record', 'payments.reverse', 'returns.manage', 'invoices.editcompleted', 'invoices.approvepay', 'invoices.recalculate'] },
  { resource: 'hr', path: '/secure/hr', onlyIfPresent: true, actions: ['staff.view', 'staff.manage', 'pay.view', 'pay.manage', 'payroll.view', 'payroll.run', 'payroll.approve', 'attendance.manage', 'leave.manage', 'kpi.setup', 'bonus.manage'] },
];

export function withOwnerFloor(permissions: any[], roleName: string | null | undefined): any[] {
  if (!isOwnerRole(roleName) || !Array.isArray(permissions)) return permissions;
  const out = [...permissions];
  for (const f of OWNER_FLOOR) {
    const have = out.find((p) => p?.resource === f.resource);
    if (!have) {
      if (f.onlyIfPresent) continue;
      out.push({ resource: f.resource, path: f.path, policies: f.actions.map((action) => ({ action })) });
    } else {
      const missing = f.actions.filter((a) => !(have.policies || []).some((p: any) => p?.action === a));
      if (missing.length) out[out.indexOf(have)] = { ...have, policies: [...(have.policies || []), ...missing.map((action) => ({ action }))] };
    }
  }
  return out;
}
