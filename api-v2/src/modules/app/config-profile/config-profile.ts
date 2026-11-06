import { randomInt } from 'crypto';
import { checkPhones } from 'src/core/phones';
import { checkWebsite } from 'src/core/website';
import { emailProblem } from 'src/core/user-rules';
import { isValidApprovalMode } from 'src/core/approval-mode';
import { isBusinessType } from 'src/core/modules/modules';
import { OWNER_ROLES, ROLE } from 'src/core/roles';
import { RESERVED_ROLES } from 'src/core/role-rules';
import { isLegalForm } from '../hr/hr-starter';
import { PRESETS } from '../business/business-preset';
import { denominationTotal, normalizeDenominations } from '../store/denominations';

/**
 * The business profile: the configuration of a business, its stores (with their shifts) and its staff logins, as one file that can be
 * exported from one install and imported into another (or the same one after a refresh). Pure: no framework and no database.
 *
 *  - Things are matched by name, never by database id: a store by its name, a login by its email, a role by its name.
 *  - A key that is absent means "leave as it is" (on a new record, the default). `null` clears a value that may be empty.
 *  - Passwords, MFA, keys, history and quantities are never in a profile.
 */
export const PROFILE_FORMAT = 'rgp-business-profile';
export const SCHEMA_VERSION = 1;

export type Kind = 'text' | 'bool' | 'num' | 'int' | 'intlist' | 'denoms';
export interface FieldSpec { key: string; col: string; kind: Kind; label: string; hint?: string }

export const BUSINESS_FIELDS: FieldSpec[] = [
  { key: 'name', col: 'name', kind: 'text', label: 'Business name' },
  { key: 'legalName', col: 'legal_name', kind: 'text', label: 'Legal name' },
  { key: 'businessType', col: 'business_type', kind: 'text', label: 'Business type', hint: 'pharmacy or general' },
  { key: 'legalForm', col: 'legal_form', kind: 'text', label: 'Legal form', hint: 'for example PROPRIETORSHIP' },
  { key: 'gstin', col: 'gstin', kind: 'text', label: 'GSTIN' },
  { key: 'stateCode', col: 'state_code', kind: 'text', label: 'State code', hint: 'two digits' },
  { key: 'address', col: 'address', kind: 'text', label: 'Address' },
  { key: 'pincode', col: 'pincode', kind: 'text', label: 'Pincode' },
  { key: 'phone', col: 'phone', kind: 'text', label: 'Phone' },
  { key: 'website', col: 'website', kind: 'text', label: 'Website' },
  { key: 'grievancePhone', col: 'grievance_phone', kind: 'text', label: 'Grievance phone' },
  { key: 'approvalMode', col: 'approval_mode', kind: 'text', label: 'Approval mode', hint: 'self or separate' },
  { key: 'staffingPreset', col: 'staffing_preset', kind: 'text', label: 'Staffing preset', hint: PRESETS.join(', ') },
  { key: 'billShowMrp', col: 'bill_show_mrp', kind: 'bool', label: 'Bill shows MRP' },
  { key: 'billShowSaving', col: 'bill_show_saving', kind: 'bool', label: 'Bill shows "You saved"' },
  { key: 'billShowReturnNote', col: 'bill_show_return_note', kind: 'bool', label: 'Bill shows return note' },
  { key: 'billReturnNote', col: 'bill_return_note', kind: 'text', label: 'Return note wording' },
  { key: 'loginShowChangePassword', col: 'login_show_change_password', kind: 'bool', label: 'Sign-in page shows Change password' },
];

