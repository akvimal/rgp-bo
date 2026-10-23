import { EntityManager } from 'typeorm';
import { BUSINESS_OF_USER_SQL } from './business-of-user';

export type ApprovalMode = 'self' | 'separate';

/**
 * Whether a maker-checker rule applies here (OPERATING_MODES section 7). 'separate' keeps the rule as it is;
 * 'self' lets the maker approve their own adjustment, purchase order or expense. A store may override the business.
 */
export async function approvalModeFor(manager: EntityManager, scope: { storeId?: number | string | null; userId?: number | null }): Promise<ApprovalMode> {
  if (scope.storeId) {
    const [r] = await manager.query(
      `select coalesce(s.approval_mode, b.approval_mode) as mode from stores s left join business b on b.id = s.business_id where s.id = $1`, [+scope.storeId]);
    if (r?.mode) return r.mode === 'self' ? 'self' : 'separate';
  }
  if (scope.userId) {
    const [r] = await manager.query(`select b.approval_mode as mode from app_user u join business b on b.id = ${BUSINESS_OF_USER_SQL} where u.id = $1`, [scope.userId]);
    if (r?.mode) return r.mode === 'self' ? 'self' : 'separate';
  }
  return 'separate';
}

export const isValidApprovalMode = (v: any): v is ApprovalMode => v === 'self' || v === 'separate';
