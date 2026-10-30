/**
 * The pharmacy guide: Indian retail pharmacy compliance in everyday words, written to be read by a new member of staff and used as a training
 * guide. Plain data, so a pharmacist can review and edit it in one place and the page just displays it. Pure: no Angular.
 *
 * Basis: the Drugs and Cosmetics Act 1940 and Rules 1945, the Pharmacy Act 1948, the NDPS Act 1985, and the usual practice of retail pharmacies.
 * Where a period or a form is named it is the common one; the licence holder and pharmacist-in-charge confirm it with the state Drugs Control office.
 */

export type Tone = 'info' | 'good' | 'warn' | 'danger';

export interface GuideCard { title: string; body?: string; points?: string[]; tone?: Tone; app?: string; }
export interface ScheduleRow { id: string; name: string; headline: string; tone: Tone; needs: string[]; examples: string; youDo: string[]; inApp: string; }
export interface Scenario { situation: string; doThis: string[]; why?: string; }
export interface Term { term: string; meaning: string; }
export interface Question { q: string; a: string; chapter: string; }
export interface PathStep { when: string; minutes: number; chapters: string[]; outcome: string[]; }

export interface Chapter {
  id: string;
  title: string;
  icon: string;
  minutes: number;
  intro: string;
  cards?: GuideCard[];
  schedules?: ScheduleRow[];
  scenarios?: Scenario[];
  terms?: Term[];
}

export const GUIDE_META = {
  version: '2026.10',
  basis: 'Drugs and Cosmetics Act 1940 and Rules 1945, Pharmacy Act 1948, NDPS Act 1985, and common retail practice in India',
  note: 'This guide explains the rules in everyday words, to help you work correctly and to train new staff. It is not legal advice and the rules change: your pharmacist-in-charge and your state Drugs Control office have the final word.',
};

export const GOLDEN_RULES: string[] = [
  'No prescription, no Schedule H, H1 or X medicine.',
  'A registered pharmacist supervises every prescription sale.',
  'Check the medicine, the batch and the expiry every time. Never sell expired stock.',
  'Write it down: H1 and X sales go in the register at the time of sale.',
  'Never charge above the MRP, and give a bill for every sale.',
  'When you are not sure, ask the pharmacist before you hand it over.',
];

export const LEARNING_PATH: PathStep[] = [
  {
    when: 'Day 1', minutes: 45, chapters: ['start', 'schedules', 'prescriptions', 'counter'],
    outcome: [
      'Say what Schedule H, H1 and X each need before a sale.',
      'Check a prescription using the eight-point check.',
      'Politely refuse a prescription medicine without a prescription, and say what to offer instead.',
    ],
  },
  {
    when: 'Day 2', minutes: 45, chapters: ['licences', 'records', 'concepts', 'quiz'],
    outcome: [
      'Know which licences and registers the shop must have, and where they are kept.',
      'Handle expired, damaged and returned stock correctly.',
      'Explain brand, generic, MRP, batch and expiry to a customer.',
    ],
  },
  {
    when: 'First week', minutes: 120, chapters: ['counter', 'quiz'],
    outcome: [
      'Watch the pharmacist check five prescriptions, then check them yourself with the pharmacist beside you.',
      'Make a supervised entry for an H1 sale on the bill and find it in the Drug register.',
      'Go through the counter situations again and retake the quiz until you answer all of it without looking.',
    ],
  },
];