export const STORE_FIELDS: FieldSpec[] = [
  { key: 'type', col: 'store_type', kind: 'text', label: 'Type', hint: 'pharmacy or other' },
  { key: 'address', col: 'address', kind: 'text', label: 'Address' },
  { key: 'pincode', col: 'pincode', kind: 'text', label: 'Pincode' },
  { key: 'phone', col: 'phone', kind: 'text', label: 'Phone' },
  { key: 'reviewUrl', col: 'google_review_url', kind: 'text', label: 'Google review link' },
  { key: 'shiftMode', col: 'shift_mode', kind: 'text', label: 'Shift mode', hint: 'time or staff' },
  { key: 'operatorRequired', col: 'operator_required', kind: 'bool', label: 'Operator required' },
  { key: 'operatorHoldMinutes', col: 'operator_hold_minutes', kind: 'int', label: 'Operator hold (minutes)' },
  { key: 'approvalMode', col: 'approval_mode', kind: 'text', label: 'Approval mode', hint: 'blank = business setting' },
  { key: 'returnsAllowed', col: 'returns_allowed', kind: 'bool', label: 'Returns allowed' },
  { key: 'cashRefundLimit', col: 'cash_refund_limit', kind: 'num', label: 'Cash refund limit' },
  { key: 'depositThreshold', col: 'deposit_threshold', kind: 'num', label: 'Deposit threshold' },
  { key: 'depositSchedule', col: 'deposit_schedule', kind: 'text', label: 'Deposit schedule', hint: 'none, daily, weekly or monthly' },
  { key: 'depositWeekdays', col: 'deposit_weekdays', kind: 'intlist', label: 'Deposit weekdays', hint: '0=Sunday ... 6=Saturday, comma separated' },
  { key: 'depositMonthDays', col: 'deposit_month_days', kind: 'intlist', label: 'Deposit days of month', hint: 'comma separated; 0 = the last day of the month' },
  { key: 'vaultEnabled', col: 'vault_enabled', kind: 'bool', label: 'Vault' },
  { key: 'floatDenominations', col: 'float_denominations', kind: 'denoms', label: 'Drawer float notes', hint: 'for example 500x4; 100x10' },
  { key: 'floatAmount', col: 'float_amount', kind: 'num', label: 'Drawer float amount' },
  { key: 'vaultDropConfirmLimit', col: 'vault_drop_confirm_limit', kind: 'num', label: 'Vault drop confirmation limit' },
  { key: 'active', col: 'active', kind: 'bool', label: 'Active' },
];

export interface ProfileShift { name: string; startTime?: string; endTime?: string; active?: boolean; defaultOpener?: string | null }
export interface ProfileStore { name: string; shifts?: ProfileShift[]; [k: string]: any }
export interface ProfileStaff { email: string; fullName: string; phone?: string | null; location?: string | null; role: string; stores?: string[] }
export interface Profile {
  format: string;
  schemaVersion: number;
  exportedAt?: string;
  business?: Record<string, any>;
  stores?: ProfileStore[];
  staff?: ProfileStaff[];
}

export const LOCKED_OUT_ROLES: string[] = RESERVED_ROLES;
export const NOT_A_SEAT: string[] = [ROLE.COUNTER, ROLE.PERSONAL];

const has = (o: any, k: string) => o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
const clean = (v: any) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v);

function text(v: any, max: number, label: string, required = false): string | null {
  if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw new Error(`${label} must be text.`);
  const t = String(clean(v));
  if (t.length > max) throw new Error(`${label} can be at most ${max} characters.`);
  return t;
}
function bool(v: any, label: string): boolean {
  if (typeof v !== 'boolean') throw new Error(`${label} must be true or false.`);
  return v;
}
function num(v: any, label: string, min = 0): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new Error(`${label} must be a number of ${min} or more.`);
  return n;
}
function ints(v: any, label: string, min: number, max: number): number[] {
  if (!Array.isArray(v)) throw new Error(`${label} must be a list of numbers.`);
  const nums = v.map((x) => Number(x));
  if (nums.some((n) => !Number.isInteger(n) || n < min || n > max)) throw new Error(`${label} must be whole numbers from ${min} to ${max}.`);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}
