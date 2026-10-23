import { ApprovalMode } from 'src/core/approval-mode';

/**
 * Staffing presets (OPERATING_MODES section 6): a starting configuration for how a shop runs. A preset only sets defaults.
 * It never deletes a user, a shift or any history, and everything it sets can be changed afterwards one setting at a time.
 */
export type Preset = 'solo' | 'owner_and_staff' | 'manager_and_staff' | 'multi_store';
export const PRESETS: Preset[] = ['solo', 'owner_and_staff', 'manager_and_staff', 'multi_store'];

export interface PresetInfo {
  key: Preset;
  label: string;
  summary: string;
  approvalmode: ApprovalMode;
  /** the logins the shop will want (the owner creates them under Settings > Users, or in the setup wizard) */
  accounts: string[];
  /** what this preset keeps out of sight */
  hidden: string[];
}

export const PRESET_INFO: Record<Preset, PresetInfo> = {
  solo: {
    key: 'solo', label: 'Just me', approvalmode: 'self',
    summary: 'One person runs the shop: sells, buys, counts the till. One login, no approvals to wait for.',
    accounts: ['Owner-operator (the only login)'],
    hidden: ['HR and attendance', 'Stock transfers', 'Stock audits'],
  },
  owner_and_staff: {
    key: 'owner_and_staff', label: 'Owner and staff', approvalmode: 'self',
    summary: 'The owner and a few sales staff. The owner approves their own work; staff sell.',
    accounts: ['Business Head (the owner)', 'Sales Staff, one each, or one shared Counter login'],
    hidden: ['Stock transfers'],
  },
  manager_and_staff: {
    key: 'manager_and_staff', label: 'Manager and staff', approvalmode: 'separate',
    summary: 'A store manager and several sales staff, the owner above. A different person approves adjustments, orders and expenses.',
    accounts: ['Business Head', 'Store Head (the manager)', 'Sales Staff or a shared Counter login'],
    hidden: ['Stock transfers (when there is one store)'],
  },
  multi_store: {
    key: 'multi_store', label: 'Several stores', approvalmode: 'separate',
    summary: 'The owner with several stores, each with sales staff only or a store head and sales staff.',
    accounts: ['Business Head', 'Per store: a Store Head and/or Sales Staff, or a shared Counter login'],
    hidden: [],
  },
};

export interface StoreNow { id: number; location: string; shiftmode: 'time' | 'staff'; operatorrequired: boolean; openshifts: number }
export interface PresetInput { preset: Preset; shiftmode?: 'time' | 'staff'; stores?: Record<string, { shiftmode?: 'time' | 'staff' }>; hr?: boolean }

export interface StorePlan {
  id: number; location: string; shiftmode: 'time' | 'staff'; operatorrequired: boolean;
  /** what changes for this store, in words */
  changes: string[];
  /** set when the store has a shift open and its mode would change */
  blocked?: string;
}

export interface PresetPlan {
  preset: Preset;
  approvalmode: ApprovalMode;
  /** only the modules a preset decides; the others are left alone */
  modules: { hr?: boolean; transfers?: boolean; stock_audits?: boolean };
  stores: StorePlan[];
  changes: string[];
  blockers: string[];
}

const MODE_LABEL = { time: 'one shared till, closed at handover', staff: 'each person closes their own drawer' } as const;

/** What applying a preset would do, given how the business is set up now. Pure: nothing is written. */
export function planPreset(input: PresetInput, now: { approvalmode: ApprovalMode; modules: { hr: boolean; transfers: boolean; stock_audits: boolean }; stores: StoreNow[] }): PresetPlan {
  const info = PRESET_INFO[input.preset];
  const changes: string[] = [];

  // modules the preset decides
  const modules: PresetPlan['modules'] = {};
  const decide = (key: 'hr' | 'transfers' | 'stock_audits', on: boolean | undefined) => {
    if (on === undefined || on === now.modules[key]) return;
    modules[key] = on;
    const label = key === 'hr' ? 'HR and attendance' : key === 'transfers' ? 'Stock transfers' : 'Stock audits';
    changes.push(`${label} ${on ? 'switched on' : 'switched off'}`);
  };
  switch (input.preset) {
    case 'solo': decide('hr', false); decide('transfers', false); decide('stock_audits', false); break;
    case 'owner_and_staff': decide('hr', input.hr); decide('transfers', false); decide('stock_audits', true); break;
    case 'manager_and_staff': decide('hr', true); decide('transfers', now.stores.length > 1); decide('stock_audits', true); break;
    case 'multi_store': decide('hr', true); decide('transfers', true); decide('stock_audits', true); break;
  }

  // approvals
  if (info.approvalmode !== now.approvalmode) {
    changes.push(info.approvalmode === 'self' ? 'You may approve your own work (no second person needed)' : 'Another person approves adjustments, orders and expenses');
  }

  // each store's till
  const stores: StorePlan[] = now.stores.map((s) => {
    const wanted: 'time' | 'staff' = input.preset === 'solo' ? 'staff' : (input.stores?.[String(s.id)]?.shiftmode ?? input.shiftmode ?? s.shiftmode);
    const operatorrequired = wanted === 'time';
    const sc: string[] = [];
    if (wanted !== s.shiftmode) sc.push(`shifts: ${MODE_LABEL[wanted]}`);
    if (operatorrequired !== s.operatorrequired) sc.push(operatorrequired ? 'asks who is serving on each bill' : 'bills carry the signed-in person');
    const plan: StorePlan = { id: s.id, location: s.location, shiftmode: wanted, operatorrequired, changes: sc };
    if (wanted !== s.shiftmode && s.openshifts > 0) plan.blocked = `${s.location} has ${s.openshifts} open shift${s.openshifts === 1 ? '' : 's'}: close ${s.openshifts === 1 ? 'it' : 'them'} before changing how shifts are closed.`;
    return plan;
  });
  return { preset: input.preset, approvalmode: info.approvalmode, modules, stores, changes, blockers: stores.filter((s) => s.blocked).map((s) => s.blocked as string) };
}
