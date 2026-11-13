/**
 * The app guide: what each page of the app is for and how to do the common jobs, shown to a person only for the pages their login can open.
 * Plain data, so it can be reviewed and edited in one place, and pure (no Angular) so a test can check it against the menu. Every menu page must have an
 * entry here (the test fails otherwise), so a new page cannot be added without saying what it is for.
 *
 * The pharmacy guide (a separate page) teaches the rules of the trade; this guide is about the app.
 */

export type GuideGroup = 'home' | 'sell' | 'stock' | 'buy' | 'accounts' | 'people' | 'learn' | 'oversight' | 'setup';

export const GROUP_ORDER: GuideGroup[] = ['home', 'sell', 'stock', 'buy', 'accounts', 'people', 'oversight', 'learn', 'setup'];

export const GROUP_LABELS: Record<GuideGroup, string> = {
  home: 'Home', sell: 'Sell', stock: 'Inventory', buy: 'Purchasing', accounts: 'Accounts', people: 'People', learn: 'Learn', oversight: 'Oversight', setup: 'Setup',
};

export interface PageGuide {
  /** the menu item's id (nav-sales), or an id of its own for a page the menu does not list (setup pages, the bell) */
  id: string;
  group: GuideGroup;
  title: string;
  route: string;
  purpose: string;
  /** the main things done here */
  tasks: string[];
  /** who usually uses it */
  who: string;
  /** what to be careful about */
  watch?: string[];
  /** for a page the menu does not decide: the permissions that open it (any one of them) */
  needs?: string[];
  /** open to everyone signed in */
  always?: boolean;
  keywords?: string;
}

export interface Walkthrough {
  id: string;
  title: string;
  /** the page it starts on: shown only to a person who can open that page */
  from: string;
  steps: string[];
  tips?: string[];
  keywords?: string;
}

export type DayKind = 'counter' | 'storehead' | 'owner' | 'other';

export interface DayPlan {
  kind: DayKind;
  label: string;
  intro: string;
  daily: string[];
  weekly: string[];
  monthly: string[];
}

export const GUIDE_META = {
  version: '2026.11',
  note: 'This guide follows your login: it shows the pages you can open. If a page is missing that you need, ask the Business Head to change your role.',
};

