/**
 * Writes docs/planning/KPI_MATRIX.xlsx: the revised matrix, the owner's task list and the system's suggestions put into it, one KPI sheet per position
 * (taken from the starter sets in hr-kpi-templates.ts, so the spreadsheet and the app cannot drift apart), the business scorecard and the gaps.
 * Run from api-v2:  npx ts-node -T scripts/gen-kpi-matrix.ts
 */
import * as ExcelJS from 'exceljs';
import { KPI_TEMPLATES, templateTotals, TemplateMetric } from '../src/modules/app/hr/hr-kpi-templates';

const OUT = process.argv[2] || '../docs/planning/KPI_MATRIX.xlsx';
const wb = new ExcelJS.Workbook();
wb.creator = 'RGP Back Office';

const HEAD = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1F4E79' } };
const GATE = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFDE9E7' } };
const NEW = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE6F4EA' } };
const BAND = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFEFEFEF' } };

function sheet(name: string, widths: number[], header: string[], rows: any[][], opts: { fill?: (row: any[]) => any } = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = widths.map((w) => ({ width: w }));
  const h = ws.addRow(header);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = HEAD;
  h.alignment = { vertical: 'middle', wrapText: true };
  for (const r of rows) {
    const row = ws.addRow(r);
    row.alignment = { vertical: 'top', wrapText: true };
    const f = opts.fill ? opts.fill(r) : null;
    if (f) row.fill = f;
  }
  return ws;
}

// ------------------------------------------------------------------------------------------------ read me
{
  const ws = wb.addWorksheet('Read me');
  ws.columns = [{ width: 110 }];
  const lines = [
    'KPI matrix for a pharmacy: roles, responsibilities and the measures behind them',
    '',
    'Sheets',
    '  Matrix: what good looks like (rows) in each process area (columns). Each cell names the indicator and how it is checked.',
    '  Your list mapped: every item of your task list put into the matrix, with the indicator, target and who it lands on.',
    '  System suggestions: the 21 suggested measures, with a verdict (keep, merge, make a gate, drop) and where each lands.',
    '  Sales Staff, Pharmacist, Store Head: one KPI set per position, as loaded into the app (HR > Setup > KPI > Starter sets for a pharmacy).',
    '  Business Head: the owner is not scored by the app (nobody can rate the owner); this is the monthly business scorecard instead.',
    '  Gaps to build: measures the system cannot take yet, and which manual gate or rating each would replace.',
    '',
    'How a set works',
    '  GATE: carries no points. If a gate is not met the month\'s incentive is nil, whatever the points. For legal and safety duties.',
    '  POINTS: add up to 100 per position. About 60 to 70 per cent are measured by the system, the rest by a checklist or a rating by the manager.',
    '  Source: System = measured from bills, shifts, audits, inquiries and attendance. Checklist = the shift checklist. Rated = the manager rates 1 to 5 against the description.',
    '  Targets and limits are starting values. Set them from the last eight weeks of what really happens (the History button on each measure in the app).',
    '  Incentive bands are not in these sets: the existing band set applies and the pay is the owner\'s decision.',
    '',
    'Legal items (registers, prescriptions, licences, expiry rules) are described generally. Check each against your licence conditions and the current rules.',
  ];
  lines.forEach((l, i) => { const r = ws.addRow([l]); if (i === 0 || l === 'Sheets' || l === 'How a set works') r.font = { bold: true }; r.alignment = { wrapText: true, vertical: 'top' }; });
}

