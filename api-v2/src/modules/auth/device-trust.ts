import { isOwnerRole, ROLE } from 'src/core/roles';

/** who may skip the authenticator step on a registered store PC: nobody, Counter logins only, or everyone except owners */
export type DeviceTrustMode = 'off' | 'counter' | 'all';

export const parseTrustMode = (v: any): DeviceTrustMode => {
  const m = String(v ?? 'counter').toLowerCase();
  return m === 'off' || m === 'all' ? m : 'counter';
};

/** owners always keep the second step; Site Admin signs in on the platform page and is never trusted by a store PC */
export function maySkipMfa(mode: DeviceTrustMode, roleName: string | null | undefined): boolean {
  if (mode === 'off' || !roleName) return false;
  if (isOwnerRole(roleName) || roleName === ROLE.SITE_ADMIN) return false;
  return mode === 'all' || roleName === ROLE.COUNTER;
}

/** the setting a manager can choose between */
export const isTrustMode = (v: any): v is DeviceTrustMode => v === 'off' || v === 'counter' || v === 'all';
