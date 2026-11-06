import * as ExcelJS from 'exceljs';
import { BUSINESS_FIELDS, FieldSpec, PROFILE_FORMAT, Profile, SCHEMA_VERSION, STORE_FIELDS } from './config-profile';

/**
 * The profile as an Excel workbook, and back. The workbook is only a friendlier way to type the same thing: it is turned into a profile
 * object here and then checked by parseProfile like a JSON file. Stores, shifts and staff are matched by name and email, never by number.
 * An empty cell means "leave as it is".
 */
const STORE_NAME = 'Store name';
const SHIFT_COLS = ['Store', 'Shift name', 'Start (09:00)', 'End (17:00)', 'Active', 'Default opener (email)'];
const STAFF_COLS = ['Login email', 'Full name', 'Phone', 'Location', 'Role', 'Stores (first is main; separate with ;)'];
const norm = (s: any) => String(s ?? '').trim().toLowerCase();

function cellText(v: any): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`;
  if (typeof v === 'object') {
    if ('result' in v) return cellText((v as any).result);
    if ('richText' in v) return (v as any).richText.map((t: any) => t.text).join('');
    if ('text' in v) return String((v as any).text);
    if ('hyperlink' in v) return String((v as any).text ?? (v as any).hyperlink);
  }
  return String(v).trim();
}

const yesNo = (b: any) => (b === true ? 'Yes' : b === false ? 'No' : '');
const denomsText = (d: any) => (Array.isArray(d) ? d.map((x) => `${x.d}x${x.n}`).join('; ') : '');
const listText = (l: any) => (Array.isArray(l) ? l.join(', ') : '');

function toCell(f: FieldSpec, v: any): any {
  if (v === null || v === undefined) return '';
  switch (f.kind) {
    case 'bool': return yesNo(v);
    case 'intlist': return listText(v);
    case 'denoms': return denomsText(v);
    default: return v;
  }
}

/** a typed cell back to the value the profile expects; what cannot be read is passed on as typed, so the check names it */
function fromCell(f: FieldSpec, text: string): any {
  switch (f.kind) {
    case 'bool': { const t = norm(text); if (['yes', 'y', 'true', '1'].includes(t)) return true; if (['no', 'n', 'false', '0'].includes(t)) return false; return text; }
    case 'num': case 'int': { const n = Number(text.replace(/,/g, '')); return Number.isFinite(n) ? n : text; }
    case 'intlist': { const parts = text.split(/[,;\s]+/).filter(Boolean); const nums = parts.map(Number); return nums.every(Number.isFinite) ? nums : text; }
    case 'denoms': {
      const rows = text.split(/[;,]+/).map((x) => x.trim()).filter(Boolean).map((x) => /^(\d+)\s*[xX*]\s*(\d+)$/.exec(x));
      return rows.every(Boolean) ? rows.map((m) => ({ d: Number(m![1]), n: Number(m![2]) })) : text;
    }
    default: return text;
  }
}

function header(ws: ExcelJS.Worksheet, cols: string[], widths?: number[]) {
  ws.addRow(cols);
  const r = ws.getRow(1);
  r.font = { bold: true };
  r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  cols.forEach((_, i) => { ws.getColumn(i + 1).width = widths?.[i] ?? 22; });
}

function listValidation(ws: ExcelJS.Worksheet, col: number, from: number, to: number, formula: string) {
  for (let r = from; r <= to; r++) ws.getCell(r, col).dataValidation = { type: 'list', allowBlank: true, formulae: [formula], showErrorMessage: true, errorTitle: 'Pick from the list', error: 'Choose one of the values offered.' };
}

const README = [
  'Business profile: how to fill this workbook',
  '',
  '• Business sheet: one setting per row; type the value in the Value column.',
  '• Stores sheet: one store per row. Shifts sheet: one shift per row, with the store name exactly as on the Stores sheet.',
  '• Staff sheet: one login per row, matched by email. Stores can be several, separated with ; and the first is the main store.',
  '• An empty cell means "leave as it is" (for a new record, the usual default). To clear a value, use the app screen.',
  '• Yes/No columns have a dropdown. Weekdays: 0 = Sunday ... 6 = Saturday. Days of the month: 0 = the last day.',
  '• Owner logins (Business Head, Owner-operator) are not part of the file. Passwords are never in the file: each new login is given a temporary password shown once on the screen after import.',
  '• Importing never deletes anything. A store, shift or login that is not in the file is left alone.',
];

/** the workbook for a profile (an exported one, or an empty one when only the headers are wanted) */
export async function profileToWorkbook(profile: Profile, roleNames: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const readme = wb.addWorksheet('README');
  README.forEach((t, i) => { readme.addRow([t]); if (i === 0) readme.getRow(1).font = { bold: true, size: 14 }; });
  readme.getColumn(1).width = 120;
  readme.addRow([]);
  readme.addRow([`format ${PROFILE_FORMAT}, schema ${SCHEMA_VERSION}${profile.exportedAt ? `, exported ${profile.exportedAt}` : ''}`]);

  const lists = wb.addWorksheet('Lists', { state: 'hidden' });
  roleNames.forEach((n, i) => { lists.getCell(i + 1, 1).value = n; });
  lists.getCell(1, 2).value = 'Yes'; lists.getCell(2, 2).value = 'No';

  // business
  const bs = wb.addWorksheet('Business');
  header(bs, ['Setting', 'Value', 'Allowed values'], [40, 40, 50]);
  for (const f of BUSINESS_FIELDS) bs.addRow([f.label, toCell(f, profile.business?.[f.key]), f.kind === 'bool' ? 'Yes or No' : f.hint ?? '']);
  BUSINESS_FIELDS.forEach((f, i) => { if (f.kind === 'bool') listValidation(bs, 2, i + 2, i + 2, 'Lists!$B$1:$B$2'); });

  // stores
  const ss = wb.addWorksheet('Stores');
  header(ss, [STORE_NAME, ...STORE_FIELDS.map((f) => f.label)]);
  ss.getRow(1).alignment = { wrapText: true, vertical: 'top' };
  ss.getColumn(1).width = 28;
  for (const s of profile.stores ?? []) ss.addRow([s.name, ...STORE_FIELDS.map((f) => toCell(f, s[f.key]))]);
  STORE_FIELDS.forEach((f, i) => {
    if (f.kind === 'bool') listValidation(ss, i + 2, 2, 200, 'Lists!$B$1:$B$2');
    if (f.hint) ss.getCell(1, i + 2).note = f.hint;
  });

  // shifts
  const sh = wb.addWorksheet('Shifts');
  header(sh, SHIFT_COLS);
  for (const s of profile.stores ?? []) for (const x of s.shifts ?? []) sh.addRow([s.name, x.name, x.startTime ?? '', x.endTime ?? '', yesNo(x.active), x.defaultOpener ?? '']);
  sh.getColumn(3).numFmt = '@'; sh.getColumn(4).numFmt = '@';
  listValidation(sh, 5, 2, 400, 'Lists!$B$1:$B$2');

  // staff
  const st = wb.addWorksheet('Staff');
  header(st, STAFF_COLS, [32, 26, 18, 22, 22, 44]);
  for (const p of profile.staff ?? []) st.addRow([p.email, p.fullName, p.phone ?? '', p.location ?? '', p.role, (p.stores ?? []).join('; ')]);
  if (roleNames.length) listValidation(st, 5, 2, 400, `Lists!$A$1:$A$${roleNames.length}`);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** the profile object a workbook holds (not yet checked) */
export async function workbookToProfile(buffer: Buffer): Promise<any> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer as any); } catch { throw new Error('This is not an Excel (.xlsx) file.'); }
  const sheet = (name: string) => wb.worksheets.find((w) => norm(w.name) === norm(name));
  const rowsOf = (ws: ExcelJS.Worksheet | undefined): string[][] => {
    const out: string[][] = [];
    ws?.eachRow({ includeEmpty: false }, (row) => out.push((row.values as any[]).slice(1).map(cellText)));
    return out;
  };
  /** the header row decides the column of each heading, so a column moved or added by hand still reads */
  const table = (ws: ExcelJS.Worksheet | undefined) => {
    const rows = rowsOf(ws);
    const head = (rows[0] ?? []).map(norm);
    return rows.slice(1).filter((r) => r.some((c) => c)).map((r) => (label: string) => r[head.indexOf(norm(label))] ?? '');
  };

  const out: any = { format: PROFILE_FORMAT, schemaVersion: SCHEMA_VERSION };
  if (!sheet('Business') && !sheet('Stores') && !sheet('Staff')) throw new Error('This workbook has none of the Business, Stores or Staff sheets. Download the template and fill that in.');

  const bs = sheet('Business');
  if (bs) {
    const b: any = {};
    for (const r of rowsOf(bs).slice(1)) {
      const f = BUSINESS_FIELDS.find((x) => norm(x.label) === norm(r[0]));
      if (f && r[1]) b[f.key] = fromCell(f, r[1]);
    }
    out.business = b;
  }

  const stores = sheet('Stores');
  if (stores) {
    out.stores = table(stores).map((get) => {
      const s: any = { name: get(STORE_NAME) };
      for (const f of STORE_FIELDS) { const t = get(f.label); if (t) s[f.key] = fromCell(f, t); }
      return s;
    });
    const byStore = new Map<string, any>(out.stores.map((s: any) => [norm(s.name), s]));
    const errs: string[] = [];
    for (const get of table(sheet('Shifts'))) {
      const s = byStore.get(norm(get(SHIFT_COLS[0])));
      if (!s) { errs.push(get(SHIFT_COLS[0])); continue; }
      const one: any = { name: get(SHIFT_COLS[1]), startTime: get(SHIFT_COLS[2]), endTime: get(SHIFT_COLS[3]) };
      const a = get(SHIFT_COLS[4]); if (a) one.active = fromCell({ kind: 'bool' } as any, a);
      const o = get(SHIFT_COLS[5]); if (o) one.defaultOpener = o;
      (s.shifts ??= []).push(one);
    }
    if (errs.length) throw new Error(`The Shifts sheet names ${Array.from(new Set(errs)).map((x) => `"${x}"`).join(', ')}, which is not on the Stores sheet.`);
  } else if (sheet('Shifts') && rowsOf(sheet('Shifts')).length > 1) {
    throw new Error('The Shifts sheet needs the Stores sheet too, to say which store each shift belongs to.');
  }

  const staff = sheet('Staff');
  if (staff) {
    out.staff = table(staff).map((get) => {
      const p: any = { email: get(STAFF_COLS[0]), fullName: get(STAFF_COLS[1]), role: get(STAFF_COLS[4]) };
      if (get(STAFF_COLS[2])) p.phone = get(STAFF_COLS[2]);
      if (get(STAFF_COLS[3])) p.location = get(STAFF_COLS[3]);
      const st = get(STAFF_COLS[5]); if (st) p.stores = st.split(';').map((x) => x.trim()).filter(Boolean);
      return p;
    });
  }
  return out;
}
