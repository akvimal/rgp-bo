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
/** a description staff can read at a glance: one lead line, then bullet points, then (optionally) who confirms or rates it. The box allows 500 characters. */
const bullets = (lead: string, items: string[], tail?: string) => [lead, ...items.map((i) => '• ' + i), ...(tail ? [tail] : [])].join('\n');

/** Each measure is described once and means one thing: gates are legal or safety duties, points are quality; the same duty never appears as both. */
const EXPIRED_GATES: TemplateMetric[] = [
  manualGate('Gate: no expired medicine sold to a customer', bullets('Pass only if all of these hold for the month:', [
    'The monthly expiry check found no expired medicine on the shelves you handle',
    'No customer complained of getting an expired medicine',
    'Every medicine billed was still in date on the day of sale',
  ], 'Confirmed pass or fail by the manager from the expiry check and the complaints list.')),
  manualGate('Gate: no recalled or banned medicine sold', bullets('Pass only if all of these hold for the month:', [
    'Every recall or stop-sale notice was acted on the same day: the batch was pulled off the shelf and set aside',
    'No sale of a recalled batch appears after the notice date',
    'No customer complaint about a recalled medicine',
  ], 'Confirmed pass or fail by the manager from the recall notices and the complaints list.')),
];
/** scored, not a gate: a regular customer may not bring the latest prescription and some will not bring one, so one such sale must not wipe out the month's incentive */
const SCHEDULED_RATED = (max: number): TemplateMetric => rated('Prescription details on scheduled-drug sales', bullets('How completely each scheduled-drug (H, H1, X) sale is documented. Scored in proportion, not pass or fail, because a customer sometimes cannot bring a prescription:', [
  'Prescription details noted, with the doctor',
  'Patient name and address recorded',
  'Register entry made for the sale',
], 'Rated by the manager from the drug register check.'), max);

const CASH_MEASURE = (max: number): TemplateMetric => ({ name: 'Cash short or excess', description: bullets('Total cash difference on the shifts you closed in the month (short and excess both count). Small differences cost a few points:', [
  'Up to Rs 50: full points',
  'Up to Rs 200: 60% of the points',
  'Up to Rs 500: 30% of the points',
  'Above Rs 500: no points',
]), max, source: 'SYSTEM', system_key: 'CASH_VARIANCE', rule: steps([[50, 100], [200, 60], [500, 30]]), min_activity: 1 });
const GRIEVANCES = (max: number): TemplateMetric => ({ name: 'Grievances about them', description: bullets('Customer grievances raised about you in the month:', [
  'None: full points',
  'One: half the points',
  'Two or more: no points',
]), max, source: 'SYSTEM', system_key: 'GRIEVANCES', rule: steps([[0, 100], [1, 50]]) });
const CAPTURE = (max: number, minBills: number): TemplateMetric => ({ name: 'Bills with a named customer', description: bullets('Share of your bills that carry a named customer. Capture the mobile number, or the name and location:', [
  'Full points at 90% of bills or more',
  'No points at 60% or less; in between earns part of the points',
  `Judged only after ${minBills} bills in the month`,
]), max, source: 'SYSTEM', system_key: 'CUSTOMER_CAPTURE', rule: linear(90, 60), min_activity: minBills });

const DELIVERY_PROCESS = (max: number): TemplateMetric => ({ name: 'Home deliveries completed', description: bullets('Bills you made for home delivery must go through delivery, not stop at the sale:', [
  'Mark the bill as a delivery and book the delivery when you bill',
  'The delivery must be recorded as delivered (or confirmed by the customer)',
  'Full points at 95% of deliveries completed or more; none at 70% or less',
  'Today\'s bills are not counted; judged only after 3 home deliveries in the month',
]), max, source: 'SYSTEM', system_key: 'DELIVERY_PROCESS', rule: linear(95, 70), min_activity: 3 });
const PURCHASE_PROCESS = (max: number): TemplateMetric => ({ name: 'Purchases made through an order', description: bullets('Buying must follow the steps: purchase request, then purchase order, then the purchase invoice:', [
  'Every invoice is received against an approved purchase order raised from the request',
  'A line that was not on the order counts the whole invoice as outside the process',
  'Full points at 95% of invoices through an order or more; none at 70% or less',
  'Judged only after 3 invoices in the month',
]), max, source: 'SYSTEM', system_key: 'PURCHASE_PROCESS', rule: linear(95, 70), min_activity: 3 });