export const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** checks one business field and returns the value as it will be stored; throws with a plain message */
function businessValue(key: string, v: any): any {
  switch (key) {
    case 'name': { const t = text(v, 40, 'The business name', true)!; if (t.length < 2) throw new Error('The business name must be at least 2 characters.'); return t; }
    case 'legalName': return text(v, 120, 'The legal name');
    case 'businessType': if (!isBusinessType(v)) throw new Error('The business type must be pharmacy or general.'); return v;
    case 'legalForm': if (!isLegalForm(v)) throw new Error('The legal form is not one this app knows.'); return v;
    case 'gstin': { const t = text(v, 15, 'The GSTIN'); if (t && !/^[0-9A-Za-z]{15}$/.test(t)) throw new Error('The GSTIN must be 15 letters and digits.'); return t ? t.toUpperCase() : null; }
    case 'stateCode': { const t = text(v, 2, 'The state code'); if (t && !/^\d{2}$/.test(t)) throw new Error('The state code must be two digits.'); return t; }
    case 'address': return text(v, 200, 'The address');
    case 'pincode': return text(v, 10, 'The pincode');
    case 'phone': { const p = checkPhones(v, 'The phone'); if (!p.ok) throw new Error(p.error); return p.value; }
    case 'grievancePhone': { const p = checkPhones(v, 'The grievance phone'); if (!p.ok) throw new Error(p.error); return p.value; }
    case 'website': { const w = checkWebsite(v, 'The website'); if (!w.ok) throw new Error(w.error); return w.value; }
    case 'approvalMode': if (!isValidApprovalMode(v)) throw new Error('The approval mode must be self or separate.'); return v;
    case 'staffingPreset': if (v === null || v === '') return null; if (!PRESETS.includes(v)) throw new Error(`The staffing preset must be one of ${PRESETS.join(', ')}.`); return v;
    case 'billReturnNote': return text(v, 300, 'The return note');
    default: return bool(v, `"${key}"`);
  }
}

function storeValue(key: string, v: any): any {
  switch (key) {
    case 'type': if (v !== 'pharmacy' && v !== 'other') throw new Error('The type must be pharmacy or other.'); return v;
    case 'address': return text(v, 200, 'The address');
    case 'pincode': return text(v, 10, 'The pincode');
    case 'phone': { const p = checkPhones(v, 'The phone'); if (!p.ok) throw new Error(p.error); return p.value; }
    case 'reviewUrl': { const t = text(v, 500, 'The review link'); if (t && !/^https?:\/\/\S+$/i.test(t)) throw new Error('The review link must start with http:// or https://.'); return t; }
    case 'shiftMode': if (v !== 'time' && v !== 'staff') throw new Error('The shift mode must be time or staff.'); return v;
    case 'operatorHoldMinutes': { const n = num(v, 'The operator hold', 0); if (n === null || !Number.isInteger(n) || n > 1440) throw new Error('The operator hold must be whole minutes from 0 to 1440.'); return n; }
    case 'approvalMode': if (v === null || v === '') return null; if (!isValidApprovalMode(v)) throw new Error('The approval mode must be self or separate, or empty.'); return v;
    case 'cashRefundLimit': return num(v, 'The cash refund limit');
    case 'depositThreshold': { const n = num(v, 'The deposit threshold'); return n ?? 0; }
    case 'depositSchedule': if (!['none', 'daily', 'weekly', 'monthly'].includes(v)) throw new Error('The deposit schedule must be none, daily, weekly or monthly.'); return v;
    case 'depositWeekdays': return ints(v, 'The deposit weekdays', 0, 6);
    case 'depositMonthDays': return ints(v, 'The deposit days of the month', 0, 31);
    case 'floatDenominations': {
      if (v === null) return null;
      const d = normalizeDenominations(v);
      if (!d && !(Array.isArray(v) && v.length === 0)) throw new Error('The float notes must be a list of {d, n} (face value and count).');
      return d;
    }
    case 'floatAmount': return num(v, 'The float amount') ?? 0;
    case 'vaultDropConfirmLimit': return num(v, 'The vault confirmation limit') ?? 0;
    default: return bool(v, `"${key}"`);
  }
}

export interface Parsed { profile: Profile; errors: string[]; warnings: string[] }