// ------------------------------------------------------------------------------------------------ matrix
{
  const areas = ['Sale and returns', 'Buy and receive', 'Stock and expiry', 'Cash and shift', 'Customer', 'Prescriptions and registers', 'Store upkeep', 'People'];
  const rows: [string, string[]][] = [
    ['Compliance', [
      'Returns accepted inside the return window [System]; nothing sold above MRP [System]',
      'Quality checked on receipt, defects returned to the vendor [Rated]',
      'GATE: no expired or recalled medicine sold; expired value on shelf is nil [Rated now, System later]; temperature logged twice a day [Log, to build]',
      'Shift closed and cash deposited as the rule says [System]',
      'Consent recorded before offers are sent [System]',
      'GATE: prescription details on every scheduled-drug sale; register entry complete [Rated now, System later]; licences and registers valid, Store Head GATE [Compliance register]',
      'Licences displayed; registered pharmacist present for the assigned hours, weekend pharmacist GATE [Rated]',
      'Attendance marked every working day [System]']],
    ['Accuracy', [
      'Bills with a named customer, new measure [System]; discarded bills judged by reason [System]; right batch billed [System, bill corrections]',
      'GRN and reference on every invoice [Rated now, System later]',
      'Stock audit variance [System]; product data complete [System, to build]',
      'Cash short or excess [System]',
      'Customer data captured correctly: mobile or name and location [System]',
      'Register matches the scheduled sales [Rated now, System later]',
      'Products at their designated place; OTC on display [Rated, shelf check]',
      '—']],
    ['Timeliness', [
      '—',
      'Invoice entered within 2 days of receipt [System, to build]',
      'Short-dated stock cleared before it expires [Rated now, System later]; stock audits on time [System]',
      'Deposit made on the due day [System]',
      'Inquiries closed by the due date [System]; calls returned within 2 hours [Rated]; orders delivered by the promised date [System, to build]',
      'Register updated the same day [Rated]',
      'Device failure reported the same day [Rated]',
      'Absent days [System]; weekend pharmacist excluded']],
    ['Service', [
      'Counselling and honest advice on substitutes and extras [Rated]; cross-sell suggestions taken, counted with grievances [System]',
      '—',
      'Fast movers in stock; out-of-stock requests recorded [Rated now, System later]',
      '—',
      'Grievances about the person [System]; refill reminders done [System, to build]',
      'Counselling at dispensing [Rated]',
      '—',
      'Staff guidance and supervision, Store Head [Rated]']],
    ['Cleanliness and safety', [
      'Counter, glass and billing machine cleaned three times a day [Checklist]',
      '—',
      'Cold items stored at the right temperature [Log, to build]',
      '—',
      '—',
      '—',
      'Floor, glass, shelves cleaned on the schedule [Checklist]; store temperature kept [Log]',
      'Dress, mask, sanitiser [Checklist, spot check]']],
    ['Financial control', [
      'Discounts and prices below list judged in the weekly review [System]',
      'Price check at invoice completion; payables not overdue [System]',
      'Expiry and dead-stock value kept low [System, Financial dashboard]',
      'Cash short or excess; cash checked for stains, tears and authenticity [System, Rated]',
      '—',
      '—',
      '—',
      '—']],
  ];
  const ws = sheet('Matrix', [22, ...areas.map(() => 34)], ['', ...areas], rows.map(([d, cells]) => [d, ...cells]));
  ws.getColumn(1).font = { bold: true };
  ws.eachRow((row, i) => { if (i > 1) row.eachCell((c, col) => { if (col > 1 && /GATE/.test(String(c.value))) c.fill = GATE; if (col > 1 && /new measure/.test(String(c.value))) c.fill = NEW; }); });
}