export const KPI_TEMPLATES: PositionTemplate[] = [
  {
    position: 'Sales Staff',
    loginRole: 'Sales Staff',
    summary: 'Billing, customer data, cash, courtesy and tidiness at the counter.',
    metrics: [
      ...EXPIRED_GATES,
      { name: 'Gate: cash difference within the limit', description: bullets('Pass only if the cash difference stays small for the month:', [
        'Add up the short and excess on every shift you closed',
        'The total must be within Rs 1,000',
        'A bigger difference means no incentive this month, whatever the points',
      ]), max: 0, source: 'SYSTEM', system_key: 'CASH_VARIANCE', rule: gateLimit(1000), min_activity: 1, gate: true },
      CAPTURE(15, 30),
      DELIVERY_PROCESS(10),
      CASH_MEASURE(10),
      { name: 'Discarded bills', description: bullets('Pending bills you discarded instead of completing:', [
        'Up to 2: full points',
        'Up to 5: 60% of the points',
        'Up to 10: 30% of the points',
        'More than 10: no points',
        'Judged only after 30 bills in the month',
      ]), max: 10, source: 'SYSTEM', system_key: 'DISCARDED_BILLS', rule: steps([[2, 100], [5, 60], [10, 30]]), min_activity: 30 },
      GRIEVANCES(10),
      { name: 'Absent days', description: bullets('Days marked absent in the attendance record:', [
        'No absent day: full points',
        'One day: 60% of the points',
        'Two days: 30% of the points',
        'Three or more: no points',
      ]), max: 10, source: 'SYSTEM', system_key: 'ABSENT_DAYS', rule: steps([[0, 100], [1, 60], [2, 30]]) },
      { name: 'Cross-sell suggestions taken', description: bullets('Suggestions shown at the counter that you added to a bill:', [
        'Full points at 15 or more in the month; part points below that',
        'Counted together with grievances and discarded bills, so helpful advice earns and pushing does not',
        'Judged only after 20 bills in the month',
      ]), max: 5, source: 'SYSTEM', system_key: 'SUGGESTIONS_ADDED', rule: linear(15, 0), min_activity: 20 },
      SCHEDULED_RATED(10),
      rated('Counselling and honest advice', bullets('How well you guide the customer on the medicine:', [
        'Asks who it is for and about any allergy',
        'Explains how and when to take it and how to store it',
        'Checks the customer understood',
      ], 'Rated by the manager from observation and feedback.'), 10),
      rated('Cleanliness, hygiene, dress and safety', bullets('Counter area kept clean and safe:', [
        'Counter, glass and billing desk wiped and tidy',
        'Mask and sanitiser used',
        'Dress neat and appropriate',
      ], 'Rated from the shift checklist and spot checks.'), 5),
      rated('Shelf order and expiry-first billing', bullets('Your shelves in order and stock billed in the right sequence:', [
        'Products at their place, labels facing front',
        'Earliest expiry billed first',
        'Shelf refilled from the back stock, oldest first',
      ], 'Rated from a shelf check.'), 5),
    ],
  },
  {
    position: 'Pharmacist',
    loginRole: 'Sales Staff',
    summary: 'Weekend pharmacist: prescriptions and registers, counselling, expiry, with fewer bills so figures are judged on a lower minimum.',
    metrics: [
      ...EXPIRED_GATES,
      manualGate('Gate: registered pharmacist present for the assigned hours', bullets('Pass only if:', [
        'You were at the store for every weekend hour assigned',
        'Your arrival and leaving times match the attendance record',
      ], 'Confirmed pass or fail by the Store Head.')),
      rated('Prescription checking and register accuracy', bullets('Your checking of prescriptions and the register:', [
        'Each prescription checked for validity, dose and doctor details before dispensing',
        'Controlled and scheduled drugs entered correctly in the register',
        'Register quantities match the sales in the system',
      ], 'Rated by the manager from the drug register check, until the system measures it.'), 25),
      rated('Counselling and honest advice on substitutes', bullets('The clinical advice you give:', [
        'Explains dose, side effects and interactions',
        'Offers the same-composition substitute honestly, with the price difference',
        'Sends the customer to a doctor when needed',
      ], 'Rated by the manager.'), 20),
      rated('Expiry check of the shelves', bullets('The weekend expiry check:', [
        'Done on every shelf and in the fridge',
        'Medicines expiring within 3 months separated',
        'Findings reported to the Store Head',
      ], 'Rated by the manager.'), 15),
      CAPTURE(15, 10),
      GRIEVANCES(10),
      { name: 'Discarded bills', description: bullets('Pending bills you discarded instead of completing:', [
        'Up to 1: full points',
        'Up to 3: 60% of the points',
        'Up to 6: 30% of the points',
        'More than 6: no points',
        'Judged only after 10 bills in the month',
      ]), max: 5, source: 'SYSTEM', system_key: 'DISCARDED_BILLS', rule: steps([[1, 100], [3, 60], [6, 30]]), min_activity: 10 },
      CASH_MEASURE(5),
      rated('Cleanliness, hygiene and safety', bullets('Dispensing area kept clean and safe:', [
        'Dispensing counter and trays cleaned between uses',
        'Mask and sanitiser used',
      ], 'Rated from the shift checklist and spot checks.'), 5),
    ],
  },
  {
    position: 'Store Head',
    loginRole: 'Store Head',
    summary: 'The store as a whole: audits on time, expiry and stock control, inquiries and complaints, cash, and a clean, compliant store.',
    metrics: [
      manualGate('Gate: all store licences are valid and displayed', bullets('Pass only if all of these hold for the whole month:', [
        'Drug licence, GST registration and shop licence are in date (none expired)',
        'Renewals due next month are already applied for',
        'Licences and the registered pharmacist certificate are displayed in the store',
      ], 'Confirmed pass or fail by the Business Head from the compliance register.')),
      manualGate('Gate: store registers are complete and up to date', bullets('Pass only if all of these hold for the month:', [
        'Drug, stock and expiry registers and the cash book are written every day, with no blank days or missing pages',
        'Entries match the bills and the stock in the system',
        'Entries are signed or initialled by the person who made them',
      ], 'Confirmed pass or fail by the Business Head from the compliance register.')),
      manualGate('Gate: scheduled-drug rules are followed', bullets('Pass only if all of these hold for the month:', [
        'Schedule H, H1 and X medicines are sold only against a valid prescription',
        'Each such sale has the patient, doctor and prescription details on record',
        'The stock of scheduled drugs matches the register on a spot count',
      ], 'Confirmed pass or fail by the Business Head from the drug register check.')),
      manualGate('Gate: no expired stock left on the shelf', bullets('Pass only if:', [
        'The monthly expiry check found no expired stock on any shelf, in the fridge or on the counter display',
        'Expired stock found was removed from sale the same day',
      ], 'Confirmed pass or fail by the Business Head.')),
      { name: 'Late or overdue stock audits', description: bullets('Stock audits assigned to you:', [
        'None finished late or overdue: full points',
        'One late or overdue: half the points',
        'Two or more: no points',
        'Judged only if an audit was due',
      ]), max: 15, source: 'SYSTEM', system_key: 'AUDITS_LATE', rule: steps([[0, 100], [1, 50]]), min_activity: 1 },
      { name: 'Stock audits completed', description: bullets('Routine stock audits you completed in the month:', [
        'One or more completed: full points',
        'None: no points',
      ]), max: 5, source: 'SYSTEM', system_key: 'AUDITS_DONE', rule: linear(1, 0) },
      { name: 'Late or open inquiries', description: bullets('Customer inquiries assigned to you, judged on timing:', [
        'None closed late or left open past the due date: full points',
        'One or two: half the points',
        'Three or more: no points',
        'Judged only if an inquiry was assigned',
      ]), max: 10, source: 'SYSTEM', system_key: 'INQUIRIES_LATE', rule: steps([[0, 100], [2, 50]]), min_activity: 1 },
      { name: 'Customer inquiries closed', description: bullets('Customer inquiries you closed in the month, judged on how many:', [
        'Full points at 5 or more closed; part points below that',
        'Judged only if an inquiry was assigned',
      ]), max: 5, source: 'SYSTEM', system_key: 'INQUIRIES_CLOSED', rule: linear(5, 0), min_activity: 1 },
      GRIEVANCES(5),
      CASH_MEASURE(5),
      { name: 'Absent days', description: bullets('Days marked absent in the attendance record:', [
        'No absent day: full points',
        'One day: 60% of the points',
        'Two days: 30% of the points',
        'Three or more: no points',
      ]), max: 5, source: 'SYSTEM', system_key: 'ABSENT_DAYS', rule: steps([[0, 100], [1, 60], [2, 30]]) },
      rated('Expiry and near-expiry control', bullets('How early you deal with stock nearing expiry:', [
        'Short-dated stock planned for sale, vendor return or an out-pass before it expires',
        'The value of expired stock kept at nil',
      ], 'Rated by the manager from the expiry list.'), 10),
      rated('Stock planning and out-of-stock follow-up', bullets('Keeping the shelves supplied:', [
        'Fast movers kept in stock',
        'Out-of-stock requests recorded and followed up',
        'Refill reminders acted on',
      ], 'Rated by the manager.'), 10),
      rated('Cleanliness, hygiene and safety of the store', bullets('The whole store kept clean, safe and working:', [
        'Shift checklists done every shift',
        'Store clean and the temperature kept in range',
        'Failed devices reported at once',
      ], 'Rated from the checklists and a visit.'), 10),
      rated('Staff guidance and supervision', bullets('How you guide and run the team:', [
        'Coaches staff on honest advice and the rules',
        'Duty roster kept and shifts handed over properly',
      ]), 5),
      PURCHASE_PROCESS(10),
      rated('Purchase and receiving', bullets('Care taken when goods are bought and received:', [
        'Invoices filed with the right GRN and reference',
        'Quality checked on receipt',
        'Vendor returns raised for faulty or short goods',
      ], 'Rated by the manager.'), 5),
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