/** checks a profile (from a JSON file, or built from a spreadsheet) and returns it tidied, with every problem found listed */
export function parseProfile(raw: any): Parsed {
  const errors: string[] = [];
  const warnings: string[] = [];
  const out: Profile = { format: PROFILE_FORMAT, schemaVersion: SCHEMA_VERSION };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { profile: out, errors: ['This is not a business profile file.'], warnings };
  if (raw.format !== PROFILE_FORMAT) return { profile: out, errors: [`This is not a business profile file (it should say format "${PROFILE_FORMAT}").`], warnings };
  if (!Number.isInteger(raw.schemaVersion) || raw.schemaVersion < 1) return { profile: out, errors: ['The file has no schema version.'], warnings };
  if (raw.schemaVersion > SCHEMA_VERSION) return { profile: out, errors: [`The file is from a newer version of the app (schema ${raw.schemaVersion}; this one reads up to ${SCHEMA_VERSION}). Update the app first.`], warnings };

  const known = new Set(['format', 'schemaVersion', 'exportedAt', 'source', 'business', 'stores', 'staff']);
  for (const k of Object.keys(raw)) if (!known.has(k)) warnings.push(`"${k}" is not part of a profile and is ignored.`);

  if (raw.business !== undefined) {
    if (!raw.business || typeof raw.business !== 'object' || Array.isArray(raw.business)) errors.push('"business" must be an object.');
    else {
      const b: Record<string, any> = {};
      const keys = new Set(BUSINESS_FIELDS.map((f) => f.key));
      for (const k of Object.keys(raw.business)) if (!keys.has(k)) warnings.push(`business: "${k}" is not a setting and is ignored.`);
      for (const f of BUSINESS_FIELDS) {
        if (!has(raw.business, f.key)) continue;
        try { b[f.key] = businessValue(f.key, raw.business[f.key]); } catch (e: any) { errors.push(`business: ${e.message}`); }
      }
      out.business = b;
    }
  }

  if (raw.stores !== undefined) {
    if (!Array.isArray(raw.stores)) errors.push('"stores" must be a list.');
    else {
      out.stores = [];
      const seen = new Set<string>();
      raw.stores.forEach((s: any, i: number) => {
        let name: string | null = null;
        try { name = text(s?.name, 40, `Store ${i + 1}: the name`, true); } catch (e: any) { errors.push(e.message); return; }
        const tag = `store "${name}"`;
        if (seen.has(name!.toLowerCase())) { errors.push(`${tag} is listed twice.`); return; }
        seen.add(name!.toLowerCase());
        const st: ProfileStore = { name: name! };
        const keys = new Set([...STORE_FIELDS.map((f) => f.key), 'name', 'shifts']);
        for (const k of Object.keys(s)) if (!keys.has(k)) warnings.push(`${tag}: "${k}" is not a setting and is ignored.`);
        for (const f of STORE_FIELDS) {
          if (!has(s, f.key)) continue;
          try { st[f.key] = storeValue(f.key, s[f.key]); } catch (e: any) { errors.push(`${tag}: ${e.message}`); }
        }
        // the schedule needs its days; a float given as notes decides the amount
        if (st.depositSchedule === 'weekly' && !(st.depositWeekdays || []).length) errors.push(`${tag}: a weekly deposit needs at least one weekday.`);
        if (st.depositSchedule === 'monthly' && !(st.depositMonthDays || []).length) errors.push(`${tag}: a monthly deposit needs at least one day of the month.`);
        if (st.floatDenominations) {
          const total = denominationTotal(st.floatDenominations);
          if (has(s, 'floatAmount') && st.floatAmount !== total) errors.push(`${tag}: the float notes add up to Rs ${total}, not Rs ${st.floatAmount}.`);
          st.floatAmount = total;
        }
        if (s.shifts !== undefined) {
          if (!Array.isArray(s.shifts)) errors.push(`${tag}: "shifts" must be a list.`);
          else {
            st.shifts = [];
            const seenShift = new Set<string>();
            s.shifts.forEach((sh: any, j: number) => {
              try {
                const n = text(sh?.name, 60, `${tag}, shift ${j + 1}: the name`, true)!;
                if (seenShift.has(n.toLowerCase())) throw new Error(`${tag}: shift "${n}" is listed twice.`);
                seenShift.add(n.toLowerCase());
                const one: ProfileShift = { name: n };
                for (const t of ['startTime', 'endTime'] as const) {
                  if (!has(sh, t)) throw new Error(`${tag}, shift "${n}": ${t === 'startTime' ? 'the start time' : 'the end time'} is required.`);
                  const tv = String(sh[t]).trim();
                  if (!TIME.test(tv)) throw new Error(`${tag}, shift "${n}": ${t === 'startTime' ? 'the start time' : 'the end time'} must look like 09:00.`);
                  one[t] = tv.padStart(5, '0');
                }
                if (has(sh, 'active')) one.active = bool(sh.active, `${tag}, shift "${n}": active`);
                if (has(sh, 'defaultOpener')) {
                  if (sh.defaultOpener === null || sh.defaultOpener === '') one.defaultOpener = null;
                  else { const e = emailProblem(sh.defaultOpener); if ('error' in e) throw new Error(`${tag}, shift "${n}": the default opener ${e.error}`); one.defaultOpener = e.value; }
                }
                st.shifts!.push(one);
              } catch (e: any) { errors.push(e.message); }
            });
          }
        }
        out.stores!.push(st);
      });
    }
  }

  if (raw.staff !== undefined) {
    if (!Array.isArray(raw.staff)) errors.push('"staff" must be a list.');
    else {
      out.staff = [];
      const seen = new Set<string>();
      raw.staff.forEach((p: any, i: number) => {
        const e = emailProblem(p?.email);
        if ('error' in e) { errors.push(`Staff row ${i + 1}: ${e.error}`); return; }
        const tag = `login ${e.value}`;
        if (seen.has(e.value.toLowerCase())) { errors.push(`${tag} is listed twice.`); return; }
        seen.add(e.value.toLowerCase());
        try {
          const one: ProfileStaff = { email: e.value, fullName: text(p.fullName, 40, `${tag}: the name`, true)!, role: text(p.role, 40, `${tag}: the role`, true)! };
          if (has(p, 'phone')) one.phone = text(p.phone, 30, `${tag}: the phone`);
          if (has(p, 'location')) one.location = text(p.location, 80, `${tag}: the location`);
          if (has(p, 'stores')) {
            if (!Array.isArray(p.stores)) throw new Error(`${tag}: "stores" must be a list of store names.`);
            const names = p.stores.map((x: any) => String(x ?? '').trim()).filter(Boolean);
            one.stores = names.filter((n: string, k: number) => names.findIndex((m: string) => m.toLowerCase() === n.toLowerCase()) === k);
          }
          out.staff!.push(one);
        } catch (er: any) { errors.push(er.message); }
      });
    }
  }
  return { profile: out, errors, warnings };
}