export const CHAPTERS: Chapter[] = [
  // ------------------------------------------------------------------------------------------------------ start
  {
    id: 'start', title: 'Start here', icon: 'bi-flag', minutes: 5,
    intro: 'A pharmacy is not an ordinary shop. Some medicines can harm a person who takes them without a doctor, and the law makes the pharmacy responsible for who gets what. Following the rules protects the customer, you, and the licence of the shop.',
    cards: [
      { title: 'Why the rules matter to you', tone: 'info', points: [
        'A wrong sale can hurt a customer. The pharmacy and the person who handed it over answer for it.',
        'A drug inspector can visit at any time. Records that are complete and a shop that is in order mean a calm visit.',
        'The licence of the shop depends on following the rules. A serious breach can lose it, and the shop closes.',
      ] },
      { title: 'Who is responsible', body: 'The registered pharmacist is responsible for dispensing, and the licence holder for the shop as a whole. You help, and you learn: when you are not sure, ask. Nobody is ever blamed for asking before a sale.', tone: 'good' },
      { title: 'How to use this guide', points: [
        'New to the shop? Follow the learning path: two short sessions of about 45 minutes, then a first week with a senior beside you.',
        'Already working here? Use the search box, or open At the counter when something unusual walks in.',
        'The quiz at the end is only for you: nothing is recorded.',
      ] },
    ],
  },

  // ------------------------------------------------------------------------------------------------------ schedules
  {
    id: 'schedules', title: 'Medicine schedules', icon: 'bi-capsule', minutes: 15,
    intro: 'Medicines are grouped into schedules by how risky they are. The schedule decides what you must have before you can sell. This is the most important page in this guide.',
    schedules: [
      {
        id: 'OTC', name: 'No schedule (OTC)', headline: 'Sold without a prescription', tone: 'good',
        needs: ['No prescription needed.'],
        examples: 'Paracetamol strips, antacids, oral rehydration salts, many vitamins, cough lozenges, balms.',
        youDo: ['Bill it and give clear directions.', 'Ask a few questions and advise simply. If the problem has lasted more than a few days, or the person is a child, pregnant or elderly, send them to a doctor.'],
        inApp: 'Billed like any product.',
      },
      {
        id: 'H', name: 'Schedule H', headline: 'Prescription required', tone: 'warn',
        needs: ['A prescription from a registered medical practitioner.', 'Supplied under a registered pharmacist.'],
        examples: 'Most antibiotics, blood pressure and diabetes medicines, many others. The strip carries a red Rx mark and the words "Schedule H drug".',
        youDo: ['Check the prescription (see Prescriptions).', 'Supply only what is written.', 'Note the date and the shop on the prescription so it cannot be used again.'],
        inApp: 'Set the product\'s Schedule to H. The bill asks for the patient and the prescriber before it can be completed. Every sale is listed in the Drug register.',
      },
      {
        id: 'H1', name: 'Schedule H1', headline: 'Prescription + mandatory H1 register', tone: 'danger',
        needs: ['A valid prescription from a registered medical practitioner.', 'An entry in the H1 register at the time of sale: patient, prescriber, medicine, quantity.', 'The register and the prescription copy are kept for three years.'],
        examples: 'Certain strong antibiotics, anti-TB medicines, and some sedatives and habit-forming medicines. The pack is marked "Schedule H1 drug".',
        youDo: ['Insist on the prescription, every time, for every customer, including regulars.', 'Record the patient\'s name and address and the doctor\'s name and registration number.', 'Never sell without the entry, and keep the prescription copy.'],
        inApp: 'Set the product\'s Schedule to H1. The bill will not complete without the patient and prescriber details, and the sale is numbered in the Drug register (H1-0001, H1-0002 ...). Print the register for an inspector from that page.',
      },
      {
        id: 'X', name: 'Schedule X', headline: 'Special licence + prescription + locked inventory', tone: 'danger',
        needs: ['The shop must hold a licence that allows Schedule X.', 'A prescription, and a record of every supply, kept for at least two years.', 'Stock kept under lock, apart from other medicines, with the key held by the pharmacist.'],
        examples: 'Certain psychotropic medicines. The pack is marked "XRx" and "Schedule X drug". Most ordinary pharmacies do not stock them.',
        youDo: ['If the shop does not hold the licence, do not stock or sell it.', 'If it does: only the pharmacist handles it, from the locked cupboard, with a prescription and a register entry.', 'Count the stock regularly against the register.'],
        inApp: 'Set the product\'s Schedule to X. The bill asks for the patient and the prescriber, and the sale goes in the Drug register.',
      },
    ],
    cards: [
      { title: 'How to tell the schedule', points: [
        'Look at the strip or the box: a red Rx, "Schedule H drug", "Schedule H1 drug" or "XRx" is printed on the label.',
        'In the app, the product shows its Schedule on the product page. If a product has no schedule in the app but the label says Schedule H, tell the pharmacist so it can be corrected.',
        'If you are not sure, treat it as needing a prescription until the pharmacist says otherwise.',
      ] },
      { title: 'Narcotic and psychotropic substances (NDPS)', tone: 'danger', body: 'Morphine-type painkillers and certain other substances are controlled by a separate law, the NDPS Act, with its own licence and records. An ordinary retail pharmacy does not stock them. If a customer asks for one, do not supply it, and tell the pharmacist.' },
      { title: 'Other things you will see on labels', points: [
        'Schedule G: "Caution: it is dangerous to take this preparation except under medical supervision". Sold mostly on a prescription in practice.',
        'Schedule K: the household remedies and some other items that may be sold more freely.',
        'Schedule J: diseases a medicine may not claim to cure. If an advertisement or a customer says a product cures one of them, be careful, and tell the pharmacist.',
      ] },
    ],
  },

  // ------------------------------------------------------------------------------------------------------ prescriptions
  {
    id: 'prescriptions', title: 'Prescriptions', icon: 'bi-file-earmark-medical', minutes: 15,
    intro: 'A prescription is the doctor\'s written instruction. Checking it properly is the single most useful habit in a pharmacy.',
    cards: [
      { title: 'Who may prescribe', body: 'A registered medical practitioner: a doctor with a registration number from the state or national medical council. Dentists may prescribe for dental treatment, and practitioners of AYUSH systems for their own systems of medicine. A prescription from a doctor on a video or phone consultation is acceptable when it carries all the doctor\'s details.' },
      {
        title: 'The eight-point check', tone: 'good', points: [
          '1. The doctor: name, qualification and registration number, with a signature.',
          '2. The date: recent, and not in the future.',
          '3. The patient: name, and age (always for children).',
          '4. The medicine: name, strength and form (tablet, syrup, injection) clear and unmistakable.',
          '5. The quantity or the number of days.',
          '6. The directions: how much, how often, for how long.',
          '7. Repeats: allowed only if the doctor wrote so.',
          '8. Nothing altered, overwritten or unclear. If something is, call the doctor, or ask the pharmacist.',
        ],
      },
      { title: 'After you supply', points: [
        'Write the date and the shop\'s name on the prescription, so it cannot be used for the same purchase again.',
        'If the doctor allowed repeats, note on it how many have been supplied.',
        'If it allows no repeat, keep a copy or cancel it. For H1 (and X), the prescription copy is kept with the register.',
      ] },
      { title: 'Generic and brand', body: 'If the doctor wrote a brand name, you may offer a cheaper medicine with the same composition and strength only if the customer agrees and the doctor has not written "do not substitute". The pharmacist decides. Never substitute a different composition.' },
      { title: 'Be careful when', tone: 'warn', points: [
        'The handwriting cannot be read with certainty. A guess can be dangerous.',
        'The dose looks too high for the age, or two medicines look like they should not go together. Ask the pharmacist.',
        'A prescription is old, photocopied several times, or looks used before.',
        'The same prescription comes in again and again for a habit-forming medicine.',
      ] },
      { title: 'In the app', body: 'On a bill with an H, H1 or X medicine, fill in the patient and the prescriber (name and registration number or address) and the prescription date. The bill will not complete without them. They go into the Drug register automatically.' },
    ],
  },

  // ------------------------------------------------------------------------------------------------------ licences
  {
    id: 'licences', title: 'Licences and people', icon: 'bi-patch-check', minutes: 10,
    intro: 'The shop may sell medicines only because it holds licences, and only while a registered pharmacist is in charge. Know what is on the wall and why.',
    cards: [
      { title: 'The retail drug licence', body: 'A retail pharmacy holds a drug licence, usually in Forms 20 and 21 together. It names the premises and the pharmacist. It must be displayed where customers can see it. A licence stays valid as long as the licence retention fee is paid on time, every five years: the licence shows the exact date.', app: 'Settings > Store settings keeps each store\'s licences and warns before they expire.' },
      { title: 'The registered pharmacist', body: 'Prescription medicines are dispensed by, or under the personal supervision of, a pharmacist who is registered with the State Pharmacy Council. They must be present while the shop is open, and their registration certificate is displayed. A shop with no pharmacist present cannot dispense prescriptions.', app: 'The pharmacist\'s registration number, council and validity are kept on their staff record in HR, and the app reminds before it expires.' },
      { title: 'Other papers a shop keeps', points: [
        'GST registration (and the GSTIN on every tax invoice).',
        'Shop and establishment registration, and the trade licence of the local body.',
        'FSSAI registration if the shop sells food, health drinks or nutrition products.',
        'A Schedule X licence only if the shop stocks Schedule X medicines.',
      ] },
      { title: 'Buy only from licensed vendors', body: 'Buy medicines only from vendors who hold a drug licence, and always against an invoice that shows the vendor\'s licence number, the batch and the expiry. Never buy medicines from someone without a licence, or without a bill.', app: 'Purchases > Vendors keeps each vendor\'s licence number.' },
      { title: 'Who does what at the counter', points: [
        'Registered pharmacist: dispenses prescriptions, makes the decision on any doubt, signs the H1 and X records.',
        'Assistant or helper: bills, packs, shelves, and helps customers; works under the pharmacist for prescription medicines.',
        'Everyone: asks before handing over anything they are unsure of.',
      ] },
    ],
  },

  // ------------------------------------------------------------------------------------------------------ records
  {
    id: 'records', title: 'Records, stock and inspections', icon: 'bi-journal-text', minutes: 15,
    intro: 'If it is not written down, it did not happen. Good records, tidy stock and nothing expired on the shelf make an inspection easy.',
    cards: [
      { title: 'What is recorded, and for how long', points: [
        'Every sale has a bill. Prescription medicines also have the prescription.',
        'Schedule H1: the H1 register and prescription copy, kept three years.',
        'Schedule X: the record of each supply and the prescription, kept at least two years.',
        'Purchase invoices and sales records: keep them for at least three years. Tax records are kept longer (six years under GST).',
        'When in doubt, keep it and ask the pharmacist-in-charge how long.',
      ], app: 'The Drug register page lists every H, H1 and X sale, and prints for an inspector or downloads to Excel.' },
      { title: 'Receiving stock', points: [
        'Check the delivery against the invoice: items, quantities, batch numbers and expiry dates.',
        'Reject damaged, wrongly labelled or very short-dated medicines, and note it with the vendor.',
        'Put cold-chain items (insulin, vaccines) in the fridge at once.',
      ], app: 'Enter the purchase in Purchases. The app reads the invoice copy and checks it against the printed total.' },
      { title: 'Storing stock', points: [
        'Keep medicines in a clean, dry place, away from sunlight, at the temperature on the label.',
        'Cold-chain medicines stay at 2 to 8 degrees C. Keep a thermometer in the fridge and note the temperature every day.',
        'Arrange by first expiry, first out: the earliest expiry at the front.',
        'Schedule X medicines are locked away and kept apart.',
      ] },
      { title: 'Expired and damaged stock', tone: 'danger', points: [
        'Check expiry dates regularly, and pull out anything close to expiry.',
        'Expired or damaged medicines go into a separate box marked "Expired, not for sale". They never stay on the shelf.',
        'Return them to the vendor against a credit note, or dispose of them through an authorised route, and write down what was done.',
        'Never sell, and never "adjust", a medicine to hide that it has expired.',
      ], app: 'Stock audits compare the shelf with the app, and flag expiring batches.' },
      { title: 'Recalls and quality alerts', body: 'When a vendor or the regulator announces that a batch is not of standard quality or is recalled, find that batch in the shop, take it off the shelf at once, and follow the notice. Tell the pharmacist.' },
      { title: 'When a drug inspector visits', tone: 'info', points: [
        'Be polite and calm, and call the pharmacist-in-charge or the licence holder at once.',
        'The inspector may look at the premises and stock, ask for records, and take samples. Ask for their identity.',
        'Have ready: the licences, the pharmacist\'s registration, the H1 and X records, purchase invoices, prescriptions, and the cold-chain log.',
        'Do not hide, destroy or alter anything. Answer truthfully and let the pharmacist deal with what you do not know.',
      ], app: 'Open Compliance in the app to see what is due before the inspector does.' },
    ],
  },

  // ------------------------------------------------------------------------------------------------------ counter
  {
    id: 'counter', title: 'At the counter: what do I do when...', icon: 'bi-chat-dots', minutes: 15,
    intro: 'Real situations, and what to do. Read them once, and come back when something unusual walks in.',
    scenarios: [
      {
        situation: 'A customer asks for a Schedule H medicine and has no prescription.',
        doThis: ['Say politely that this medicine needs a doctor\'s prescription, and that you are not allowed to sell it without one.', 'Offer to help in another way: a doctor nearby, or a safe over-the-counter option for the symptom if there is one.', 'If the person insists or says it is an emergency, call the pharmacist. Do not sell.'],
        why: 'Selling without a prescription is an offence, and the medicine can harm someone who does not know whether it is right for them.',
      },
      {
        situation: 'The customer shows a prescription as a photo on a phone.',
        doThis: ['A photo or printout of a prescription from a registered doctor, with all the doctor\'s details, may be accepted for Schedule H when the pharmacist is satisfied.', 'For H1 and X, ask for the prescription the doctor issued and follow the pharmacist\'s decision.', 'A photo of an old prescription already used is not acceptable.'],
      },
      {
        situation: 'The prescription is old or has been used before.',
        doThis: ['Look for the date and for a shop\'s stamp or note of an earlier supply.', 'If it allows no repeat and has been supplied once, do not supply again. Ask the customer to get a fresh one.', 'If the doctor wrote repeats, supply only the number allowed and note it.'],
      },
      {
        situation: 'You cannot read the handwriting, or two names look alike.',
        doThis: ['Do not guess. Show it to the pharmacist.', 'If still unclear, call the doctor\'s clinic to confirm, or ask the customer to have it clarified.'],
        why: 'Many medicines have names that look or sound alike. A wrong one can be dangerous.',
      },
      {
        situation: 'The prescription names a brand that you do not have.',
        doThis: ['Ask the pharmacist. If another brand has the same composition and strength, the pharmacist may offer it, with the customer\'s agreement, unless the doctor wrote "do not substitute".', 'Never change the composition or strength.'],
      },
      {
        situation: 'The customer wants fewer tablets than written, or more.',
        doThis: ['Fewer is fine for Schedule H: supply what they ask and note the quantity on the prescription.', 'More than written is not: supply only what the doctor wrote.', 'For H1 and X, record exactly the quantity supplied.'],
      },
      {
        situation: 'A regular customer asks for an H1 medicine and says "the doctor knows me, I always get this".',
        doThis: ['The rule is the same for everyone: no prescription, no sale.', 'Be friendly and firm: "I would love to, but I am not allowed to without the prescription."', 'Enter every H1 sale in the register with the patient and prescriber details.'],
        why: 'H1 medicines include strong antibiotics, anti-TB medicines and habit-forming medicines. Careless sale causes resistance and misuse.',
      },
      {
        situation: 'The same person keeps buying cough syrup, sleeping tablets or a similar medicine.',
        doThis: ['Do not sell more than the prescription allows and do not sell without one where one is needed.', 'Tell the pharmacist about the pattern.', 'A habit-forming medicine bought again and again without a doctor is a warning sign of misuse.'],
      },
      {
        situation: 'You find an expired strip on the shelf.',
        doThis: ['Take it off the shelf now and put it in the "Expired, not for sale" box.', 'Tell the pharmacist and check the rest of that batch and the shelf around it.', 'Never sell it, and never change the date or the label.'],
      },
      {
        situation: 'A customer asks for a medicine for a child, a pregnant woman or an elderly person.',
        doThis: ['Do not recommend on your own. Doses and safe choices are different for them.', 'Ask the pharmacist, and send the person to a doctor if the problem is more than a simple, short one.', 'For children, always know the age and weight before any advice.'],
      },
      {
        situation: 'A customer wants a discount, or says "no bill needed".',
        doThis: ['Never charge more than the MRP. A discount below the MRP is allowed within your shop\'s policy.', 'Always give a bill. It is the record that the sale happened properly.'],
      },
      {
        situation: 'A customer brings back a medicine that they bought.',
        doThis: ['A medicine that has left the shop cannot go back on the shelf for resale: you cannot know how it was stored.', 'For a wrong or damaged supply, follow the shop\'s return policy: replace or refund, and put the returned strip aside for the pharmacist to inspect and discard.', 'Record the return in the app.'],
      },
      {
        situation: 'A drug inspector arrives.',
        doThis: ['Be polite. Call the pharmacist-in-charge or the licence holder at once.', 'Do not hide or change anything. Show what is asked for.', 'See "Records, stock and inspections" for what to have ready.'],
      },
    ],
  },

  // ------------------------------------------------------------------------------------------------------ concepts
  {
    id: 'concepts', title: 'Concepts and words', icon: 'bi-book', minutes: 10,
    intro: 'The words of the pharmacy, in plain English. A new member of staff who knows these can follow a conversation with the pharmacist, a vendor or an inspector.',
    terms: [
      { term: 'Prescription (Rx)', meaning: 'The doctor\'s written instruction for a patient: which medicine, how much, how often, for how long.' },
      { term: 'OTC', meaning: 'Over the counter: a medicine that can be sold without a prescription.' },
      { term: 'Schedule', meaning: 'A group in the Drugs and Cosmetics Rules that sets how a medicine may be sold. H, H1 and X are the ones you will deal with most.' },
      { term: 'Brand and generic', meaning: 'A brand is the name a company gives its product. A generic is named for what is in it. Two products with the same composition and strength work the same way, and the generic is often cheaper.' },
      { term: 'Composition (salt)', meaning: 'The active ingredient or ingredients, for example "Paracetamol 500 mg". Brands with the same composition and strength can usually replace each other, with the pharmacist\'s approval.' },
      { term: 'Strength', meaning: 'How much of the active ingredient is in each tablet or each measure, for example 500 mg, or 125 mg per 5 ml.' },
      { term: 'Dosage form', meaning: 'The kind of product: tablet, capsule, syrup, injection, ointment, drops. A different form is a different product.' },
      { term: 'Pack', meaning: 'What the product is sold in: a strip of 10 tablets, a bottle of 100 ml. The price is for the pack.' },
      { term: 'Batch number', meaning: 'A code printed on the pack that identifies the lot it was made in. If a batch is faulty and recalled, the batch number tells you which packs.' },
      { term: 'Expiry date', meaning: 'The last month in which the medicine is guaranteed to work and be safe. A pack marked 08/27 can be used until the end of August 2027. After that it is never sold.' },
      { term: 'MRP', meaning: 'Maximum Retail Price: the most the shop may charge, with taxes included. You may charge less. You may never charge more.' },
      { term: 'PTR and PTS', meaning: 'The price the shop pays: PTR is the price to the retailer, PTS the price to the stockist. The difference to the MRP is the shop\'s margin.' },
      { term: 'GST on medicines', meaning: 'Most medicines carry a low rate of GST (commonly 5 percent), and some life-saving medicines carry none. The right rate is set on the product in the app, so the bill is correct.' },
      { term: 'Ceiling price', meaning: 'For medicines under price control, the government sets a maximum price. The MRP of such a medicine cannot be above it.' },
      { term: 'FEFO / FIFO', meaning: 'First expiry, first out (and first in, first out): sell the pack that expires earliest first, so nothing is left to expire on the shelf.' },
      { term: 'Cold chain', meaning: 'Medicines such as insulin and vaccines that must stay at 2 to 8 degrees C from the vendor to the customer.' },
      { term: 'NSQ', meaning: 'Not of Standard Quality: a batch that has failed a quality test. The regulator publishes lists, and NSQ batches must be taken off sale.' },
      { term: 'Spurious and counterfeit', meaning: 'Fake medicines. Buying only from licensed vendors, against an invoice, is the best protection.' },
      { term: 'H1 register', meaning: 'The separate register where every Schedule H1 supply is written: patient, prescriber, medicine, quantity, date. In this app, the Drug register does it from the bill.' },
      { term: 'Chronic medicine', meaning: 'A medicine a person takes for a long time, for example for blood pressure or diabetes. Customers often come back for a refill every month.' },
      { term: 'Refill', meaning: 'A repeat supply of a regular medicine. For prescription medicines it needs a prescription that allows it.' },
      { term: 'Substitution', meaning: 'Giving a different brand with the same composition and strength. Allowed with the pharmacist\'s approval, the customer\'s agreement, and the doctor not having written "do not substitute".' },
      { term: 'Pharmacist-in-charge', meaning: 'The registered pharmacist named on the shop\'s licence, responsible for dispensing and for the day-to-day compliance of the shop.' },
      { term: 'Drug inspector', meaning: 'An officer of the state Drugs Control department who can inspect the shop, check records and take samples.' },
      { term: 'Licence retention fee', meaning: 'The fee paid every five years to keep the drug licence in force.' },
    ],
  },

  // ------------------------------------------------------------------------------------------------------ quiz
  { id: 'quiz', title: 'Test yourself', icon: 'bi-patch-question', minutes: 10, intro: 'Answer in your head, then show the answer. Nothing is recorded: it is only for you. Go through it until you can answer everything without looking.' },
];