// ------------------------------------------------------------------------------------------------ owner's list mapped
{
  type L = [string, string, string, string, string, string, string, string];
  const rows: L[] = [
    ['Keep shop floor clear of debris, clean daily morning and evening', 'Cleanliness and safety', 'Store upkeep', 'Checklist', 'Shift checklist ticked, 95% or more', 'Rated: Cleanliness, hygiene, dress and safety', 'Store Head: Cleanliness of the store', 'Shift checklists exist; the rating uses them'],
    ['Clean glass surfaces (counter, door handles, billing machine) thrice with sanitiser', 'Cleanliness and safety', 'Store upkeep', 'Checklist', 'Three ticks a day', 'Rated: Cleanliness, hygiene, dress and safety', 'Store Head: Cleanliness of the store', 'Add the three ticks to the shift checklist'],
    ['Clean glass door, shelves and desk once a week', 'Cleanliness and safety', 'Store upkeep', 'Checklist', 'Weekly tick', 'Rated: Cleanliness, hygiene, dress and safety', 'Store Head: Cleanliness of the store', 'Weekly checklist item'],
    ['Keep the products in their designated place', 'Accuracy', 'Stock and expiry', 'Rated, shelf check', 'Sampled check, 95% in the right place', 'Rated: Shelf order and expiry-first billing', 'Store Head: Stock planning', 'Rated until a shelf-check form exists'],
    ['Maintain store temperature using AC', 'Cleanliness and safety / Compliance', 'Stock and expiry', 'Log', 'Reading logged twice a day, 100%', '—', 'Store Head: Cleanliness of the store (rated)', 'GAP: temperature log not built'],
    ['Attend customer phone calls; return missed calls at the earliest', 'Timeliness', 'Customer', 'Rated', 'Returned within 2 hours', 'Rated: Counselling and honest advice', 'Store Head: Staff guidance', 'GAP: no call log'],
    ['Check purchased product quality; report and return to vendor immediately', 'Compliance', 'Buy and receive', 'Rated', 'Issues raised on the day of receipt, 100%', '—', 'Store Head: Purchase and receiving (rated)', 'Vendor issues exist; per-person measure to build'],
    ['Check customer-returned product for valid return window and damage', 'Compliance', 'Sale and returns', 'System', 'Returns outside the window, none', 'Enforced by the return rules', 'Store Head: grievances and review', 'Rules enforce it; no per-person measure'],
    ['Check cash received for stains, tears, authenticity', 'Financial control', 'Cash and shift', 'Rated', 'Counterfeit incidents, none', 'Points: Cash short or excess; Gate: cash within Rs 1,000', 'Store Head: Cash short or excess', 'Covered by cash variance'],
    ['Capture most customer data with near accuracy', 'Accuracy', 'Customer', 'System', 'Bills with a named customer, 90% target, 60% floor', 'Points 20 (Sales Staff), 15 (Pharmacist)', '—', 'BUILT: Bills with a named customer'],
    ['Capture most product data with 100% accuracy', 'Accuracy', 'Stock and expiry', 'System', 'Products with all required fields, 100%', '—', 'Business Head scorecard', 'GAP: product-data completeness per person'],
    ['Receive latest (under 6 months) prescription for scheduled drugs', 'Compliance', 'Prescriptions and registers', 'Gate', 'Every scheduled sale has a valid prescription', 'GATE: scheduled drugs with prescription details', 'GATE (Store Head and Pharmacist sets)', 'Manual gate now; GAP to measure'],
    ['Capture patient and prescriber data for scheduled drugs', 'Compliance', 'Prescriptions and registers', 'Gate', 'Every scheduled sale has patient and prescriber', 'GATE: scheduled drugs with prescription details', 'Pharmacist: Prescription checking and register accuracy (25)', 'Manual gate now; GAP to measure'],
    ['File all invoices with the right GRN and reference number', 'Accuracy', 'Buy and receive', 'Rated', 'GRN and reference on every invoice', '—', 'Store Head: Purchase and receiving', 'GAP: GRN completeness measure'],
    ['Plan purchase for least expiry value', 'Accuracy', 'Stock and expiry', 'System', 'Value expiring within 90 days under 5% of stock', '—', 'Store Head: Expiry and near-expiry control (15)', 'Stock cards and findings exist; per-store'],
    ['Handle customer order commitments from order to closure', 'Timeliness', 'Customer', 'System', 'Orders delivered by the promised date, 95%', '—', 'Store Head: Late or open inquiries', 'Commitments module exists; no measure'],
    ['Deliver orders personally to customer with system entry', 'Accuracy', 'Customer', 'System', 'Deliveries with a system entry, 100%', '—', '—', 'GAP: delivery measure'],
    ['Deliver orders via third party with system entry', 'Accuracy', 'Customer', 'System', 'Deliveries with a system entry, 100%', '—', '—', 'GAP: delivery measure'],
    ['Clear expiry off the shelf and dispose with out-pass', 'Timeliness', 'Stock and expiry', 'System', 'Expired value on shelf nil; cleared within 7 days', 'GATE: no expired medicine sold', 'GATE (Store Head): no expired stock on the shelf', 'Out-pass exists; GAP: expired on shelf per store'],
    ['Billing low expiry first', 'Compliance', 'Stock and expiry', 'System', 'Sales from a later-expiring batch while an earlier one is in stock, near zero', 'Rated: Shelf order and expiry-first billing (10)', '—', 'GAP: batch-order measure'],
    ['Latest prescription received and updated in the system', 'Compliance', 'Prescriptions and registers', 'Gate', 'As the first prescription item', 'GATE', 'GATE', 'Same as above'],
    ['Sale with prescription detail for scheduled drugs', 'Compliance', 'Prescriptions and registers', 'Gate', 'Every scheduled sale', 'GATE', 'GATE', 'Same as above'],
    ['Schedule drug record', 'Compliance', 'Prescriptions and registers', 'Gate', 'Register entries equal scheduled sales', 'GATE', 'Pharmacist: register accuracy', 'Online register exists; reconcile measure to build'],
    ['Wear appropriate dress', 'Cleanliness and safety', 'People', 'Checklist', 'Spot check, pass or fail', 'Rated: Cleanliness, hygiene, dress and safety', 'Store Head: Cleanliness of the store', 'Observation'],
    ['Wear face mask when dealing with customers', 'Cleanliness and safety', 'People', 'Checklist', 'Spot check, pass or fail', 'Rated: Cleanliness, hygiene, dress and safety', 'Store Head: Cleanliness of the store', 'Observation'],
    ['Sanitise hands as and when required', 'Cleanliness and safety', 'People', 'Checklist', 'Spot check, pass or fail', 'Rated: Cleanliness, hygiene, dress and safety', 'Store Head: Cleanliness of the store', 'Observation'],
    ['Report any device failure immediately to the manager', 'Timeliness', 'Store upkeep', 'Rated', 'Reported the same day', '—', 'Store Head: Cleanliness and safety of the store', 'Observation'],
    ['Display OTC products in the showcase for maximum exposure', 'Service', 'Store upkeep', 'Rated', 'Planogram followed, spot check', 'Rated: Shelf order and expiry-first billing', '—', 'Observation'],
    ['Organise and store products at the right location (refrigerate as needed)', 'Accuracy', 'Stock and expiry', 'Rated', 'Sampled check, 95% right; cold items in the fridge', 'Rated: Shelf order and expiry-first billing', 'Store Head: Expiry and near-expiry control', 'Temperature log is a GAP'],
  ];
  sheet('Your list mapped', [48, 20, 20, 14, 38, 38, 36, 36],
    ['Your item', 'Matrix row', 'Process area', 'Checked by', 'Indicator and target', 'On Sales Staff and Pharmacist', 'On Store Head', 'Status in the app'], rows,
    { fill: (r) => (/^GATE/.test(String(r[5])) || String(r[3]) === 'Gate' ? GATE : /BUILT/.test(String(r[7])) ? NEW : null) });
}