// ---------------------------------------------------------------- planning

/** a store, a shift template or a business as the database holds it, keyed by the profile's key names */
export type Row = Record<string, any>;

export interface ExistingStore { id: number; name: string; values: Row; vaultBalance: number; shifts: Array<{ id: number; name: string; startTime: string; endTime: string; active: boolean; openerEmail: string | null }>; openShifts: number }
export interface ExistingUser { id: number; email: string; fullName: string; phone: string | null; location: string | null; role: string; businessId: number | null; active: boolean; archived: boolean; stores: string[] }
export interface PlanInput {
  business: Row;
  stores: ExistingStore[];
  users: ExistingUser[];
  /** role name -> whether it can be given (exists and is not hidden) */
  roles: Record<string, { id: number; locked: boolean }>;
  businessId: number;
  /** seats left on a hosted plan (null = no limit) */
  roomLeft: { stores: number | null; users: number | null };
}

export interface FieldChange { label: string; from: string; to: string }
export interface StorePlan {
  action: 'create' | 'update' | 'same'; name: string; id?: number; values: Row; changes: FieldChange[];
  shifts: Array<{ action: 'create' | 'update' | 'same'; name: string; id?: number; values: Row; changes: FieldChange[]; opener: string | null | undefined }>;
}
export interface StaffPlan {
  action: 'create' | 'update' | 'same' | 'skip'; email: string; id?: number; reason?: string; changes: FieldChange[];
  roleId?: number; roleName?: string; values: Row; stores?: string[]; storesChanged: boolean;
}
export interface Plan {
  business: { changes: FieldChange[]; values: Row } | null;
  stores: StorePlan[]; staff: StaffPlan[];
  warnings: string[]; blockers: string[];
  counts: { storesCreated: number; storesUpdated: number; staffCreated: number; staffUpdated: number; staffSkipped: number; shiftsChanged: number };
}

const show = (v: any): string => {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.length ? v.map((x) => (x && typeof x === 'object' ? `${x.d}x${x.n}` : String(x))).join(', ') : '(none)';
  return String(v);
};
/** equal as the app sees it: an empty text and no value are the same */
const same = (a: any, b: any) => JSON.stringify(a === '' ? null : a ?? null) === JSON.stringify(b === '' ? null : b ?? null);

