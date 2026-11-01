/**
 * The questions of the weekly knowledge check. Plain data, so a pharmacist can review and edit them in one place; the server picks the questions, marks the
 * answers and sends the right answer only after one is given. Pure: no framework, relative imports only.
 *
 * Basis: the pharmacy guide (Drugs and Cosmetics Act 1940 and Rules 1945, and common retail practice) and how this app works. DRAFT: the pharmacist-in-charge
 * should read every question and explanation before the check is relied on (set REVIEWED when done).
 */
export type Who = 'all' | 'counter' | 'manager';

export interface Question {
  id: string;
  topic: string;
  who: Who;
  text: string;
  options: string[];
  /** the index of the right option */
  answer: number;
  explain: string;
  /** where to read more: a page of the app, with its query */
  guide: string;
}

export const BANK_META = { version: '2026.11', reviewedBy: null as string | null };

export const TOPIC_LABELS: Record<string, string> = {
  schedules: 'Medicine schedules', prescriptions: 'Prescriptions', counter: 'At the counter', stock: 'Stock and expiry', billing: 'Billing and prices',
  records: 'Records and inspections', app: 'Using the app', manager: 'Running the store',
};

const PG = (c: string) => `/secure/pharmacy-guide?c=${c}`;
const AG = (job: string) => `/secure/app-guide?job=${job}`;

