/**
 * Starter KPI sets for a pharmacy, one per job role (docs/planning/KPI_MATRIX.md). Pure data: the Business Head previews and loads them from HR > Setup > KPI.
 *
 * How a set works:
 *  - Gates carry no points. A gate not met means no incentive that month, whatever the points: for legal and safety duties. A gate is either a figure
 *    against a limit (system) or pass or fail confirmed by the manager (manual, until the system can measure it).
 *  - Points add up to 100. About 60% are measured by the system, the rest by a checklist or a rating by the manager.
 *  - Targets and limits are starting values. Set them from what really happens (the History button on the measure shows the last months).
 *  - Incentive bands are not set here: the existing band set applies, and the pay is the owner's decision.
 */
export interface TemplateMetric {
  name: string;
  description: string;
  /** points (0 for a gate) */
  max: number;
  source: 'SYSTEM' | 'MANUAL';
  system_key?: string;
  rule?: any;
  /** fewest bills, shifts or audits before the figure is judged; below it the measure drops out */
  min_activity?: number;
  rating_scale?: number;
  gate?: boolean;
}
export interface PositionTemplate {
  /** the job role's name, matched to an existing one (any capitals) or created */
  position: string;
  loginRole: string | null;
  summary: string;
  metrics: TemplateMetric[];
}

const steps = (steps: [number, number][], otherwise = 0) => ({ kind: 'steps', steps: steps.map(([upto, pct]) => ({ upto, pct })), otherwise });
const linear = (target: number, floor: number) => ({ kind: 'linear', target, floor });
const gateLimit = (limit: number) => ({ kind: 'gate', limit });

const manualGate = (name: string, description: string): TemplateMetric => ({ name, description, max: 0, source: 'MANUAL', rating_scale: 2, gate: true });
const rated = (name: string, description: string, max: number): TemplateMetric => ({ name, description, max, source: 'MANUAL', rating_scale: 5 });

const EXPIRED_GATE = manualGate('Gate: no expired or recalled medicine sold', 'Met when the monthly expiry check and customer complaints show no expired or recalled medicine sold. Confirmed pass or fail by the manager.');
const SCHEDULED_GATE = manualGate('Gate: scheduled drugs sold with prescription details and register entry', 'Met when every scheduled drug sold has the prescription, patient and prescriber details and its register entry. Confirmed pass or fail by the manager from the drug register check.');