// ------------------------------------------------------------------------------------------------ system suggestions mapped
{
  const rows: string[][] = [
    ['Expiry and register accuracy', 'Rated', 'Split', 'Expiry goes to the Store Head (Expiry and near-expiry control, 15). Register accuracy goes to the Pharmacist (Prescription checking and register accuracy, 25), with the gate.', 'Two different things: one is stock, one is the drug register.'],
    ['Expiry check and no expired medicine', 'Rated', 'Make a gate', 'Gate in all three sets: no expired or recalled medicine sold (Store Head: none left on the shelf).', 'A legal failure, so no points: it removes the incentive.'],
    ['Prescription checking and controlled-drug rules', 'Rated', 'Make a gate and keep points', 'Gate: scheduled drugs sold with prescription details and register entry. Pharmacist points 25.', 'Measure it from the system next (see Gaps).'],
    ['Counselling and customer care', 'Rated', 'Keep, rated', 'Sales Staff 10, Pharmacist 20 (Counselling and honest advice).', 'Rated 1 to 5 against the description; low weight.'],
    ['Honest advice on substitutes and extras', 'Rated', 'Merge', 'Merged into Counselling and honest advice.', 'Duplicate of the line above.'],
    ['Licence, registers and prescription rules', 'Rated', 'Make a gate', 'Store Head gate: licences valid, registers complete, scheduled-drug rules followed. Business Head scorecard.', 'Confirmed by the Business Head from the compliance register.'],
    ['Discarded bills', 'System', 'Keep', 'Sales Staff 10, Pharmacist 5.', 'Judge the reasons, not only the count: discarding a wrong bill is correct.'],
    ['Honest advice and staff guidance', 'Rated', 'Keep for the Store Head', 'Store Head: Staff guidance and supervision (10).', 'The staff-guidance half; the advice half is under Counselling.'],
    ['Cash accuracy', 'Rated', 'Merge', 'Merged into Cash short or excess.', 'Same thing; the system measures it.'],
    ['Cash short or excess', 'System', 'Keep, and add a gate', 'Points: Sales Staff 15, Pharmacist 5, Store Head 5. Gate for Sales Staff: within Rs 1,000 in the month.', 'The limit and steps are starting values: set them from the History.'],
    ['Stock planning and expiry control', 'Rated', 'Split', 'Store Head: Expiry and near-expiry control (15) and Stock planning and out-of-stock follow-up (10).', 'Two different skills and checks.'],
    ['Out-of-stock requests and refill reminders recorded', 'Rated', 'Keep, measure later', 'Store Head: part of Stock planning and out-of-stock follow-up.', 'The app records product requests and refill follow-ups; a measure can read them.'],
    ['Customer grievances', 'System', 'Keep', 'Sales Staff 10, Pharmacist 10, Store Head 5.', ''],
    ['Customer inquiries closed', 'System', 'Keep for the Store Head', 'Store Head 5.', 'Inquiries are assigned to the Store Head, not the counter.'],
    ['Late or open customer inquiries', 'System', 'Keep for the Store Head', 'Store Head 10.', 'Pairs with the line above: late counts more than closed.'],
    ['Useful extra products added', 'System', 'Keep, low weight', 'Sales Staff 5.', 'Counterweight: grievances and discarded bills are scored beside it, so pushing is not rewarded.'],
    ['Cleanliness, hygiene and safety', 'Rated', 'Keep, from the checklist', 'Sales Staff 10, Pharmacist 5, Store Head 10.', 'Score it from the shift checklist and a spot check.'],
    ['Absent days', 'System', 'Keep, not for the weekend pharmacist', 'Sales Staff 10, Store Head 5.', 'A weekend-only pharmacist has no weekday attendance to judge.'],
    ['Stock audits not late', 'System', 'Drop', 'Covered by Late or overdue stock audits.', 'The same figure turned over.'],
    ['Stock audits completed', 'System', 'Keep for the Store Head', 'Store Head 5.', ''],
    ['Late or overdue stock audits', 'System', 'Keep for the Store Head', 'Store Head 15.', 'The audit is the control that catches expiry and register problems.'],
  ];
  sheet('System suggestions', [46, 12, 26, 70, 60], ['Suggested measure', 'Type in the app', 'Verdict', 'Where it lands', 'Why'], rows,
    { fill: (r) => (r[2].startsWith('Make a gate') ? GATE : r[2] === 'Drop' || r[2] === 'Merge' ? BAND : null) });
}