export const QUESTIONS: Question[] = [
  // ---- the rules of the trade: everyone
  { id: 'sch-h', topic: 'schedules', who: 'all', text: 'What must you have before you sell a Schedule H medicine?',
    options: ['A prescription from a registered medical practitioner', 'The customer\'s Aadhaar number', 'A phone call to the vendor', 'Nothing, if the customer is a regular'], answer: 0,
    explain: 'Schedule H needs a prescription from a registered medical practitioner, and the sale is supplied under a registered pharmacist.', guide: PG('schedules') },
  { id: 'sch-h1', topic: 'schedules', who: 'all', text: 'Besides a prescription, what does Schedule H1 need at the time of sale?',
    options: ['An entry in the H1 register: patient, prescriber, medicine and quantity', 'A manager\'s signature on the bill', 'Payment by card', 'Nothing more'], answer: 0,
    explain: 'H1 sales are written in the H1 register when they are made. The register and the prescription copy are kept for three years.', guide: PG('schedules') },
  { id: 'sch-x', topic: 'schedules', who: 'all', text: 'In a shop that holds a Schedule X licence, who handles Schedule X medicines?',
    options: ['Any counter staff', 'Only the pharmacist, from the locked cupboard, with a prescription and a register entry', 'The delivery person', 'The customer, from the shelf'], answer: 1,
    explain: 'Schedule X stock is kept locked and apart, the key is held by the pharmacist, and every supply is recorded.', guide: PG('schedules') },
  { id: 'sch-ndps', topic: 'schedules', who: 'all', text: 'A customer asks for a morphine-type painkiller. An ordinary retail pharmacy should:',
    options: ['Sell one strip against a prescription', 'Not supply it and tell the pharmacist', 'Order it from a vendor the same day', 'Sell it if the customer is known'], answer: 1,
    explain: 'Narcotic and psychotropic substances come under a separate law (the NDPS Act) with its own licence and records, which an ordinary retail pharmacy does not hold.', guide: PG('schedules') },
  { id: 'rx-regular', topic: 'prescriptions', who: 'all', text: 'A regular customer asks for an H1 medicine without a prescription, saying the doctor knows him. What do you do?',
    options: ['Sell a small quantity and write it down later', 'Do not sell: no prescription, no sale, for everyone', 'Sell it and ask him to sign', 'Sell it if he pays in cash'], answer: 1,
    explain: 'The rule is the same for every customer. Be friendly and firm, and offer another way to help.', guide: PG('counter') },
  { id: 'rx-unclear', topic: 'prescriptions', who: 'all', text: 'You cannot read one word of the prescription. What do you do?',
    options: ['Give the closest medicine you know', 'Show it to the pharmacist, who may call the doctor', 'Ask the customer to tell you what it is', 'Leave that medicine out'], answer: 1,
    explain: 'Never guess. A wrong medicine can harm the patient.', guide: PG('prescriptions') },
  { id: 'rx-mark', topic: 'prescriptions', who: 'all', text: 'After you supply on a prescription, what do you write on it?',
    options: ['The date and the shop\'s name (and the repeats supplied, if repeats are allowed)', 'Nothing: it is returned as it came', 'Only the customer\'s phone number', 'The bill total'], answer: 0,
    explain: 'Marking it stops the same prescription being used again for the same supply.', guide: PG('prescriptions') },
  { id: 'rx-brand', topic: 'prescriptions', who: 'all', text: 'May you give a different brand from the one the doctor wrote?',
    options: ['Yes, always, if it is cheaper', 'No, never', 'Only with the same composition and strength, the pharmacist\'s approval, the customer\'s agreement, and if the doctor did not write "do not substitute"', 'Yes, if the customer asks'], answer: 2,
    explain: 'Substitution is allowed only on those conditions.', guide: PG('prescriptions') },
  { id: 'cnt-pharmacist', topic: 'counter', who: 'all', text: 'Who must supervise the dispensing of prescription medicines?',
    options: ['Any senior staff member', 'A registered pharmacist, present while the shop is open', 'The owner, by phone', 'The vendor\'s representative'], answer: 1,
    explain: 'A registered pharmacist supervises every prescription sale.', guide: PG('licences') },
  { id: 'cnt-return', topic: 'counter', who: 'all', text: 'A customer returns a medicine they bought. Can it go back on the shelf?',
    options: ['Yes, if it is sealed', 'Yes, within 7 days', 'No: you cannot know how it was stored; follow the return policy and set it aside for the pharmacist', 'Yes, if the customer says it was kept in a fridge'], answer: 2,
    explain: 'A medicine that has left the shop cannot go back on the shelf for resale.', guide: PG('counter') },
  { id: 'stk-expired', topic: 'stock', who: 'all', text: 'You find an expired strip on the shelf. What do you do?',
    options: ['Move it to the back', 'Take it off at once, put it in the "expired, not for sale" box, tell the pharmacist and check the rest of the batch', 'Sell it at a discount', 'Leave it until the next stock count'], answer: 1,
    explain: 'Expired stock is never sold. Check the rest of the batch too.', guide: PG('records') },
  { id: 'stk-expiry-date', topic: 'stock', who: 'all', text: 'A pack says expiry 08/27. Until when can it be sold?',
    options: ['Until the end of August 2027', 'Until the end of 2027', 'Only on 1 August 2027', 'Until six months after August 2027'], answer: 0,
    explain: 'It can be sold until the end of the month printed, and never after.', guide: PG('concepts') },
  { id: 'stk-cold', topic: 'stock', who: 'all', text: 'At what temperature are insulin and vaccines kept?',
    options: ['Room temperature', '2 to 8 degrees C', 'Below 0 degrees C', '15 to 25 degrees C'], answer: 1,
    explain: 'Keep a thermometer in the fridge and note the temperature daily.', guide: PG('records') },
  { id: 'bil-mrp', topic: 'billing', who: 'all', text: 'What is the most you may charge for a medicine?',
    options: ['The MRP printed on the pack', 'The MRP plus GST', 'The vendor\'s rate plus 20%', 'Whatever the customer agrees to'], answer: 0,
    explain: 'The MRP already includes the taxes. You may charge less, never more.', guide: PG('concepts') },
  { id: 'rec-inspector', topic: 'records', who: 'all', text: 'A drug inspector arrives. What do you do?',
    options: ['Ask them to come back later', 'Be polite, call the pharmacist-in-charge or the licence holder, show what is asked for and hide or change nothing', 'Put the registers away', 'Refuse until the owner is present'], answer: 1,
    explain: 'The inspector may look at the premises and stock, ask for records and take samples. Ask for their identity.', guide: PG('records') },
  { id: 'rec-licence', topic: 'records', who: 'all', text: 'Where must the shop\'s drug licence be?',
    options: ['In the owner\'s office', 'Displayed where customers can see it, with the pharmacist\'s registration certificate', 'With the accountant', 'At the vendor'], answer: 1,
    explain: 'It must be displayed, with the pharmacist\'s registration certificate.', guide: PG('licences') },
  { id: 'rec-h1-years', topic: 'records', who: 'all', text: 'How long are the H1 register and the prescription copies kept?',
    options: ['One year', 'Three years', '30 days', 'Until the next stock audit'], answer: 1,
    explain: 'Three years. Print the register from the Drug register page for an inspector.', guide: PG('schedules') },

  // ---- using the app: everyone who bills
  { id: 'app-shift', topic: 'app', who: 'all', text: 'What must be open before you can complete a bill?',
    options: ['Your shift', 'The Drug register', 'A purchase invoice', 'The dashboard'], answer: 0,
    explain: 'A completed bill is a cash event: it belongs to an open shift, so the cash is reconciled when the shift closes.', guide: AG('w-shift') },
  { id: 'app-panel', topic: 'app', who: 'all', text: 'You add a scheduled drug to a bill and the "Scheduled drugs on this bill" panel appears. What is it for?',
    options: ['Choosing the batch', 'The patient and the prescriber, for the drug register', 'Giving the customer a discount', 'Printing the doctor\'s phone number on the bill'], answer: 1,
    explain: 'It records who the medicine is for and who prescribed it, and how the prescription stands.', guide: AG('w-scheduled') },
  { id: 'app-total', topic: 'app', who: 'all', text: 'How is the total of a bill worked out?',
    options: ['Each line is rounded to the rupee, then added', 'The lines are added with their paise and rounded once to the nearest rupee', 'The total is always rounded up', 'The total is always rounded down'], answer: 1,
    explain: 'Adding the lines first and rounding once gives the correct total; the bill shows the round-off.', guide: AG('w-bill') },
  { id: 'app-close', topic: 'app', who: 'counter', text: 'When you close your shift, besides counting the cash, what do you enter?',
    options: ['What each card or UPI terminal shows', 'The next day\'s price list', 'The vendors\' invoices', 'The stock count'], answer: 0,
    explain: 'The card and UPI totals are compared with the bills so a difference is seen the same day.', guide: AG('w-shift') },
  { id: 'app-later', topic: 'app', who: 'counter', text: 'A customer will bring the prescription tomorrow. You choose "Will bring it later" in the panel. What must the bill have?',
    options: ['A manager\'s password', 'A customer on record (name and mobile) and the day they will bring it', 'A photo of the customer', 'Nothing more'], answer: 1,
    explain: 'The customer shows in Contact today under "Prescriptions to collect" until a prescription is uploaded for them.', guide: AG('w-scheduled') },
  { id: 'app-collect', topic: 'app', who: 'counter', text: 'A prescription is listed under "Prescriptions to collect". What closes it?',
    options: ['Waiting 30 days', 'Uploading the prescription to that customer\'s documents', 'Deleting the bill', 'Calling the customer'], answer: 1,
    explain: 'It closes by itself once a prescription is kept for the customer after the bill. A manager can stop chasing it, with a reason.', guide: AG('w-contact') },
  { id: 'app-missing', topic: 'app', who: 'counter', text: 'An H1 bill was completed without the patient and prescriber. Where is it listed until the details are added?',
    options: ['In the Drug register, as missing its details', 'In Purchase', 'In Expenses', 'It is not listed anywhere'], answer: 0,
    explain: 'A manager can add the details from the Drug register, and the line is numbered and dated as the bill.', guide: AG('w-register-details') },

  // ---- running the store
  { id: 'mgr-reason', topic: 'manager', who: 'manager', text: 'A stock count shows a difference. To approve the adjustment you must:',
    options: ['Just press Approve', 'Choose why it differed (shrinkage, damaged, expired, correction and so on), with a few words for "Other"', 'Delete the line', 'Wait a week'], answer: 1,
    explain: 'A count only says the shelf and the book differ. The reason is recorded with who approved it. Rejecting also needs a reason.', guide: AG('w-audit') },
  { id: 'mgr-delete', topic: 'manager', who: 'manager', text: 'May an approved stock adjustment be deleted?',
    options: ['Yes, by a Store Head', 'Yes, on the same day', 'No: make an opposite adjustment instead', 'Yes, if the reason was wrong'], answer: 2,
    explain: 'An approved adjustment has already changed the stock. Only a draft that never moved the stock can be deleted, with a reason.', guide: AG('w-adjust') },
  { id: 'mgr-signoff', topic: 'manager', who: 'manager', text: 'Who signs off a stock audit?',
    options: ['The person who counted', 'A different person from the one who counted, once every difference is settled', 'Anyone, at any time', 'Nobody: it signs itself'], answer: 1,
    explain: 'Two people sign: one counted, another verified and approved. Sign-off is blocked while any difference is still waiting.', guide: AG('w-audit') },
  { id: 'mgr-rise', topic: 'manager', who: 'manager', text: 'A line\'s rate rose above the approval limit against the last purchase. Who can complete the invoice?',
    options: ['Any counter staff', 'A Store Head or Business Head, with a reason on the line', 'The vendor', 'Nobody until the vendor reduces the rate'], answer: 1,
    explain: 'A rise past the tolerance needs a reason; one past the approval limit needs a Store Head or Business Head to complete the invoice.', guide: AG('w-dispute') },
  { id: 'mgr-dispute', topic: 'manager', who: 'manager', text: 'A line on a purchase invoice looks wrong and the vendor must clarify. What do you do?',
    options: ['Delete the invoice', 'Move the line to dispute: it leaves the total until you accept or reject it', 'Complete the invoice and fix it later', 'Change the units to zero'], answer: 1,
    explain: 'The invoice cannot be completed while a line is in dispute. Reject needs a reason and keeps the original amount.', guide: AG('w-dispute') },
  { id: 'mgr-price', topic: 'manager', who: 'manager', text: 'Can a sale price be set above the MRP?',
    options: ['Yes, with the owner\'s approval', 'Never: the price with GST cannot be above the MRP', 'Yes, for slow-moving items', 'Yes, for new products'], answer: 1,
    explain: 'The billing guard refuses a bill that charges above the MRP.', guide: AG('w-price') },
  { id: 'mgr-flag', topic: 'manager', who: 'manager', text: 'A purchase line\'s MRP is ten times its net rate. What should you do?',
    options: ['Nothing: a big margin is good', 'Check the printed MRP and the pack: selling near it would show customers a discount that is not real', 'Reduce the MRP yourself', 'Reject the invoice'], answer: 1,
    explain: 'The receiving screen flags an MRP far above the rate so an inflated printed MRP is not shown to customers as a discount.', guide: AG('w-purchase') },
  { id: 'mgr-open-shift', topic: 'manager', who: 'manager', text: 'A shift was left open from yesterday. What can happen?',
    options: ['Nothing', 'It can stop the next shift opening, and it climbs the compliance ladder', 'The dashboard hides', 'Bills print without a number'], answer: 1,
    explain: 'Close every shift. An unclosed one is a compliance item that rises step by step.', guide: AG('w-shift') },
  { id: 'mgr-count', topic: 'manager', who: 'manager', text: 'Sales continued while a stock count was open. How is the difference measured?',
    options: ['Against the book at the start, ignoring sales', 'Against what should be on the shelf when counting finished', 'Against last month\'s stock', 'Sales are blocked during a count'], answer: 1,
    explain: 'Sales made during the count are not shortages: the difference is against the book less sales and other movements up to the finish time.', guide: AG('w-count') },
  { id: 'mgr-telegram', topic: 'manager', who: 'manager', text: 'Which Telegram alerts reach you at any hour?',
    options: ['All of them', 'Critical ones; the others wait until your quiet hours end', 'None', 'Only warnings'], answer: 1,
    explain: 'Quiet hours hold the lower levels; critical alerts always come.', guide: AG('w-telegram') },
];
