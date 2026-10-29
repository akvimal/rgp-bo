/**
 * The outage kit: what a shop keeps ready each week so that a power cut (or a lost connection) does not stop it selling, and what the counter
 * does when it happens. The shop sells by hand from a printed price list, writing each bill in a numbered bill book, and enters the bills afterwards.
 */
export interface KitItem { key: string; label: string }

/** ticked once a week; the wording is kept with each record, so changing it later does not rewrite the past */
export const KIT_CHECKLIST: KitItem[] = [
  { key: 'ups_tested', label: 'UPS or inverter is plugged in, charged and tested (switch the mains off for a minute)' },
  { key: 'on_ups', label: 'The PC, router and bill printer are on the UPS or inverter' },
  { key: 'devices_charged', label: 'Laptop and phone are charged, and the phone has data for a hotspot' },
  { key: 'bill_book', label: 'The bill book has enough unused pages, and the last number used is written below' },
  { key: 'price_list', label: 'The price list printed this week is at the counter' },
  { key: 'light', label: 'A torch or emergency light works' },
  { key: 'float', label: 'There is change in the drawer for cash billing' },
  { key: 'upi_ready', label: 'The UPI device or soundbox is charged' },
  { key: 'procedure', label: 'The outage procedure is printed and kept in the bill book' },
];

export const READY_WITHIN_DAYS = 7;

/** every item on the list, as ticked or not; unknown keys are ignored */
export function recordItems(ticked: Record<string, any> | undefined, list: KitItem[] = KIT_CHECKLIST) {
  const items = list.map((i) => ({ key: i.key, label: i.label, ticked: !!(ticked && (ticked[i.key] === true || ticked[i.key] === 'true')) }));
  return { items, complete: items.every((i) => i.ticked) };
}

/** whole days from a date to today (both YYYY-MM-DD), never negative */
export function daysSince(fromIso: string | null, todayIso: string): number | null {
  if (!fromIso) return null;
  const d = Math.round((Date.parse(todayIso + 'T00:00:00Z') - Date.parse(String(fromIso).slice(0, 10) + 'T00:00:00Z')) / 86400000);
  return Math.max(0, d);
}

/** the kit is ready when it was last checked, completely, within the week */
export function isReady(lastCompleteIso: string | null, todayIso: string, within = READY_WITHIN_DAYS): boolean {
  const d = daysSince(lastCompleteIso, todayIso);
  return d !== null && d < within;
}

export const OUTAGE_CAUSES = ['POWER', 'INTERNET', 'SERVER', 'OTHER'] as const;
export type OutageCause = typeof OUTAGE_CAUSES[number];

/** the procedure printed for the counter: short steps in plain words */
/** the steps that are a pharmacy's: left out for a business that is not */
const PHARMACY_STEPS = [
  "For a medicine the customer takes regularly, write the customer's mobile number.",
  'A prescription medicine (marked Rx) goes in the prescription register as usual.',
];

export const PROCEDURE: { heading: string; steps: string[] }[] = [
  { heading: 'When the power goes', steps: [
    'Make sure the PC, router and printer are on the UPS or inverter. Switch on the torch or emergency light.',
    'If the system keeps working, keep billing as usual.',
    'If the system stops, tell customers you are billing by hand and carry on from the price list.',
  ] },
  { heading: 'Billing by hand', steps: [
    'Use the next page of the bill book. Write the bill number, date and time.',
    'Write each item with its quantity and the price from the price list. Prices on the list already include GST.',
    'Write the total. Give the customer copy and keep the shop copy. Never skip a number; cross out a spoiled bill and keep it.',
    "For a medicine the customer takes regularly, write the customer's mobile number.",
    'A prescription medicine (marked Rx) goes in the prescription register as usual.',
  ] },
  { heading: 'Money', steps: [
    'Take cash or UPI only. For UPI, write the reference number on the bill.',
    'No credit sales, staff credit, store credit or discounts beyond the price list.',
    'No refunds: write down the return and ask the customer to come back.',
  ] },
  { heading: 'When the power is back', steps: [
    'Do not close the shift yet.',
    'The Store Head checks the bill book against the cash and UPI received, and signs.',
    'Enter every bill in the system, then record the outage on the Outage kit page with the first and last bill number used.',
  ] },
];

export const procedureFor = (pharmacy: boolean) => (pharmacy ? PROCEDURE : PROCEDURE.map((p) => ({ ...p, steps: p.steps.filter((t) => !PHARMACY_STEPS.includes(t)) })));