// ------------------------------------------------------------------------------------------------ the pages
export const PAGES: PageGuide[] = [
  // ---- home
  {
    id: 'nav-todos', group: 'home', title: 'To-dos', route: '/secure/todos',
    purpose: 'Jobs you have to do, with a day and time, a reminder, and a note of what you did when you finish.',
    tasks: ['Mine: add a to-do with the day, the time and a priority, and mark it Done.', 'Make it repeat every day, every week on chosen days, or every month, or have the next one made some days after it is done.', 'My team\'s: managers give a to-do to a person, or to a store\'s staff, and see what is Done lately or Missed.', 'To-dos made by the KPI assistant appear here too, for the people in the role.'],
    who: 'Everyone. Managers can give to-dos to the people and stores they look after.', watch: ['A to-do left undone can be raised to the manager after the number of days set on it.'], keywords: 'todo to-do reminder task repeat assign',
  },
  {
    id: 'nav-dashboard', group: 'home', title: 'Dashboard', route: '/secure/dashboard',
    purpose: 'Today at a glance, for the work your role does: sales, cash, and what needs attention.',
    tasks: ['See today\'s and this month\'s figures for your stores.', 'Open a number or an alert to go to the page behind it.', 'Change the period or the store where the page offers it.'],
    who: 'Everyone. What it shows depends on the role.',
    watch: ['Figures cover only the stores you are placed in; the Business Head sees all of them.'], keywords: 'home overview sales today',
  },
  {
    id: 'bell', group: 'home', title: 'Notifications (the bell)', route: '/secure/notifications', always: true,
    purpose: 'Everything that needs your attention, in your language, until the cause is fixed.',
    tasks: ['Open an alert to go straight to what it is about.', 'Snooze it for an hour, four hours or a day, or dismiss it for yourself.', 'Choose English or Tamil.', 'Connect Telegram to get the important ones on your phone.'],
    who: 'Everyone. You see only the alerts meant for your role and your stores.',
    watch: ['An alert goes away by itself once the cause is fixed. Dismissing hides it for you only.'], keywords: 'alerts telegram bell snooze',
  },
  {
    id: 'nav-shift', group: 'home', title: 'My shift', route: '/secure/shift',
    purpose: 'Your cash for the shift: open it, and close it with the cash and the card or UPI totals counted.',
    tasks: ['Open your shift with the cash in the drawer before billing.', 'Close it at the end: count the cash by denomination and enter what each payment terminal shows.', 'Do the checklist items, or say why one cannot be done.'],
    who: 'Counter staff and anyone who bills.',
    watch: ['A bill cannot be completed without an open shift.', 'A shift left open from an earlier day can stop the next one opening.'], keywords: 'cash drawer open close denomination',
  },
  {
    id: 'nav-reports', group: 'home', title: 'Reports', route: '/secure/reports',
    purpose: 'Sales reports for a period, a box where you ask the shop a question in plain words, and a weekly summary of how the shop did.',
    tasks: ['Sales report: choose the dates and the store, and run the report; download it to Excel for your accountant.', 'Ask the shop: type a question such as top 10 products last month, or press a report button (sales by staff, profit by product, who owes money, stock that will not sell in time and more).', 'Weekly summary: last week in a few lines, what went well, what to watch and what to do first. It is made every Monday morning and can be sent to your Telegram.'],
    who: 'Managers and the owner.', keywords: 'excel download sales report',
  },

  // ---- sell
  {
    id: 'nav-sales', group: 'sell', title: 'Sales and billing', route: '/secure/sales',
    purpose: 'Billing at the counter, and everything about a sale after it: reports, deliveries and returns.',
    tasks: ['New sale: add the customer by mobile number, add products, take payment, complete and print the bill.', 'Save a sale for later and come back to it from its tab.', 'Pay later needs a comment; only staff see it.', 'Collect a customer order: once its goods have arrived, choose it in the payment box and the advance is applied to the bill.', 'Reports: find a bill, filter by staff or payment, check a digital payment.', 'Deliveries: follow orders handed over by delivery. Manage delivery shows the bill with the customer\'s name and mobile, and records how the delivery charge was paid (UPI or card counts in the shift\'s digital total).', 'Returns: take back goods against a bill.'],
    who: 'Counter staff, store heads and the owner.',
    watch: ['Open your shift first.', 'A scheduled drug asks for the patient and prescriber; Schedule X will not complete without them.', 'The total is the lines added up and rounded once to the nearest rupee.', 'A product with no price is marked in the lookup and cannot be billed: set its price first.'], keywords: 'bill pos billing sale return delivery',
  },
  {
    id: 'nav-customers', group: 'sell', title: 'Customers', route: '/secure/customers/cust/list',
    purpose: 'Your customers, their bills and documents, and who to contact today.',
    tasks: ['Find or add a customer (the mobile number is the key). People who share a number are one household with one account: the till asks who the bill is for, and Account on the customer page changes the number or gives a person their own account.', 'Keep a prescription in their documents.', 'Contact today: the short daily list of regulars due back, people slipping away and prescriptions to collect.', 'Audiences and duplicates (for the people who run the shop).'],
    who: 'Counter staff, store heads and the owner.',
    watch: ['Phone numbers may be masked until you press Show; each reveal is counted and kept.', 'Never contact a customer who asked to stop.'], keywords: 'customer mobile contact worklist audience',
  },
  {
    id: 'nav-commitments', group: 'sell', title: 'Customer orders', route: '/secure/commitments',
    purpose: 'Goods a customer asks for that the shop does not have: ordered for them, with any advance kept for the order, until they collect.',
    tasks: ['New order: choose the customer, add what they want (product, packs, agreed price) and take an advance if they pay one.', 'Link it to a purchase request from the order page so the goods are bought with the customer in mind.', 'When the invoice comes in, the order shows Arrived and staff are alerted to tell the customer; the goods are held for them for a few days.', 'Collect it at the till: choose the order in the payment box and the advance is applied to the bill.', 'Cancel an order: a Store Head or the owner refunds the advance or moves it to the customer\'s wallet.'],
    who: 'Counter staff take orders and advances; Store Heads and the owner refund or move an advance.',
    watch: ['An advance is counted in the shift it was taken in, so it tallies with that shift\'s drawer or terminal.', 'The customer must be on file: staff call them when the goods arrive.'], keywords: 'customer order advance special order commitment hold collect',
  },
  {
    id: 'nav-refills', group: 'sell', title: 'Refills', route: '/secure/quality/refills',
    purpose: 'Regular customers whose chronic medicine is about to run out, so they can be called before they do.',
    tasks: ['See who is due, with what and when.', 'Call or message them and record what came of it.'],
    who: 'Counter staff.', keywords: 'chronic refill call reminder',
  },
  {
    id: 'nav-price-changes', group: 'sell', title: 'Price changes', route: '/secure/price-changes',
    purpose: 'What changed in the shop\'s selling prices, for the counter, so you can tell a customer why a price moved.',
    tasks: ['Choose the days (7 or 14 days, this month or last month, or your own dates).', 'Hide small moves with "Changed by at least %", or find one product by name.', 'Print the sheet and keep it beside the till.', 'Only products in stock are listed: bought in the last year, not expired, with stock left.'],
    who: 'Everyone who serves at the counter. It shows selling prices only, never cost.', keywords: 'price change increase decrease mrp sheet print',
  },
  {
    id: 'nav-inquiries', group: 'sell', title: 'Requests and inquiries', route: '/secure/inquiries',
    purpose: 'What customers asked for that the shop did not have, so it is followed up.',
    tasks: ['Write down an inquiry or a request at the counter.', 'Work through Open, Overdue and Mine; close it when done.'],
    who: 'Counter staff and store heads.', keywords: 'request inquiry customer ask',
  },

  // ---- inventory
  {
    id: 'nav-products', group: 'stock', title: 'Products and prices', route: '/secure/products',
    purpose: 'The catalogue of what the shop sells, and the sale price of each product.',
    tasks: ['Add a product: name, category, composition, schedule, whether it is chronic, HSN and pack.', 'Set or change a sale price: the rules say the lowest and highest price allowed and who must approve.', 'Needs a price: new products bought and not yet priced, each with a suggested price.', 'Price list > Bulk update prices: tick products (or use everything shown) and set the price to the MRP or a percent off it. Preview first; any product whose price cannot be set is skipped and listed with the reason.', 'Data check: products whose pack size or details look wrong.'],
    who: 'Store heads and the owner; counter staff may see products.',
    watch: ['A price can never be above the MRP.', 'A big or sudden raise needs approval and is stepped.'], keywords: 'product price catalogue schedule hsn pricing policy',
  },
  {
    id: 'nav-store', group: 'stock', title: 'Stock', route: '/secure/store',
    purpose: 'What is on the shelf, by product and batch, and everything that changes it.',
    tasks: ['Stock: products and batches with what is available.', 'Expiry: batches that are expired or close to it.', 'Adjustments: write stock off or correct it, with a reason.', 'Count: count the shelf against the books.', 'Shifts, Transfers and Cash: shift reports, stock moved between stores, and the cash book.'],
    who: 'Store heads and the owner.',
    watch: ['Every adjustment needs a reason, and a large one needs approval.'], keywords: 'stock batch expiry adjustment count transfer cash',
  },
  {
    id: 'nav-stock-audits', group: 'stock', title: 'Stock audits', route: '/secure/stock-audits',
    purpose: 'Planned counts of the stock, with the differences settled and signed off on paper.',
    tasks: ['Due, Overdue and Mine: the audits to do, who does them and by when.', 'Do an audit: the count screen opens for that audit.', 'Settle each difference with a reason, then sign off (a different person from the counter).', 'Done: the count sheet, variance report, adjustments and certificate of each audit.', 'Plans: how often each store is audited (the Business Head sets them).'],
    who: 'Store heads and the owner.',
    watch: ['Sign-off is blocked while any difference is still waiting.', 'Late bills written by hand must be entered before an audit is settled.'], keywords: 'audit count variance certificate plan sign off',
  },
  {
    id: 'nav-outage', group: 'stock', title: 'Outage kit', route: '/secure/outage',
    purpose: 'Being ready to bill by hand when the system is down.',
    tasks: ['Tick each item of the kit once you have seen it yourself.', 'Print the price list and keep it at the counter.', 'Log each outage with the first and last hand-written bill number.'],
    who: 'Store heads.', watch: ['The kit counts as ready only when every item is ticked.'], keywords: 'power cut manual bill price list',
  },
  {
    id: 'nav-schedule-register', group: 'stock', title: 'Drug register', route: '/secure/schedule-register',
    purpose: 'Every Schedule H, H1 and X drug sold, with the patient and the prescriber, numbered in the register\'s own order.',
    tasks: ['Look up, print or download the register for a period.', 'Missing details: bills completed without the patient and prescriber; add them here.', 'See how each supply stands with its prescription (attached, on file, to come, or a reason).', 'See how well the supplies were covered, by schedule and by who sold them.'],
    who: 'Store heads, the pharmacist and the owner.',
    watch: ['The register is what an inspector reads: keep it complete.'], keywords: 'h1 h x register inspector prescription',
  },

  // ---- purchasing
  {
    id: 'nav-purchases', group: 'buy', title: 'Purchase', route: '/secure/purchases',
    purpose: 'Buying: what to order, the invoices that come in, what you owe vendors, and the GST on purchases.',
    tasks: ['Ordering: requests, what to reorder, and purchase orders.', 'Invoices: choose the purchase order first (or none), enter the vendor\'s invoice header, add its items, verify them and complete it. Editing a draft invoice has the same header as a new one.', 'Pay vendors, hold or release an invoice, see what is overdue.', 'Vendors: the vendor list and each one\'s balance.'],
    who: 'Store heads, the purchaser and the owner.',
    watch: ['A rate that rose against the last purchase needs a reason, and a big rise needs a Store Head or Business Head.', 'A line in dispute is not counted until it is accepted or rejected.'], keywords: 'invoice vendor order challan payment grn',
  },
  {
    id: 'nav-purchase-requests', group: 'buy', title: 'Purchase requests', route: '/secure/purchases/my-requests',
    purpose: 'Ask for something to be bought and see what happened to it.',
    tasks: ['Add a request: what and how many. To ask for several products at once, use Add to the list; they are saved as one slip.', 'Follow it: open, ordered or declined. The list shows when each was asked, newest first.'],
    who: 'Staff who may ask but not buy.', keywords: 'request ask product',
  },
  {
    id: 'nav-vendor-issues', group: 'buy', title: 'Vendor issues', route: '/secure/vendor-issues',
    purpose: 'Goods returned or claimed back from a vendor (damaged, short, wrong or near expiry) until the vendor settles.',
    tasks: ['Record an issue against a vendor.', 'Track Active, Overdue and Settled.', 'Vendor scorecard: how each vendor performs.'],
    who: 'Store heads and the purchaser.', keywords: 'return vendor damaged short claim credit note',
  },

  // ---- accounts
  {
    id: 'nav-expenses', group: 'accounts', title: 'Expenses', route: '/secure/expenses',
    purpose: 'Money the shop spends, with the receipt, by category.',
    tasks: ['Record an expense: date, store, category, amount, GST and a photo of the receipt.', 'Set up a recurring expense, such as rent.', 'See which were paid from the cash drawer.'],
    who: 'Store heads and the owner.', watch: ['Spending without a receipt is flagged to the owner.'], keywords: 'expense receipt rent drawer',
  },
  {
    id: 'nav-digital-payments', group: 'accounts', title: 'Digital payments', route: '/secure/digital-payments',
    purpose: 'Checking that card and UPI payments on bills really reached the account.',
    tasks: ['Compare each bill with the Paytm or card statement and mark it.', 'Import the statement as a CSV; bills are matched by amount, time and the last 4 digits.', 'Look at payments with no bill.'],
    who: 'Store heads and the owner.', watch: ['A day\'s total here should equal the statement\'s total for the day.'], keywords: 'paytm upi card reconcile statement',
  },
  {
    id: 'nav-gst-filing', group: 'accounts', title: 'GST', route: '/secure/gst-filing',
    purpose: 'The monthly GST work: what was sold and bought, the totals for the return, and the rate changes.',
    tasks: ['Check the month\'s sales and purchase registers.', 'Monthly summary: the sales report in filing order (each rate with CGST and SGST, the returns, B2B and B2C, nil-rated, exempt and non-GST, and a check against the bills), with an Excel. Say once what kind of 0% supply each category is, as your CA advises.', 'Close the month once the figures are right.', 'Rate changes: see what a GST change does to stock and prices before it starts.', 'Fix products that have no HSN code.'],
    who: 'The owner and the accountant.', keywords: 'gst gstr hsn return filing rate change',
  },
  {
    id: 'nav-finance', group: 'accounts', title: 'Finance', route: '/secure/finance',
    purpose: 'The shop\'s money against the bank, and the records it must keep.',
    tasks: ['Import a bank statement from any bank.', 'Reconcile bank lines against payments and receipts.', 'Accounts: add or edit a bank account. One with no statement lines, imports, signed-off months or expenses can be deleted; any other is switched off instead.', 'Records: how long to keep accounts and drug records, and whether each month\'s records are complete.'],
    who: 'The owner and the accountant.', keywords: 'bank reconcile statement records retention',
  },

  // ---- people
  {
    id: 'nav-my-hr', group: 'people', title: 'My HR', route: '/secure/my-hr',
    purpose: 'Your own pay, attendance and leave.',
    tasks: ['See your pay structure and pay slips.', 'See your attendance and leave balance.', 'Apply for leave. The leave type shows any advice, such as the days of the month to prefer.'],
    who: 'Every member of staff with a staff record.', watch: ['Bank, PAN and Aadhaar are shown in part. Ask the Business Head to change them.'], keywords: 'pay slip leave attendance salary',
  },
  {
    id: 'nav-attendance-punch', group: 'people', title: 'Mark attendance', route: '/secure/attendance-punch',
    purpose: 'Clock in and out at the counter with your PIN and a photo.',
    tasks: ['Pick your name, enter your PIN and press In when you start.', 'Press Out when you finish. The camera takes a photo each time.'],
    who: 'Counter staff, on a registered store PC.', watch: ['It works only on a store PC the manager has registered.', 'Five wrong PINs lock you out for 10 minutes. Ask your manager for a new PIN.', 'One In and one Out a day. A second tap within a minute is ignored.'], keywords: 'attendance punch clock in out pin photo webcam',
  },
  {
    id: 'nav-attendance-review', group: 'people', title: 'Attendance review', route: '/secure/attendance-review',
    purpose: 'Check the days staff clocked, look at the photos and fix what is wrong, before payroll.',
    tasks: ['Days tab: choose the month. Needs review shows days waiting for you, and working days with no punch.', 'Press Approve if a day is right, or Change (Mark for a day with no punch) to set the status and times, with a note of at least three letters.', 'Press Photos to see who clocked In and Out.', 'Who punches (PINs) tab: switch a person on, give a new PIN or unlock them, or set a PIN yourself (4 to 6 digits).', 'Rules tab: how many days photos are kept (7 to 365) and the grace minutes before Late or Early out. Only the Business Head can change them.'],
    who: 'Store heads and the owner.', watch: ['Payroll cannot be worked out or approved while a Pending or Missing day is left for staff who clock in.', 'Photos are deleted after 60 days.'], keywords: 'attendance review approve correct photo pin missing payroll',
  },
  {
    id: 'nav-kpi-mine', group: 'people', title: 'My KPI', route: '/secure/kpi/mine',
    purpose: 'How your month is scored, and the evidence behind each score.',
    tasks: ['See each measure and your score.', 'Open one to see the sales, shifts and other records it comes from.', 'See the incentive your band pays: a fixed amount, paid in proportion to the days you worked.'],
    who: 'Staff on a KPI plan.', keywords: 'kpi score incentive',
  },
  {
    id: 'nav-hr', group: 'people', title: 'Staff and HR', route: '/secure/hr',
    purpose: 'The people who work for the shop: their pay, attendance, leave and payroll.',
    tasks: ['Coaching: for each person and month, a note to talk through with them (what went well, where to focus, a tip), written from their KPI, attendance and sales. You edit it and choose whether they see it.', 'Staff: add your team to HR and give each a start date and pay.', 'Setup: pay, job roles, leave, holidays and KPI.', 'Role assistant: the AI drafts a job role, its KPIs and incentive amounts for you to approve.', 'Attendance: mark absences and half days.', 'Payroll waits for the attendance review of staff who clock in at the counter: the Payroll tab lists the days still to review and who they belong to, with a link to the review.', 'Payroll: work out and approve the month\'s pay; add bonuses.'],
    who: 'The Business Head and the owner.', watch: ['An approved month is locked.'], keywords: 'staff payroll attendance holiday bonus salary job role assistant ai incentive',
  },
  {
    id: 'nav-leave-approvals', group: 'people', title: 'Leave requests', route: '/secure/leave-approvals',
    purpose: 'Leave staff have asked for, waiting for a decision.',
    tasks: ['Read the request and approve or decline it.', 'Leave types can carry advice (for example, in a pharmacy, store staff are advised to take casual leave between the 11th and 25th and not on a Saturday or Sunday). Staff see it when they apply; it advises and does not block.'],
    who: 'Store heads and the owner.', keywords: 'leave approve decline',
  },
  {
    id: 'nav-kpi-rate', group: 'people', title: 'Rate staff', route: '/secure/kpi/rate',
    purpose: 'Scoring the measures the system cannot work out itself.',
    tasks: ['Choose a person and a month and give each measure a rating.', 'Finalise the month so payroll can use it.', 'The bell reminds you when last month\'s ratings are due, and when a person is behind pace.'],
    who: 'Store heads and the owner.', keywords: 'kpi rating review staff',
  },

  // ---- oversight
  {
    id: 'nav-compliance', group: 'oversight', title: 'Compliance', route: '/secure/compliance',
    purpose: 'The regular duties of the shop (counts, shift closes, reviews, licences), who owns each and whether it is on time.',
    tasks: ['See what is due, late or escalated.', 'Give a waiver, with a reason, for a duty that cannot be done in time.'],
    who: 'Store heads and the owner.', watch: ['A late duty rises step by step: a reminder, then the store head, then the owner, then a block.'], keywords: 'compliance late waiver escalate duty licence',
  },
  {
    id: 'nav-review', group: 'oversight', title: 'Weekly review', route: '/secure/review',
    purpose: 'Once a week: see what looks unusual, ask about it, then sign the week.',
    tasks: ['Start with the tiles and "Look at these first": each flagged item says what is unusual and jumps to its detail.', 'Check tab: cash drawers, pay later, and the lists of discounts, items below the list price, discarded and edited bills and returns.', 'This week in numbers and Over time and people: the comparisons with what is normal for these days, month to date, a year ago and each person.', 'Sign the week; a note is optional.'],
    who: 'The owner and store heads.', keywords: 'weekly review exception void edit',
  },
  {
    id: 'nav-quality', group: 'oversight', title: 'Staff and quality', route: '/secure/quality',
    purpose: 'Who did what, and where things went wrong: cash that did not balance, complaints and the audit trail.',
    tasks: ['Audit log: who did what and when (it cannot be edited).', 'Cash and shift differences.', 'Customer complaints and whether they were settled in time.'],
    who: 'The owner and store heads.', keywords: 'audit log grievance complaint cash difference',
  },

  // ---- learn
  {
    id: 'nav-pharmacy-guide', group: 'learn', title: 'Pharmacy guide', route: '/secure/pharmacy-guide',
    purpose: 'The rules of retail pharmacy in everyday words: schedules, prescriptions, licences and records.',
    tasks: ['Follow the Day 1 and Day 2 learning path.', 'Look something up when you are not sure at the counter.', 'Test yourself with the quiz.'],
    who: 'Everyone, and new staff especially.', keywords: 'training law schedule prescription licence',
  },
  {
    id: 'nav-knowledge', group: 'learn', title: 'Knowledge check', route: '/secure/knowledge',
    purpose: 'Five short questions a week to keep what matters fresh, with the right answer and why after each one.',
    tasks: ['Take this week\'s check (one counted attempt a week), or practise as much as you like.', 'See the topics to read again and your past checks.', 'Store heads and the owner: see who has done it and the topics that need another look.'],
    who: 'Everyone. The results are for coaching and do not count towards pay or any KPI.',
    watch: ['If several people share one login, the results are kept against the login.'], keywords: 'quiz test questions learn weekly coaching',
  },
  {
    id: 'nav-app-guide', group: 'learn', title: 'App guide', route: '/secure/app-guide',
    purpose: 'This page: what each page of the app is for and how to do the common jobs.',
    tasks: ['Start with Your day.', 'Search for a page or a job.', 'Follow a walk-through step by step.'],
    who: 'Everyone, for the pages their login opens.', keywords: 'help how to guide',
  },

  {
    id: 'nav-feedback', group: 'learn', title: 'Help and feedback', route: '/secure/feedback',
    purpose: 'Tell us when something in the app is wrong, ask a question, or suggest a feature, and read the answer.',
    tasks: ['Report or suggest: choose what it is, the module and the part of the app, say what happened or what you want, and attach a screenshot if it helps.', 'My reports: see each report, its status and the replies; write back when asked, say "this solved it", or reopen it.', 'Inbox: for the people who answer. Reply, leave an internal note, set the status (answered, planned, not planned, already reported) and assign a report.'],
    who: 'Everyone can send and read their own reports. Owners answer from the Inbox.',
    watch: ['Do not put customer names, phone numbers or patient details in a report or a screenshot.', 'The round button at the bottom right of any screen opens the form over the screen you are on.'],
    keywords: 'help feedback report issue bug problem suggestion suggest feature question support',
  },

  // ---- setup
  {
    id: 'setup-business-profile', group: 'setup', title: 'Business details', route: '/secure/settings/business-profile', needs: ['businessprofile'],
    purpose: 'The shop\'s name, address, GSTIN, phone numbers and logo, and what the bill prints.',
    tasks: ['Fill in the name, address and phones; add the logo.', 'Add a grievance phone and the website for the end of the bill.', 'Choose whether the bill shows the MRP of each item and the "You saved" box.'],
    who: 'The Business Head.', keywords: 'business name gstin logo bill phone website',
  },
  {
    id: 'setup-shop-setup', group: 'setup', title: 'Shop setup', route: '/secure/settings/business-profile/setup', needs: ['businessprofile'],
    purpose: 'A short checklist for getting a new shop ready to bill.',
    tasks: ['Work through the steps in order; each shows when it is done.'], who: 'The Business Head.', keywords: 'setup start checklist onboarding',
  },
  {
    id: 'setup-roles', group: 'setup', title: 'Roles', route: '/secure/settings/roles', needs: ['roles'],
    purpose: 'What each kind of login may open and do.',
    tasks: ['Create a role from a template or from scratch.', 'Choose the pages and actions a role may use.'],
    who: 'The Business Head.', watch: ['A change takes effect the next time the person signs in.'], keywords: 'role permission access',
  },
  {
    id: 'setup-users', group: 'setup', title: 'Users', route: '/secure/settings/users', needs: ['users'],
    purpose: 'The logins of the people who use the app.',
    tasks: ['Add a user, give a role and the stores they work in.', 'Switch someone off, or remove them (a person with records cannot be removed; switch them off).'],
    who: 'The Business Head.', keywords: 'user login password store',
  },
  {
    id: 'setup-delivery-partners', group: 'setup', title: 'Delivery partners', route: '/secure/settings/delivery-partners', needs: ['purchases'],
    purpose: 'The couriers and delivery people the shop uses.',
    tasks: ['Add or edit a delivery partner.'], who: 'Store heads.', keywords: 'delivery courier',
  },
  {
    id: 'setup-ai-assistant', group: 'setup', title: 'AI assistant', route: '/secure/settings/business-profile/ai', needs: ['businessprofile'],
    purpose: 'The key the assistants use, how much they may be used each month, and which model does which job.',
    tasks: ['Key: the Business Head pastes it (OpenRouter or Anthropic), presses Save key, then Test. It is kept encrypted and never shown again.', 'Use: see the requests made this month against a monthly limit (300 to start; 0 means no limit), and what they went on. When the limit is reached every assistant stops until next month or until you raise it.', 'Models: choose a default model, then optionally a model for each level of difficulty (Simple, Standard, Complex) or for a single assistant. A job uses its own model, else the one for its level, else the default.', 'Suggest a spread (a direct Anthropic key) fills a small, a mid and a large model for the three levels.'],
    who: 'The Business Head.', watch: ['Only anonymous totals leave the server to the model, never names, salaries or bills.', 'A cheaper model saves money on short jobs; give KPI drafts the most capable one.'], keywords: 'ai assistant key model openrouter anthropic limit usage cost haiku sonnet opus complexity',
  },
  {
    id: 'setup-alerts', group: 'setup', title: 'Alerts', route: '/secure/settings/alerts', needs: ['alerts.manage'],
    purpose: 'What the shop is told about, who is told and how loudly, and whether alerts also go to staff on Telegram.',
    tasks: ['Switch a built-in alert on or off and change its numbers.', 'Add your own alert, or describe it in a sentence (the assistant drafts it once its key is added under Settings > AI assistant).', 'Add the Telegram bot of the shop (Add the bot) and see who has connected and how the messages went.'],
    who: 'The Business Head.', keywords: 'alert rule telegram notification',
  },
  {
    id: 'setup-dashboards', group: 'setup', title: 'Dashboards', route: '/secure/settings/dashboards', needs: ['dashsetup.view'],
    purpose: 'What the dashboard and the store health score measure for this shop.',
    tasks: ['Set goals and the thresholds for badges and compliance.', 'Choose what counts in the store health score.'], who: 'The Business Head.', keywords: 'dashboard goals health badges',
  },
  {
    id: 'setup-store', group: 'setup', title: 'Store settings', route: '/secure/settings/store', needs: ['storesettings'],
    purpose: 'Each store\'s address, phone, licences, review link and opening details.',
    tasks: ['Add the drug licence numbers and dates.', 'Add the store\'s own address and phone for its bills.', 'Paste the Google review link for the QR on the bill.'],
    who: 'The Business Head and store heads.', keywords: 'store licence address review qr',
  },
  {
    id: 'setup-businesses', group: 'setup', title: 'Businesses', route: '/secure/settings/businesses', needs: ['businesses.manage'],
    purpose: 'Creating and managing businesses on a self-hosted system.',
    tasks: ['Add or edit a business.'], who: 'The site administrator.', keywords: 'business tenant admin',
  },
];