export const QUIZ: Question[] = [
  { q: 'What does Schedule H need before you sell it?', a: 'A prescription from a registered medical practitioner, supplied under a registered pharmacist.', chapter: 'schedules' },
  { q: 'What does Schedule H1 need, besides a prescription?', a: 'An entry in the H1 register at the time of sale (patient, prescriber, medicine, quantity). The register and the prescription copy are kept for three years.', chapter: 'schedules' },
  { q: 'What does Schedule X need?', a: 'A licence that allows Schedule X, a prescription and a record of the supply, and the stock kept locked and apart.', chapter: 'schedules' },
  { q: 'A regular customer asks for an H1 medicine without a prescription, saying the doctor knows him. What do you do?', a: 'Do not sell. The rule is the same for everyone: no prescription, no sale. Be friendly and firm.', chapter: 'counter' },
  { q: 'Name four things you check on a prescription.', a: 'Any four of: the doctor\'s name, registration number and signature; the date; the patient\'s name and age; the medicine name, strength and form; the quantity; the directions; repeats; nothing altered or unclear.', chapter: 'prescriptions' },
  { q: 'After supplying on a prescription, what do you write on it?', a: 'The date and the shop\'s name (and the number of repeats supplied, if repeats are allowed), so it cannot be used again for the same supply.', chapter: 'prescriptions' },
  { q: 'You cannot read one word of the prescription. What do you do?', a: 'Do not guess. Show it to the pharmacist, who may call the doctor.', chapter: 'prescriptions' },
  { q: 'May you give a different brand from the one the doctor wrote?', a: 'Only with the same composition and strength, with the pharmacist\'s approval and the customer\'s agreement, and if the doctor did not write "do not substitute".', chapter: 'prescriptions' },
  { q: 'Who must supervise the dispensing of prescription medicines?', a: 'A registered pharmacist, present while the shop is open.', chapter: 'licences' },
  { q: 'Where must the shop\'s drug licence be?', a: 'Displayed where customers can see it, with the pharmacist\'s registration certificate.', chapter: 'licences' },
  { q: 'How do you treat an expired strip you find on the shelf?', a: 'Take it off at once, put it in the "Expired, not for sale" box, tell the pharmacist, and check the rest of the batch. Never sell it.', chapter: 'records' },
  { q: 'At what temperature are insulin and vaccines kept?', a: '2 to 8 degrees C, with a thermometer in the fridge and the temperature noted daily.', chapter: 'records' },
  { q: 'What do you do when a vendor announces a batch recall?', a: 'Find that batch in the shop, take it off the shelf at once, follow the notice, and tell the pharmacist.', chapter: 'records' },
  { q: 'What is the most you may charge for a medicine?', a: 'The MRP. You may charge less, never more.', chapter: 'concepts' },
  { q: 'A pack says expiry 08/27. Until when can it be sold?', a: 'Until the end of August 2027. After that it is never sold.', chapter: 'concepts' },
  { q: 'What do you do if a drug inspector visits?', a: 'Be polite, call the pharmacist-in-charge or the licence holder, show what is asked for, and do not hide or change anything.', chapter: 'records' },
  { q: 'Which medicines does an ordinary retail pharmacy not stock because of a separate law?', a: 'Narcotic and psychotropic substances under the NDPS Act. If a customer asks, do not supply and tell the pharmacist.', chapter: 'schedules' },
  { q: 'A customer returns a medicine they bought. Can it go back on the shelf?', a: 'No. You cannot know how it was stored. Follow the shop\'s return policy and set the returned strip aside for the pharmacist to inspect and discard.', chapter: 'counter' },
];

