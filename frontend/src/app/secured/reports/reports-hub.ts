/**
 * The Reports hub: every report and register the shop has, grouped by the question it answers, each one a card that opens the page where it lives.
 * Pure data and one filter, so it is unit tested without Angular. A card shows only when the person may open its page; a group with no card is absent.
 * `needs` is an action key checked instead of the page path (the three Reports pages share one path rule and are told apart by action).
 */
export interface HubCard { id: string; label: string; about: string; route: string; icon: string; needs?: string; }
export interface HubGroup { key: string; label: string; question: string; cards: HubCard[]; }
export interface HubAccess { canOpen: (url: string) => boolean; has: (action: string) => boolean; }

export const HUB: HubGroup[] = [
  { key: 'sales', label: 'Sales', question: 'What did we sell, and who sold it?', cards: [
    { id: 'rh-sales', label: 'Sales report', about: 'Every bill line for a period, with an Excel download for your accountant.', route: '/secure/reports/sales', icon: 'bi-table', needs: 'reports.sales' },
    { id: 'rh-ask', label: 'Ask the shop', about: 'Type a question in your own words, or press a ready report: top products, profit, who owes money.', route: '/secure/reports/ask', icon: 'bi-chat-dots', needs: 'reports.ask' },
    { id: 'rh-weekly', label: 'Weekly summary', about: 'Last week in a few lines: what went well, what to watch, what to do first.', route: '/secure/reports/weekly', icon: 'bi-calendar-week', needs: 'reports.margin' },
    { id: 'rh-sale-list', label: 'Sales list', about: 'Find any bill and open it.', route: '/secure/sales/list', icon: 'bi-receipt-cutoff' },
    { id: 'rh-staff-sales', label: 'Staff performance', about: 'Sales by person.', route: '/secure/quality/staff-sales', icon: 'bi-person-lines-fill' },
    { id: 'rh-returns', label: 'Sale returns', about: 'What came back, and why.', route: '/secure/sales/returns', icon: 'bi-arrow-counterclockwise' },
  ] },
  { key: 'customers', label: 'Customers and refills', question: 'Who is due, who is owed, who came back?', cards: [
    { id: 'rh-refills', label: 'Refills', about: 'Customers due to buy again, by medicine, with stock flags.', route: '/secure/quality/refills', icon: 'bi-telephone-outbound' },
    { id: 'rh-followups', label: 'My follow-ups', about: 'Calls to make, customers waiting to come back, and the turnaround scorecard.', route: '/secure/my-work', icon: 'bi-person-lines-fill' },
    { id: 'rh-dues', label: 'Customer dues', about: 'Who owes money and for how long.', route: '/secure/customers/cust/dues', icon: 'bi-cash-coin' },
    { id: 'rh-audiences', label: 'Customer groups', about: 'Lists such as lapsed or high value customers.', route: '/secure/customers/cust/audiences', icon: 'bi-people' },
    { id: 'rh-complaints', label: 'Complaints', about: 'Open and settled complaints.', route: '/secure/quality/grievances', icon: 'bi-exclamation-octagon' },
  ] },
  { key: 'stock', label: 'Stock', question: 'What do we hold, and what will not sell in time?', cards: [
    { id: 'rh-stock', label: 'Stock on hand', about: 'Products and batches with what is available.', route: '/secure/store/stock/products', icon: 'bi-box-seam' },
    { id: 'rh-expiry', label: 'Expiry', about: 'Batches that are expired or close to it.', route: '/secure/store/stock/expiry', icon: 'bi-hourglass-split' },
    { id: 'rh-audits', label: 'Stock audits', about: 'Counts, variances and certificates.', route: '/secure/stock-audits', icon: 'bi-clipboard-data' },
    { id: 'rh-drug-register', label: 'Drug register', about: 'Schedule H, H1 and X sales, with PDF and Excel.', route: '/secure/schedule-register', icon: 'bi-capsule' },
  ] },
  { key: 'buying', label: 'Purchasing', question: 'What did we buy, and what do we owe?', cards: [
    { id: 'rh-invoices', label: 'Purchase invoices', about: 'Invoices by stage, with the payment queue.', route: '/secure/purchases/invoices/list', icon: 'bi-bag-check' },
    { id: 'rh-payables', label: 'Payables by vendor', about: 'What is owed to each vendor.', route: '/secure/purchases/invoices/by-vendor', icon: 'bi-wallet2' },
    { id: 'rh-vendor-returns', label: 'Vendor returns', about: 'Goods sent back and credits.', route: '/secure/purchases/returns', icon: 'bi-arrow-return-left' },
    { id: 'rh-gst-recon', label: 'GST reconciliation', about: 'Purchases against the vendors’ filings.', route: '/secure/purchases/gst', icon: 'bi-receipt' },
  ] },
  { key: 'money', label: 'Money and tax', question: 'Where did the money go?', cards: [
    { id: 'rh-financials', label: 'Financial dashboard', about: 'Money in and out, by category.', route: '/secure/financials', icon: 'bi-graph-up' },
    { id: 'rh-expenses', label: 'Expenses', about: 'Expenses by category and who approved them.', route: '/secure/expenses', icon: 'bi-wallet2' },
    { id: 'rh-digital', label: 'Digital payments', about: 'Card and UPI takings checked against the statements.', route: '/secure/digital-payments', icon: 'bi-qr-code-scan' },
    { id: 'rh-cashbook', label: 'Cash book', about: 'Cash in and out of the shop.', route: '/secure/store/cash', icon: 'bi-cash-stack' },
    { id: 'rh-discrepancies', label: 'Cash and shifts', about: 'Shifts that did not tally.', route: '/secure/quality/discrepancies', icon: 'bi-cash-stack' },
    { id: 'rh-gst', label: 'GST', about: 'Monthly sales report, registers and the filing pack.', route: '/secure/gst-filing', icon: 'bi-receipt' },
    { id: 'rh-finance', label: 'Finance', about: 'Bank statements and the records check.', route: '/secure/finance', icon: 'bi-bank' },
  ] },
  { key: 'oversight', label: 'Oversight', question: 'Is everything being done properly?', cards: [
    { id: 'rh-review', label: 'Weekly review', about: 'The owner’s checks for the week.', route: '/secure/review', icon: 'bi-journal-check' },
    { id: 'rh-compliance', label: 'Compliance', about: 'What is due, late or blocked.', route: '/secure/compliance', icon: 'bi-check2-square' },
    { id: 'rh-audit', label: 'Audit log', about: 'Who changed what, and when.', route: '/secure/quality/audit', icon: 'bi-shield-check' },
  ] },
];

/** the groups and cards this person may open, in order; an empty group is left out */
export function visibleHub(a: HubAccess, hub: HubGroup[] = HUB): HubGroup[] {
  return hub
    .map((g) => ({ ...g, cards: g.cards.filter((c) => (c.needs ? a.has(c.needs) : a.canOpen(c.route))) }))
    .filter((g) => g.cards.length > 0);
}
