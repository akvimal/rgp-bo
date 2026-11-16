import { isOwnerRole } from './roles';

/**
 * What an owner role always holds, whatever its stored permissions say. The API lets the owner roles through these checks by name (a role made
 * later by provisioning, a seed or a config import may not carry the block), so the app is told the same: without this the menu and the page
 * would be closed to an owner the API would let in. Pure; appended after the module narrowing.
 */
const OWNER_FLOOR: Array<{ resource: string; path: string; actions: string[] }> = [
  { resource: 'customerorders', path: '/secure/commitments', actions: ['view', 'manage'] },
  { resource: 'deliverypartners', path: '/secure/settings/delivery-partners', actions: ['manage'] },
  { resource: 'reports', path: '/secure/reports', actions: ['sales', 'purchases', 'stock', 'margin', 'ask', 'export'] },
];

export function withOwnerFloor(permissions: any[], roleName: string | null | undefined): any[] {
  if (!isOwnerRole(roleName) || !Array.isArray(permissions)) return permissions;
  const out = [...permissions];
  for (const f of OWNER_FLOOR) {
    const have = out.find((p) => p?.resource === f.resource);
    if (!have) {
      out.push({ resource: f.resource, path: f.path, policies: f.actions.map((action) => ({ action })) });
    } else {
      const missing = f.actions.filter((a) => !(have.policies || []).some((p: any) => p?.action === a));
      if (missing.length) out[out.indexOf(have)] = { ...have, policies: [...(have.policies || []), ...missing.map((action) => ({ action }))] };
    }
  }
  return out;
}