function diff(fields: FieldSpec[], current: Row, wanted: Row): { values: Row; changes: FieldChange[] } {
  const values: Row = {};
  const changes: FieldChange[] = [];
  for (const f of fields) {
    if (!has(wanted, f.key)) continue;
    if (same(current[f.key], wanted[f.key])) continue;
    values[f.key] = wanted[f.key];
    changes.push({ label: f.label, from: show(current[f.key]), to: show(wanted[f.key]) });
  }
  return { values, changes };
}

const defaultsOfStore: Row = {
  type: 'pharmacy', shiftMode: 'time', operatorRequired: true, operatorHoldMinutes: 60, returnsAllowed: true, depositThreshold: 0,
  depositSchedule: 'none', depositWeekdays: [], depositMonthDays: [], vaultEnabled: false, floatAmount: 0, vaultDropConfirmLimit: 0, active: true,
};

/** what importing a profile would change, and what stops it. Reads nothing and writes nothing. */
export function planImport(profile: Profile, input: PlanInput): Plan {
  const plan: Plan = { business: null, stores: [], staff: [], warnings: [], blockers: [], counts: { storesCreated: 0, storesUpdated: 0, staffCreated: 0, staffUpdated: 0, staffSkipped: 0, shiftsChanged: 0 } };

  if (profile.business) {
    const d = diff(BUSINESS_FIELDS, input.business, profile.business);
    if (d.changes.length) {
      plan.business = d;
      if (d.values.name !== undefined) plan.warnings.push(`The business will be renamed from "${input.business.name}" to "${d.values.name}".`);
      if (d.values.businessType !== undefined) plan.warnings.push('Changing the business type changes which pharmacy features are shown.');
    }
  }

  // stores
  const byName = new Map(input.stores.map((s) => [s.name.toLowerCase(), s]));
  const heldTwice = new Set(input.stores.map((s) => s.name.toLowerCase()).filter((n, i, all) => all.indexOf(n) !== i));
  const storeNames = new Set<string>(input.stores.map((s) => s.name.toLowerCase()));
  for (const s of profile.stores ?? []) storeNames.add(s.name.toLowerCase());
  const staffByEmail = new Map((profile.staff ?? []).map((p) => [p.email.toLowerCase(), p]));
  const userByEmail = new Map(input.users.map((u) => [u.email.toLowerCase(), u]));

  for (const s of profile.stores ?? []) {
    const cur = byName.get(s.name.toLowerCase());
    if (heldTwice.has(s.name.toLowerCase())) {
      plan.blockers.push(`More than one store here is called "${s.name}", so the file cannot tell which one it means. Rename one of them under Settings > Store first.`);
      continue;
    }
    const wanted: Row = {};
    for (const f of STORE_FIELDS) if (has(s, f.key)) wanted[f.key] = s[f.key];
    let sp: StorePlan;
    if (!cur) {
      const full = { ...defaultsOfStore, ...wanted };
      if (full.depositSchedule !== 'weekly') full.depositWeekdays = [];
      if (full.depositSchedule !== 'monthly') full.depositMonthDays = [];
      sp = { action: 'create', name: s.name, values: full, changes: Object.keys(wanted).map((k) => ({ label: STORE_FIELDS.find((f) => f.key === k)!.label, from: '(new)', to: show(wanted[k]) })), shifts: [] };
      plan.counts.storesCreated++;
    } else {
      if (wanted.depositSchedule !== undefined) {
        const sched = wanted.depositSchedule;
        if (sched !== 'weekly' && wanted.depositWeekdays === undefined) wanted.depositWeekdays = [];
        if (sched !== 'monthly' && wanted.depositMonthDays === undefined) wanted.depositMonthDays = [];
        if (sched === 'weekly' && wanted.depositWeekdays === undefined && !(cur.values.depositWeekdays || []).length) plan.blockers.push(`Store "${s.name}": a weekly deposit needs at least one weekday.`);
        if (sched === 'monthly' && wanted.depositMonthDays === undefined && !(cur.values.depositMonthDays || []).length) plan.blockers.push(`Store "${s.name}": a monthly deposit needs at least one day of the month.`);
      }
      if (wanted.vaultEnabled === false && cur.values.vaultEnabled && cur.vaultBalance > 0) {
        plan.warnings.push(`Store "${s.name}": the vault still holds Rs ${cur.vaultBalance}, so it stays on. Bank it or adjust it to nil first.`);
        delete wanted.vaultEnabled;
      }
      if (wanted.shiftMode !== undefined && wanted.shiftMode !== cur.values.shiftMode && cur.openShifts > 0) {
        plan.blockers.push(`Store "${s.name}" has a shift open, so its shift mode cannot change until the shift is closed.`);
      }
      // a float given as notes decides the amount; one given as an amount alone clears the notes
      if (wanted.floatAmount !== undefined && wanted.floatDenominations === undefined && wanted.floatAmount !== cur.values.floatAmount) wanted.floatDenominations = null;
      const d = diff(STORE_FIELDS, cur.values, wanted);
      sp = { action: d.changes.length ? 'update' : 'same', name: cur.name, id: cur.id, values: d.values, changes: d.changes, shifts: [] };
      if (d.changes.length) plan.counts.storesUpdated++;
    }

    // shifts
    for (const sh of s.shifts ?? []) {
      const curSh = cur?.shifts.find((x) => x.name.toLowerCase() === sh.name.toLowerCase());
      const wantedSh: Row = { startTime: sh.startTime, endTime: sh.endTime };
      if (sh.active !== undefined) wantedSh.active = sh.active;
      let opener = sh.defaultOpener;
      if (opener) {
        const o = opener.toLowerCase();
        const inFile = staffByEmail.get(o);
        const inDb = userByEmail.get(o);
        const works = (names: string[] | undefined) => (names ?? []).some((n) => n.toLowerCase() === s.name.toLowerCase());
        const role = inFile?.role ?? inDb?.role;
        const stores = inFile ? inFile.stores : inDb?.stores;
        if (!role || !(works(stores) || (inFile && inFile.stores === undefined && inDb && works(inDb.stores)))) {
          plan.warnings.push(`Store "${s.name}", shift "${sh.name}": ${opener} does not work at this store (or is not a login), so no default opener is set.`);
          opener = undefined;
        } else if (role === ROLE.COUNTER || role === ROLE.SITE_ADMIN) {
          plan.warnings.push(`Store "${s.name}", shift "${sh.name}": the shared counter login cannot be the default opener.`);
          opener = undefined;
        }
      }
      if (!curSh) {
        sp.shifts.push({ action: 'create', name: sh.name, values: { active: true, ...wantedSh }, changes: [{ label: `Shift ${sh.name}`, from: '(new)', to: `${sh.startTime} to ${sh.endTime}` }], opener });
        plan.counts.shiftsChanged++;
      } else {
        const d = diff([{ key: 'startTime', col: '', kind: 'text', label: `Shift ${sh.name}: start` }, { key: 'endTime', col: '', kind: 'text', label: `Shift ${sh.name}: end` }, { key: 'active', col: '', kind: 'bool', label: `Shift ${sh.name}: active` }], curSh, wantedSh);
        const openerChanged = opener !== undefined && (opener ?? null)?.toLowerCase() !== (curSh.openerEmail ?? null)?.toLowerCase();
        if (openerChanged) d.changes.push({ label: `Shift ${sh.name}: default opener`, from: show(curSh.openerEmail), to: show(opener) });
        const changed = d.changes.length > 0;
        sp.shifts.push({ action: changed ? 'update' : 'same', name: curSh.name, id: curSh.id, values: d.values, changes: d.changes, opener: openerChanged ? opener : undefined });
        if (changed) plan.counts.shiftsChanged++;
      }
    }
    plan.stores.push(sp);
  }

  if (input.roomLeft.stores !== null && plan.counts.storesCreated > input.roomLeft.stores) {
    plan.blockers.push(`The plan has room for ${input.roomLeft.stores} more ${input.roomLeft.stores === 1 ? 'store' : 'stores'}, and the file adds ${plan.counts.storesCreated}.`);
  }

  // staff
  let seatsNeeded = 0;
  for (const p of profile.staff ?? []) {
    const role = input.roles[p.role];
    const cur = userByEmail.get(p.email.toLowerCase());
    const skip = (reason: string) => { plan.staff.push({ action: 'skip', email: p.email, reason, changes: [], values: {}, storesChanged: false }); plan.counts.staffSkipped++; };
    if (!role || role.locked) { skip(`There is no role called "${p.role}" here.`); continue; }
    if (LOCKED_OUT_ROLES.includes(p.role)) { skip(`${p.role} logins are set up by the platform administrator, not by a file.`); continue; }
    const unknown = (p.stores ?? []).filter((n) => !storeNames.has(n.toLowerCase()));
    if (unknown.length) { skip(`The store ${unknown.map((n) => `"${n}"`).join(', ')} does not exist (add it to the stores list or create it first).`); continue; }
    if (cur && cur.businessId !== null && cur.businessId !== input.businessId) { skip('This email already belongs to a login in another business.'); continue; }
    if (cur && (!cur.active || cur.archived)) { skip('This login was removed earlier, and a removed login cannot be brought back from a file.'); continue; }
    if (cur && OWNER_ROLES.includes(cur.role)) { skip('This is an owner login; it is not changed from a file.'); continue; }
    const wantedStores = p.stores;
    if (!cur) {
      if (!NOT_A_SEAT.includes(p.role)) seatsNeeded++;
      plan.staff.push({
        action: 'create', email: p.email, roleId: role.id, roleName: p.role, stores: wantedStores ?? [], storesChanged: !!(wantedStores ?? []).length,
        values: { fullName: p.fullName, phone: p.phone ?? null, location: p.location ?? null },
        changes: [{ label: 'Login', from: '(new)', to: `${p.fullName}, ${p.role}${(wantedStores ?? []).length ? `, ${wantedStores!.join(' / ')}` : ''}` }],
      });
      plan.counts.staffCreated++;
      if (!(wantedStores ?? []).length) plan.warnings.push(`${p.email} has no store, so they cannot work anywhere until one is assigned.`);
      continue;
    }
    const wanted: Row = { fullName: p.fullName, role: p.role };
    if (p.phone !== undefined) wanted.phone = p.phone;
    if (p.location !== undefined) wanted.location = p.location;
    const d = diff([
      { key: 'fullName', col: 'full_name', kind: 'text', label: 'Name' }, { key: 'phone', col: 'phone', kind: 'text', label: 'Phone' },
      { key: 'location', col: 'location', kind: 'text', label: 'Location' }, { key: 'role', col: 'role', kind: 'text', label: 'Role' },
    ], { fullName: cur.fullName, phone: cur.phone, location: cur.location, role: cur.role }, wanted);
    const storesChanged = wantedStores !== undefined && !same(wantedStores.map((x) => x.toLowerCase()), cur.stores.map((x) => x.toLowerCase()));
    if (storesChanged) d.changes.push({ label: 'Stores', from: show(cur.stores), to: show(wantedStores) });
    plan.staff.push({ action: d.changes.length ? 'update' : 'same', email: cur.email, id: cur.id, roleId: role.id, roleName: p.role, values: d.values, changes: d.changes, stores: wantedStores, storesChanged });
    if (d.changes.length) plan.counts.staffUpdated++;
  }
  if (input.roomLeft.users !== null && seatsNeeded > input.roomLeft.users) {
    plan.blockers.push(`The plan has room for ${input.roomLeft.users} more ${input.roomLeft.users === 1 ? 'login' : 'logins'}, and the file adds ${seatsNeeded} (the shared Counter and Personal logins do not count).`);
  }
  return plan;
}

export const planChangeCount = (p: Plan) => (p.business ? 1 : 0) + p.counts.storesCreated + p.counts.storesUpdated + p.counts.staffCreated + p.counts.staffUpdated + p.counts.shiftsChanged;

// ---------------------------------------------------------------- temporary passwords

const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';

/** a password to hand over once: 10 characters, with a capital, a small letter and a digit, and no look-alike characters (0/O, 1/l/I) */
export function tempPassword(pick: (n: number) => number = (n) => randomInt(n)): string {
  const all = LOWER + UPPER + DIGIT;
  const chars = [LOWER[pick(LOWER.length)], UPPER[pick(UPPER.length)], DIGIT[pick(DIGIT.length)]];
  while (chars.length < 10) chars.push(all[pick(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = pick(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}
