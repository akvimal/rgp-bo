import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ApprovalMode, isValidApprovalMode } from 'src/core/approval-mode';

export type ShiftMode = 'time' | 'staff';

export interface StoreProfile {
  storeid: number;
  location: string;
  shiftmode: ShiftMode;
  /** the stored value; null follows the shift mode */
  tillsetting: 'shared' | 'per_person' | null;
  till: 'shared' | 'per_person';
  accountablerole: 'auto' | 'store_head' | 'business_head';
  operatorrequired: boolean;
  operatorholdminutes: number;
  /** the store's own override; null follows the business */
  approvalmodesetting: ApprovalMode | null;
  /** what applies: the override, else the business value */
  approvalmode: ApprovalMode;
  /** the most refunded in cash on one return; null: no limit, 0: never cash */
  cashrefundlimit: number | null;
}

/** a store is a pharmacy or something else; anything else sent is refused, nothing sent means no change */
export function parseStoreType(v: any): 'pharmacy' | 'other' | null {
  if (v === undefined || v === null || v === '') return null;
  if (v !== 'pharmacy' && v !== 'other') throw new BadRequestException('Store type must be pharmacy or other.');
  return v;
}

const SHIFT_MODES = ['time', 'staff'];
const TILLS = ['shared', 'per_person'];
const ACCOUNTABLE = ['auto', 'store_head', 'business_head'];

/** What a store's till rules are (OPERATING_MODES section 4). A store that does not exist reads as the time-based default. */
export async function loadStoreProfile(manager: EntityManager, storeId: number | string): Promise<StoreProfile | null> {
  const [r] = await manager.query(
    `select s.id, s.location, s.shift_mode, s.till, s.accountable_role, s.operator_required, s.operator_hold_minutes, s.approval_mode as store_mode, b.approval_mode as business_mode, s.cash_refund_limit::float as cash_limit
       from stores s left join business b on b.id = s.business_id where s.id = $1`, [+storeId]);
  if (!r) return null;
  const mode: ShiftMode = r.shift_mode === 'staff' ? 'staff' : 'time';
  return {
    storeid: r.id, location: String(r.location).trim(), shiftmode: mode,
    tillsetting: r.till, till: r.till || (mode === 'staff' ? 'per_person' : 'shared'),
    accountablerole: r.accountable_role, operatorrequired: !!r.operator_required, operatorholdminutes: Number(r.operator_hold_minutes),
    approvalmodesetting: r.store_mode || null, approvalmode: (r.store_mode || r.business_mode) === 'self' ? 'self' : 'separate',
    cashrefundlimit: r.cash_limit === null || r.cash_limit === undefined ? null : Number(r.cash_limit),
  };
}

/** Checked values for a profile update; only the fields sent are returned. */
export function parseProfileInput(body: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (body.shiftmode !== undefined) {
    if (!SHIFT_MODES.includes(body.shiftmode)) throw new BadRequestException('Shift mode must be time or staff.');
    out.shift_mode = body.shiftmode;
  }
  if (body.till !== undefined) {
    if (body.till !== null && body.till !== '' && !TILLS.includes(body.till)) throw new BadRequestException('Till must be shared or per_person.');
    out.till = body.till || null;
  }
  if (body.accountablerole !== undefined) {
    if (!ACCOUNTABLE.includes(body.accountablerole)) throw new BadRequestException('Accountable role must be auto, store_head or business_head.');
    out.accountable_role = body.accountablerole;
  }
  if (body.approvalmode !== undefined) {
    if (body.approvalmode !== null && body.approvalmode !== '' && !isValidApprovalMode(body.approvalmode)) throw new BadRequestException('Approval mode must be self or separate.');
    out.approval_mode = body.approvalmode || null;
  }
  if (body.cashrefundlimit !== undefined) {
    if (body.cashrefundlimit === null || body.cashrefundlimit === '') out.cash_refund_limit = null;
    else {
      const n = Number(body.cashrefundlimit);
      if (!Number.isFinite(n) || n < 0 || n > 10000000) throw new BadRequestException('The cash refund limit must be zero or more, or blank for no limit.');
      out.cash_refund_limit = Math.round(n * 100) / 100;
    }
  }
  if (body.operatorrequired !== undefined) out.operator_required = !!body.operatorrequired;
  if (body.operatorholdminutes !== undefined) {
    const n = Number(body.operatorholdminutes);
    if (!Number.isInteger(n) || n < 0 || n > 1440) throw new BadRequestException('Keep the operator for a whole number of minutes between 0 and 1440.');
    out.operator_hold_minutes = n;
  }
  return out;
}

/**
 * Who answers for a cash difference in this store: the store head when it has one, else the business head
 * (or whichever the profile insists on, falling back to the other when that role is empty).
 */
export async function findAccountableUser(manager: EntityManager, storeId: number, rule: StoreProfile['accountablerole']): Promise<number | null> {
  const head = async () => (await manager.query(
    `select u.id from app_user u join app_role r on r.id = u.role_id join user_stores us on us.user_id = u.id
      where us.store_id = $1 and us.active and not us.archive and u.active and not u.archive and r.name = 'Store Head'
      order by us.is_primary desc, u.id limit 1`, [storeId]))[0]?.id ?? null;
  const owner = async () => (await manager.query(
    `select u.id from app_user u join app_role r on r.id = u.role_id join stores s on s.business_id = u.business_id
      where s.id = $1 and u.active and not u.archive and r.name in ('Business Head', 'Owner-operator') order by u.id limit 1`, [storeId]))[0]?.id ?? null;
  if (rule === 'business_head') return (await owner()) ?? (await head());
  return (await head()) ?? (await owner());
}