// ---------------------------------------------------------------------------------------------------------- search
export interface GuideHit { chapter: string; chapterTitle: string; kind: string; title: string; text: string; }

const norm = (s: string) => String(s || '').toLowerCase();

/** every place in the guide that mentions all the words searched for (a hit carries the chapter, so the page can open it) */
export function searchGuide(query: string, chapters: Chapter[] = CHAPTERS, quiz: Question[] = QUIZ): GuideHit[] {
  const words = norm(query).split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  const hits: GuideHit[] = [];
  const add = (c: Chapter, kind: string, title: string, parts: Array<string | string[] | undefined>) => {
    const text = ([] as string[]).concat(...parts.map((p) => (Array.isArray(p) ? p : p ? [p] : []))).join(' ');
    const hay = norm(title + ' ' + text);
    if (words.every((w) => hay.includes(w))) hits.push({ chapter: c.id, chapterTitle: c.title, kind, title, text: text.length > 160 ? text.slice(0, 157) + '...' : text });
  };
  for (const c of chapters) {
    add(c, 'Chapter', c.title, [c.intro]);
    for (const k of c.cards || []) add(c, 'Guide', k.title, [k.body, k.points, k.app]);
    for (const s of c.schedules || []) add(c, 'Schedule', s.name, [s.headline, s.needs, s.examples, s.youDo, s.inApp]);
    for (const s of c.scenarios || []) add(c, 'At the counter', s.situation, [s.doThis, s.why]);
    for (const t of c.terms || []) add(c, 'Word', t.term, [t.meaning]);
  }
  const quizChapter = chapters.find((c) => c.id === 'quiz');
  if (quizChapter) for (const q of quiz) add(quizChapter, 'Quiz', q.q, [q.a]);
  return hits;
}