// ------------------------------------------------------------------------------------------------ the jobs, step by step
export const WALKTHROUGHS: Walkthrough[] = [
  {
    id: 'w-bill', title: 'Make a bill', from: 'nav-sales',
    steps: ['Open Sales and billing. Make sure your shift is open (My shift).', 'Type the customer\'s mobile number; pick them if they are listed, or add the name.', 'Type the product name or its composition in the product box and press Enter on the one you want. The batch to sell first is marked.', 'Type the units. The rate, GST and amount fill in.', 'Choose how they pay: cash, card or UPI, or a split.', 'Press Complete. The bill opens; press Print.'],
    tips: ['Save for later if the customer steps away; the sale stays as a tab.', 'The total is the lines added up with their paise, rounded once to the nearest rupee; the bill shows the round-off.'], keywords: 'bill sale pos print',
  },
  {
    id: 'w-scheduled', title: 'Sell a scheduled drug (H, H1, X)', from: 'nav-sales',
    steps: ['Add the medicine to the sale. A "Scheduled drugs on this bill" panel appears.', 'If the customer is on record, "Already on record" may offer their prescription or the last supply: press Use it.', 'Otherwise type the patient and the doctor, with the doctor\'s registration number or address.', 'Say how the prescription stands: attached, seen, or why there is none. For "Will bring it later" give the day and make sure the customer is on the bill.', 'Complete the bill.'],
    tips: ['Schedule X cannot be completed without the details; H and H1 can, and are then listed in the Drug register as missing them.', 'A prescription on file older than six months, or for a medicine not marked chronic, is flagged: ask for a fresh one.', 'Upload the prescription picture in the panel to keep it with the customer.'], keywords: 'h1 prescription register patient doctor',
  },
  {
    id: 'w-return', title: 'Take a return', from: 'nav-sales',
    steps: ['Open Sales and billing, then Returns.', 'Find the bill by its number or the customer.', 'Choose the items and the units coming back, and the reason.', 'Save it. The refund follows how the bill was paid.'],
    tips: ['Only goods that may be returned can be chosen. A medicine that has left the shop cannot go back on the shelf for resale.'], keywords: 'return refund exchange',
  },
  {
    id: 'w-shift', title: 'Open and close your shift', from: 'nav-shift',
    steps: ['Open My shift. Enter the cash in the drawer and open it.', 'Bill through the day.', 'At the end press Close. Count the cash by denomination and enter what each card or UPI terminal shows.', 'Do the checklist items, or give the reason one cannot be done.', 'Submit. A difference is shown to your store head.'],
    tips: ['Close every shift: an unclosed one can stop the next from opening.'], keywords: 'shift cash drawer close open',
  },
  {
    id: 'w-purchase', title: 'Receive a purchase invoice', from: 'nav-purchases',
    steps: ['Open Purchase, then Invoices, then Add New. Choose the vendor and give the invoice number (or the challan number if the invoice has not come).', 'Add each item: product, batch, expiry, MRP, units, free units, rate, discount and tax. The tax is chosen from your list of rates.', 'Look at the flags: a rate that rose, an MRP far above the rate, a new product\'s margin.', 'Select the lines and press Verify.', 'When every line is verified, press Complete.', 'After completing, give new products their first price (Products and prices > Needs a price).'],
    tips: ['Check the printed total at the bottom against the vendor\'s invoice.', 'Expiry is needed on every line except a product that never expires.'], keywords: 'invoice grn challan vendor receive',
  },
  {
    id: 'w-dispute', title: 'Deal with a rate rise or a line you do not agree with', from: 'nav-purchases',
    steps: ['On the invoice, look at the "Vs last" column: a rise over the limit needs a reason.', 'If you accept the new rate, choose the reason (price revised, new batch, scheme ended, vendor error or pack changed).', 'If the vendor must clarify it, select the line and press Move to dispute, with a note of what to ask.', 'The line leaves the invoice total. When the vendor answers, press Accept (it comes back to be verified) or Reject (with the reason).', 'Complete the invoice once nothing is in dispute.'],
    tips: ['A rise above the approval limit can only be completed by a Store Head or Business Head.'], keywords: 'dispute reject price rise',
  },
  {
    id: 'w-price', title: 'Set or change a price', from: 'nav-products',
    steps: ['Open Products and prices, then Price (or Needs a price for a new product).', 'Open the product\'s Set the price box. It shows the lowest and highest price allowed and a suggested price.', 'Type the price. A warning says if it breaks a rule and who must approve it.', 'Save. A raise is stepped: a big one happens in steps over days.'],
    tips: ['The price can never be above the MRP.'], keywords: 'price mrp policy approve raise cut',
  },
  {
    id: 'w-count', title: 'Count the stock', from: 'nav-store',
    steps: ['Open Stock, then Count, and choose the store and the category.', 'Start the count; print the count sheet if you want a paper copy.', 'Count the shelf and enter the counted units for each batch.', 'Submit. Differences become adjustments to settle.'],
    tips: ['Sales made during the count are not shortages: the difference is measured against what should be there when counting finished.'], keywords: 'count stocktake shelf',
  },
  {
    id: 'w-audit', title: 'Do a stock audit and sign it off', from: 'nav-stock-audits',
    steps: ['Open Stock audits. Under Due, press Do the audit and count as above.', 'After the count, open Stock > Adjustments. For each difference, press Approve and choose why it arose, or Reject with a reason.', 'A large difference is counted again by another person before the Business Head settles it.', 'Back in Stock audits, once nothing is waiting, a different person from the counter presses Sign off.', 'Print the certificate and sign it with the person who counted.'],
    tips: ['Done > Adjustments shows what an audit raised, with the reasons.'], keywords: 'audit sign off certificate variance difference',
  },
  {
    id: 'w-adjust', title: 'Adjust stock with a reason', from: 'nav-store',
    steps: ['Open Stock, find the product and batch, and press Adjust.', 'Enter the units to add or remove, choose the reason (damaged, expired, returned to vendor, shrinkage, correction or other) and add a comment.', 'If the adjustment is for an audit, choose the audit.', 'Save. A large one waits for approval.'],
    tips: ['An approved adjustment cannot be deleted: make an opposite one instead.'], keywords: 'adjust write off damaged expired shrinkage',
  },
  {
    id: 'w-contact', title: 'Call your regular customers', from: 'nav-customers',
    steps: ['Open Customers, then Contact today.', 'Each row says why: owes money, due back, slipping away or new. Customers who owe money come first, with the amount.', 'Choose English or Tamil for the message; Change the message wording to edit it, or have the assistant write a first version.', 'Press Show number if it is masked, then call or WhatsApp.', 'Choose what came of it and press Log. They leave the list for the contact gap.', 'Not today? Press Postpone a day and give the reason.'],
    tips: ['Prescriptions to collect appear at the top: open the customer, upload the prescription and the item closes by itself.'], keywords: 'contact worklist refill call whatsapp',
  },
  {
    id: 'w-register-details', title: 'Add details to a scheduled sale made without them', from: 'nav-schedule-register',
    steps: ['Open Drug register. The banner lists sales with no register line, with the reason the bill gave.', 'Press Add details beside a bill.', 'Give the patient and the prescriber (use what is on record if offered) and how the prescription stands.', 'Press Add to the register. The line is numbered and dated as the bill.'],
    keywords: 'register missing details h1',
  },
  {
    id: 'w-expense', title: 'Record an expense', from: 'nav-expenses',
    steps: ['Open Expenses and add one.', 'Give the date, store, category, amount and GST, and add a photo of the receipt.', 'Say if it was paid from the cash drawer.', 'Save.'],
    tips: ['Set up rent and other repeating costs as recurring.'], keywords: 'expense receipt',
  },
  {
    id: 'w-digital', title: 'Check card and UPI payments', from: 'nav-digital-payments',
    steps: ['Open Digital payments.', 'Import the statement (CSV) for the day or month.', 'Bills are matched to payments; confirm each match or mark it.', 'Look at payments with no bill and bills with no payment.'],
    tips: ['A day\'s total should equal the statement\'s total.'], keywords: 'paytm card upi reconcile',
  },
  {
    id: 'w-hr-team', title: 'Add your team to HR', from: 'nav-hr',
    steps: ['Open Staff and HR, then Staff.', 'In "Add your team to HR", set what each person is, their job role and the day they started.', 'Press Add to HR.', 'For each person added, press Set salary, or Start from the job role\'s pay.'],
    tips: ['Set the pay, job roles, leave and holidays first under Setup.'], keywords: 'staff hr add salary job role',
  },
  {
    id: 'w-leave', title: 'Approve leave', from: 'nav-leave-approvals',
    steps: ['Open Leave requests.', 'Read the request: who, which days and why.', 'Approve or decline, with a note if you decline.'],
    tips: ['The leave advice is shown to the person applying (My HR). The decision stays with you.'], keywords: 'leave approve decline policy advice',
  },
  {
    id: 'w-punch', title: 'Mark your attendance', from: 'nav-attendance-punch',
    steps: ['Open Mark attendance on the store PC and allow the camera.', 'Choose your name and enter your PIN.', 'Press In. Look at the camera; the photo is taken.', 'At the end of the day open it again and press Out.'],
    tips: ['Forgot to press Out? Tell your store head: they correct the day in Attendance review.', 'Locked out after wrong PINs? Wait 10 minutes or ask your manager for a new PIN.'], keywords: 'attendance punch clock in out pin',
  },
  {
    id: 'w-att-review', title: 'Review attendance before payroll', from: 'nav-attendance-review',
    steps: ['Open Attendance review and choose the month.', 'Go through the days that need review. Press Photos if you doubt one.', 'Press Approve if the day is right, or Change and set the status and times, and write the reason.', 'When it says nothing to review, payroll can be worked out.'],
    tips: ['Leave, holidays and weekly offs are not shown as Missing.', 'Set or reset a person\'s PIN on the Who punches (PINs) tab.'], keywords: 'attendance review approve correct missing payroll pin',
  },
  {
    id: 'w-ai-role', title: 'Draft a job role, KPIs and incentives with the assistant', from: 'nav-hr',
    steps: ['Open Staff and HR, then Role assistant. Choose a role and press Set up (or Set up all roles).', 'Description: press Draft with AI, edit the purpose and responsibilities, then Approve and save.', 'KPIs: press Draft KPIs with AI. The weights total 100 and the targets come from your own past figures. Remove any you do not want, then press Add these KPIs.', 'Incentives: press Draft incentive bands with AI. Each band is a fixed amount. Press Check the cost, then Use these bands.', 'Reminders: press Create the reminders to give each person in the role a weekly and monthly to-do.'],
    tips: ['Nothing is used until you approve it.', 'Only anonymous totals go to the AI, never names, salaries or bills.', 'It needs the key under Settings > AI assistant. Bands are refused if the worst-case cost goes over the incentive ceiling at the top of the page.'], keywords: 'ai assistant job role kpi incentive band draft',
  },
  {
    id: 'w-knowledge', title: 'Take the weekly knowledge check', from: 'nav-knowledge',
    steps: ['Open Knowledge check and press Start this week\'s check.', 'Read each question and choose an answer. The right answer and why show at once.', 'Press Next, and Finish after the last one.', 'Read the topics it lists again. Practise as often as you like: only the weekly check is recorded.'],
    tips: ['A scored check is one a week (Monday to Sunday). You can leave and carry on later.'], keywords: 'quiz test weekly practise',
  },
  {
    id: 'w-telegram', title: 'Get alerts on Telegram', from: 'bell',
    steps: ['Open the bell, then Notifications. Press Connect Telegram.', 'Press Open Telegram and then Start in the chat. This page shows Connected.', 'Choose which level you want and your quiet hours, and press Save.', 'Press Send a test to check.'],
    tips: ['Critical alerts come at any hour; the others wait until quiet hours end.', 'Send /stop to the bot to stop them.'], keywords: 'telegram alerts phone',
  },
  {
    id: 'w-ask-shop', title: 'Ask the shop a question', from: 'nav-reports',
    steps: ['Open Reports, then the Ask the shop tab.', 'Type your question in your own words, for example who sold the most this month, or what stock will not sell before it expires. Press Ask.', 'Read the line that says how it was understood, then the table. If it picked the wrong report or period, press a report button and choose the period yourself.', 'Without the assistant the report buttons still work.'],
    tips: ['The answer comes from your own records. The assistant only chooses which report to run; it never sees the numbers and never makes one up.', 'A Store Head sees only their own stores, and not profit or customer dues.'], keywords: 'ask question report ai margin profit top products',
  },
  {
    id: 'w-weekly-summary', title: 'Read the weekly summary', from: 'nav-reports',
    steps: ['Open Reports, then the Weekly summary tab. Last week is made every Monday at 8 in the morning.', 'Read the headline, then Went well, Watch and Do first.', 'Press Send to Telegram now to send it to your phone, or switch Send to my Telegram on to get it every Monday.', 'Press Refresh last week to make it again from the latest figures.'],
    tips: ['It covers Monday to Sunday and compares with the week before.', 'Staff names are never sent to the assistant.'], keywords: 'weekly summary monday owner telegram',
  },
  {
    id: 'w-coaching', title: 'Write a coaching note for a staff member', from: 'nav-hr',
    steps: ['Open Staff and HR, then the Coaching tab. Choose the month.', 'Pick a person. Their KPI, days present, bills served and leave are shown.', 'Press Write the note. Read each part and change what you like.', 'Tick Share if you want the person to see the first three parts under My KPI, then press Save.', 'Use the part For you to say in the conversation to open the talk kindly.'],
    tips: ['Nothing is shown to the person until you share it. Writing the note again stops the sharing.', 'No names or pay figures are sent to the assistant, only the numbers.'], keywords: 'coaching feedback staff talk kpi attendance',
  },
  {
    id: 'w-telegram-setup', title: 'Set up the Telegram bot for the shop (Business Head, once)', from: 'setup-alerts',
    steps: [
      'On your phone or computer, open Telegram and search for @BotFather (the one with the blue tick). Press Start.',
      'Send /newbot. BotFather asks for a name (shown in chats, for example "RGP Alerts") and then a username. The username must end in bot, for example rgp_shop_alerts_bot, and must not be taken.',
      'BotFather replies with a long token that looks like 123456789:AAH... Copy the whole token. Anyone who has it can use the bot, so do not post it in a chat or a screenshot.',
      'In the app open Settings > Alerts. In the Alerts on Telegram box press Add the bot.',
      'Paste the token. In App address type the web address people use to open this app, starting with https:// (for example https://ops.myrgp.in). Messages use it to link back to the right page. Leave it empty if you do not want links.',
      'Press Check and save. The app asks Telegram whether the token is real and shows the name of the bot. A wrong or half-copied token is refused and nothing is saved.',
      'Switch on Send alerts to staff on Telegram in the same box.',
      'Tell staff to open the bell, then Notifications, press Connect Telegram, and press Start in the chat. Their name then appears under Connected in your box.',
      'Optional: for the daily digest to a store group, create a Telegram group, add the bot to it, type /chatid in the group, and the bot replies with the chat ID. Paste that under Settings > Notifications against the store and press Send test.',
    ],
    tips: [
      'Each person gets only the alerts they can see in the app, at the level they choose. Critical alerts come at any hour; the rest wait until their quiet hours end (22:00 to 07:00 unless they change it). Nobody gets more than 12 a hour below critical.',
      'A bot can only message someone who pressed Start, so people must connect themselves. If someone blocks the bot or presses /stop, their row shows Blocked or Stopped and they can reconnect from Notifications.',
      'Use a separate bot for a test copy of the app. Two copies using the same token take messages from each other.',
      'To change the bot, press Add the bot again and paste the new token. Remove from the app takes the saved bot away.',
      'If Check and save says Telegram could not be reached, the server has no route to the internet or Telegram is blocked from it. Ask whoever hosts the app.',
    ],
    keywords: 'telegram bot botfather token setup alerts digest',
  },
];