// ------------------------------------------------------------------------------------------------ one sheet per position
const sourceText = (m: TemplateMetric) => (m.source === 'SYSTEM' ? 'System' : m.gate ? 'Manager confirms' : 'Rated by manager');
const ruleText = (m: TemplateMetric) => {
  const r = m.rule;
  if (!r) return m.gate ? 'Met or not met' : 'Rated 1 to 5; 5 earns all the points';
  if (r.kind === 'gate') return `Met when the figure is within ${r.limit}`;
  if (r.kind === 'linear') return `Full points at ${r.target}, none at ${r.floor}, in proportion between`;
  return r.steps.map((s: any) => `up to ${s.upto}: ${s.pct}%`).join('; ') + `; beyond: ${r.otherwise}%`;
};
const ratedBy = (position: string, m: TemplateMetric) => (m.source === 'SYSTEM' ? 'System' : position === 'Store Head' ? 'Business Head' : 'Store Head');
const NEEDS: Record<string, string> = {
  'Gate: no expired or recalled medicine sold': 'System gate once expired-batch-sold is measured',
  'Gate: scheduled drugs sold with prescription details and register entry': 'System gate once prescription capture is measured',
  'Gate: no expired stock left on the shelf': 'System gate once expired value on shelf is measured',
  'Prescription checking and register accuracy': 'System once prescription capture and register match are measured',
};
for (const t of KPI_TEMPLATES) {
  const rows: any[][] = t.metrics.map((m) => [
    m.gate ? 'GATE' : 'Points', m.name, m.description, sourceText(m), m.gate ? 'No points' : m.max, ruleText(m), m.min_activity ? `${m.min_activity}` : '', ratedBy(t.position, m),
    m.system_key === 'CUSTOMER_CAPTURE' ? 'Built now' : m.source === 'SYSTEM' ? 'In the app' : NEEDS[m.name] || 'Rated in the app',
  ]);
  const totals = templateTotals(t);
  rows.push(['', 'Total points', t.summary, '', totals.points, `${totals.system} of the points are measured by the system; ${totals.gates} gates`, '', '', '']);
  const ws = sheet(t.position, [10, 40, 62, 18, 11, 52, 16, 16, 40], ['Type', 'KPI', 'What it measures', 'Source', 'Points', 'Target, limit or steps', 'Judged after (bills, shifts)', 'Rated by', 'Status'], rows,
    { fill: (r) => (r[0] === 'GATE' ? GATE : r[8] === 'Built now' ? NEW : null) });
  ws.lastRow!.font = { bold: true };
}

