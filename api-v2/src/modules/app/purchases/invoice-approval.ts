import { EntityManager } from 'typeorm';

/**
 * Approval for payment of a purchase invoice. "Complete" means the goods and the bill agree; approval means finance may pay it.
 * Off by default. When on, an invoice above the limit (any invoice, if the limit is 0) cannot be paid until a Business Head approves it.
 */
export interface ApprovalPolicy { enabled: boolean; limit: number }

export const NO_APPROVAL: ApprovalPolicy = { enabled: false, limit: 0 };

/** true when this invoice still has to be approved before a payment can be recorded */
export function needsApproval(policy: ApprovalPolicy, total: number | string | null | undefined, approvedOn: unknown): boolean {
  if (!policy.enabled || approvedOn) return false;
  return policy.limit <= 0 || Number(total || 0) > policy.limit;
}

export async function loadApprovalPolicy(m: EntityManager): Promise<ApprovalPolicy> {
  const rows = await m.query(`select setting_key, setting_value from app_setting where setting_key in ('invoice_approval', 'invoice_approval_limit') and active and not archive`);
  const v = (k: string) => rows.find((r: any) => r.setting_key === k)?.setting_value;
  const limit = Number(v('invoice_approval_limit'));
  return { enabled: String(v('invoice_approval') || 'off').toLowerCase() === 'on', limit: Number.isFinite(limit) && limit > 0 ? limit : 0 };
}