// ------------------------------------------------------------------------------------------------ your day
export const DAYS: DayPlan[] = [
  {
    kind: 'counter', label: 'Counter',
    intro: 'Your work is the counter: the bill, the customer and the shift.',
    daily: ['Mark attendance (In) when you arrive, and Out when you leave.', 'Open your shift (My shift) before the first bill.', 'Bill customers (Sales and billing). Check the medicine, batch and expiry each time.', 'For a scheduled drug, fill the patient and prescriber panel.', 'Call the refills that are due (Refills or Customers > Contact today).', 'Close your shift: count the cash and enter the card and UPI totals.'],
    weekly: ['Take the weekly Knowledge check (five questions).', 'Look at your KPI (My KPI) and your leave (My HR).', 'Read the part of the Pharmacy guide you are least sure of.'],
    monthly: ['Check your pay slip in My HR.'],
  },
  {
    kind: 'storehead', label: 'Store Head',
    intro: 'You run the store: the stock, the people at the counter and the money at the end of the day.',
    daily: ['Look at the bell: approvals and anything late.', 'Check Attendance review: approve or correct yesterday\'s days and fill in a forgotten Out.', 'Settle stock adjustments waiting for approval (Stock > Adjustments).', 'Check the shifts that closed with a difference.', 'Receive deliveries and complete invoices (Purchase).', 'Check expiry (Stock > Expiry) and bank the cash when the alert says.'],
    weekly: ['Take the weekly Knowledge check and look at the team\'s results (Knowledge check > Team).', 'Do the stock counts and audits that are due (Stock audits).', 'Do the weekly review.', 'Print the outage price list and check the kit.', 'Approve leave and rate staff (People).'],
    monthly: ['Check the Drug register is complete and print it.', 'Look at payables and vendor issues.', 'Close the month\'s KPI ratings.', 'Clear Attendance review (nothing Pending or Missing) so payroll can run.'],
  },
  {
    kind: 'owner', label: 'Business Head / Owner',
    intro: 'You see the whole business: what to look at each day, week and month.',
    daily: ['Open the Dashboard and the bell: what needs you.', 'Check cash and deposits, and anything escalated in Compliance.', 'Look at approvals waiting for you (large stock differences, price rises, adjustments).'],
    weekly: ['Do the Weekly review.', 'Look at Knowledge check > Team: who has done it, and which topics need coaching.', 'Look at Compliance: late and escalated duties.', 'Look at Contact today and Refills with your staff.', 'Check Digital payments against the statements.'],
    monthly: ['Close the GST month and check the registers.', 'Approve payroll and KPI (attendance review must be clear first).', 'Use the Role assistant when a role changes or a new one is added.', 'Reconcile the bank (Finance) and check the Records.', 'Look at stock audits done and certified, and the Drug register coverage.'],
  },
  {
    kind: 'other', label: 'Your role',
    intro: 'This is the usual rhythm for the pages your role opens. Start with the bell and the pages below.',
    daily: ['Open the Dashboard and the bell.', 'Do the work of the pages in the guide below.'],
    weekly: ['Look through your pages for anything overdue.'],
    monthly: ['Ask your manager what is needed at month end for your pages.'],
  },
];