// ------------------------------------------------------------------------------------------------ business head
{
  const rows: string[][] = [
    ['Gate', 'Licences and registrations valid; registers complete', 'Compliance register and alerts', 'All valid, none expired', 'Any lapse is a critical finding: act now'],
    ['Gate', 'Scheduled-drug rules followed across stores', 'Drug register check, Store Head gates', 'No store reports a failed gate', 'Review any Store Head gate not met'],
    ['Health', 'Health status and score', 'Dashboard > Health findings', 'Healthy or Watch; no critical', 'Any critical forces Act now'],
    ['Compliance', 'GST returns filed on time', 'Alerts and GST filing', 'Every return filed by its due date', ''],
    ['Financial control', 'Payables overdue', 'Payables and the invoice list', 'Overdue under 10% of payables', 'Count at invoice total'],
    ['Financial control', 'Running cost against its usual share of sales', 'Financial dashboard > costs as a share of sales', 'Each group inside its usual band', 'Above usual is flagged'],
    ['Financial control', 'Cash difference across stores', 'Cash and shift reports, Health findings', 'Within the limit; every shift closed with a reason', ''],
    ['Accuracy', 'Bills with a named customer, all stores', 'New measure by person; store roll-up later', '90% or more', 'Feeds refill reminders and offers'],
    ['Stock', 'Expired and expiring value, dead stock', 'Financial dashboard > Stock on the shelf', 'Expired nil; expiring 30 days near nil; dead under 10%', ''],
    ['Timeliness', 'Stock audits on time, all stores', 'Stock audits', 'None overdue', ''],
    ['People', 'Staff KPI finalised for the month', 'HR > KPI', 'Finalised by the 5th', 'Gates not met reviewed with the person'],
    ['Records', 'Records attested; backup taken', 'Finance > Records', 'Every month attested', 'Backup status is not recorded yet'],
  ];
  sheet('Business Head', [16, 52, 44, 42, 44], ['Type', 'Scorecard item', 'Where to see it in the app', 'Target', 'Note'], rows, { fill: (r) => (r[0] === 'Gate' ? GATE : null) });
}

// ------------------------------------------------------------------------------------------------ gaps
{
  const rows: string[][] = [
    ['Bills with a named customer', 'Built now', 'Sales Staff 20, Pharmacist 15', '—'],
    ['Scheduled-drug sales with prescription details captured', 'Not built', 'Gate (Sales Staff, Pharmacist, Store Head); Pharmacist 25 points', 'Turns the manual gate and the rating into figures'],
    ['Expired batches sold (should be none)', 'Not built', 'Gate: no expired or recalled medicine sold', 'Also a counter block at billing'],
    ['Expired value on the shelf', 'Not built', 'Gate (Store Head); Expiry and near-expiry control', 'Stock card shows the total, not per person'],
    ['Near-expiry actioned within 7 days', 'Not built', 'Store Head: Expiry and near-expiry control', 'From the out-pass and vendor take-back records'],
    ['GRN and reference complete on every invoice; entered within 2 days', 'Not built', 'Store Head: Purchase and receiving', 'From the invoice list'],
    ['Deliveries on the promised date, with a system entry', 'Not built', 'Store Head: Late or open inquiries', 'From the delivery module'],
    ['Product requests logged and refill follow-ups done', 'Not built', 'Store Head: Stock planning and out-of-stock follow-up', 'Both are recorded; the measure reads them'],
    ['Shift checklist completion per person', 'Not built', 'Cleanliness, hygiene and safety (all sets)', 'Checklists exist; a measure counts ticks'],
    ['Temperature log, twice a day', 'Not built', 'Store Head; cold items', 'New record, then a measure'],
    ['Call-back log for missed calls', 'Not built', 'Counselling and customer care', 'Needs a phone log; keep rated'],
    ['Product data complete when created', 'Not built', 'Business Head scorecard', 'From the product master'],
    ['Backup taken and verified', 'Not built', 'Business Head scorecard', 'No record is kept yet'],
  ];
  sheet('Gaps to build', [58, 14, 52, 50], ['Measure', 'State', 'Replaces or feeds', 'Note'], rows, { fill: (r) => (r[1] === 'Built now' ? NEW : null) });
}

wb.xlsx.writeFile(OUT).then(() => console.log('written', OUT));