export const KPI_TEMPLATES: PositionTemplate[] = [
  {
    position: 'Sales Staff',
    loginRole: 'Sales Staff',
    summary: 'Billing, customer data, cash, courtesy and tidiness at the counter.',
    metrics: [
      EXPIRED_GATE,
      SCHEDULED_GATE,
      { name: 'Gate: cash difference within the limit', description: 'Met when the shifts the person closed are within Rs 1,000 short or excess in all for the month.', max: 0, source: 'SYSTEM', system_key: 'CASH_VARIANCE', rule: gateLimit(1000), min_activity: 1, gate: true },
      { name: 'Bills with a named customer', description: 'Share of the bills made that carry a named customer. Capture the mobile, or the name and location.', max: 20, source: 'SYSTEM', system_key: 'CUSTOMER_CAPTURE', rule: linear(90, 60), min_activity: 30 },
      { name: 'Cash short or excess', description: 'Total difference on the shifts the person closed.', max: 15, source: 'SYSTEM', system_key: 'CASH_VARIANCE', rule: steps([[50, 100], [200, 60], [500, 30]]), min_activity: 1 },
      { name: 'Discarded bills', description: 'Pending bills the person discarded.', max: 10, source: 'SYSTEM', system_key: 'DISCARDED_BILLS', rule: steps([[2, 100], [5, 60], [10, 30]]), min_activity: 30 },
      { name: 'Grievances about them', description: 'Customer grievances raised about the person.', max: 10, source: 'SYSTEM', system_key: 'GRIEVANCES', rule: steps([[0, 100], [1, 50]]) },
      { name: 'Absent days', description: 'Days marked absent.', max: 10, source: 'SYSTEM', system_key: 'ABSENT_DAYS', rule: steps([[0, 100], [1, 60], [2, 30]]) },
      { name: 'Cross-sell suggestions taken', description: 'Suggestions shown at the counter that the person added to a bill. Counted with the grievance and discard figures, so useful advice is rewarded and pushing is not.', max: 5, source: 'SYSTEM', system_key: 'SUGGESTIONS_ADDED', rule: linear(15, 0), min_activity: 20 },
      rated('Counselling and honest advice', 'Explains how to take the medicine, offers a substitute honestly, suggests extras only when useful. Rated by the manager from observation and feedback.', 10),
      rated('Cleanliness, hygiene, dress and safety', 'Counter and glass kept clean, mask and sanitiser used, dress appropriate. Rated from the shift checklist and spot checks.', 10),
      rated('Shelf order and expiry-first billing', 'Products at their place, the earliest expiry billed first, short-dated stock reported. Rated from a shelf check.', 10),
    ],
  },
  {
    position: 'Pharmacist',
    loginRole: 'Sales Staff',
    summary: 'Weekend pharmacist: prescriptions and registers, counselling, expiry, with fewer bills so figures are judged on a lower minimum.',
    metrics: [
      EXPIRED_GATE,
      SCHEDULED_GATE,
      manualGate('Gate: registered pharmacist present for the assigned hours', 'Met when the pharmacist was present for the weekend hours assigned. Confirmed pass or fail by the Store Head.'),
      rated('Prescription checking and register accuracy', 'Prescriptions checked, controlled and scheduled drugs recorded correctly, register matches the sales. Rated from the drug register check until the system measures it.', 25),
      rated('Counselling and honest advice on substitutes', 'Counsels on use and side effects, offers the same-composition substitute honestly. Rated by the manager.', 20),
      rated('Expiry check of the shelves', 'Expiry check done on the weekend, short-dated stock separated and reported.', 15),
      { name: 'Bills with a named customer', description: 'Share of the bills made that carry a named customer.', max: 15, source: 'SYSTEM', system_key: 'CUSTOMER_CAPTURE', rule: linear(90, 60), min_activity: 10 },
      { name: 'Grievances about them', description: 'Customer grievances raised about the person.', max: 10, source: 'SYSTEM', system_key: 'GRIEVANCES', rule: steps([[0, 100], [1, 50]]) },
      { name: 'Discarded bills', description: 'Pending bills the person discarded.', max: 5, source: 'SYSTEM', system_key: 'DISCARDED_BILLS', rule: steps([[1, 100], [3, 60], [6, 30]]), min_activity: 10 },
      { name: 'Cash short or excess', description: 'Total difference on the shifts the person closed.', max: 5, source: 'SYSTEM', system_key: 'CASH_VARIANCE', rule: steps([[50, 100], [200, 60], [500, 30]]), min_activity: 1 },
      rated('Cleanliness, hygiene and safety', 'Dispensing area clean, mask and sanitiser used.', 5),
    ],
  },
  {
    position: 'Store Head',
    loginRole: 'Store Head',
    summary: 'The store as a whole: audits on time, expiry and stock control, inquiries and complaints, cash, and a clean, compliant store.',
    metrics: [
      manualGate('Gate: licences, registers and scheduled-drug rules in order', 'Met when the licences are valid, the registers are complete and the scheduled-drug rules were followed. Confirmed pass or fail by the Business Head from the compliance register.'),
      manualGate('Gate: no expired stock left on the shelf', 'Met when the monthly expiry check found no expired stock still on the shelf. Confirmed pass or fail by the Business Head.'),
      { name: 'Late or overdue stock audits', description: 'Stock audits assigned to the person that were finished late or are overdue.', max: 15, source: 'SYSTEM', system_key: 'AUDITS_LATE', rule: steps([[0, 100], [1, 50]]), min_activity: 1 },
      { name: 'Stock audits completed', description: 'Routine stock audits the person completed.', max: 5, source: 'SYSTEM', system_key: 'AUDITS_DONE', rule: linear(1, 0) },
      { name: 'Late or open inquiries', description: 'Customer inquiries assigned to the person closed late or still open past the due date.', max: 10, source: 'SYSTEM', system_key: 'INQUIRIES_LATE', rule: steps([[0, 100], [2, 50]]), min_activity: 1 },
      { name: 'Customer inquiries closed', description: 'Customer inquiries the person closed.', max: 5, source: 'SYSTEM', system_key: 'INQUIRIES_CLOSED', rule: linear(5, 0), min_activity: 1 },
      { name: 'Grievances about them', description: 'Customer grievances raised about the person.', max: 5, source: 'SYSTEM', system_key: 'GRIEVANCES', rule: steps([[0, 100], [1, 50]]) },
      { name: 'Cash short or excess', description: 'Total difference on the shifts the person closed.', max: 5, source: 'SYSTEM', system_key: 'CASH_VARIANCE', rule: steps([[50, 100], [200, 60], [500, 30]]), min_activity: 1 },
      { name: 'Absent days', description: 'Days marked absent.', max: 5, source: 'SYSTEM', system_key: 'ABSENT_DAYS', rule: steps([[0, 100], [1, 60], [2, 30]]) },
      rated('Expiry and near-expiry control', 'Short-dated stock planned, returned to the vendor or cleared with an out-pass before it expires; expired value kept at nil.', 15),
      rated('Stock planning and out-of-stock follow-up', 'Fast movers in stock, out-of-stock requests and refill reminders recorded and acted on.', 10),
      rated('Cleanliness, hygiene and safety of the store', 'Shift checklists done, store clean, temperature kept, devices reported when they fail. Rated from the checklists and a visit.', 10),
      rated('Staff guidance and supervision', 'Guides the team on honest advice and rules, rota kept, shifts handed over.', 10),
      rated('Purchase and receiving', 'Invoices filed with the right GRN and reference, quality checked on receipt, vendor returns raised.', 5),
    ],
  },
];

/** the Business Head is not scored here: nobody above can rate the owner, so the owner's review is the business scorecard (Health and the Financial dashboard) */
export const SCORECARD_ONLY = ['Business Head'];

export const templateTotals = (t: PositionTemplate) => ({
  points: t.metrics.reduce((n, m) => n + (m.gate ? 0 : m.max), 0),
  gates: t.metrics.filter((m) => m.gate).length,
  system: t.metrics.filter((m) => !m.gate && m.source === 'SYSTEM').reduce((n, m) => n + m.max, 0),
});
