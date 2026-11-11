# Finance statements: payables, income statement, balance sheet and cash flow, by store

Status: **scoped and recorded, not built** (2026-11-11). Decisions by the product owner: the statements are for **owner insight at each store**, and they must be **CA compliant** (the figures must follow accepted accounting treatment and be traceable, so the CA can rely on and reconcile to them). Nothing in this document has been implemented.

This is a scope, not legal or accounting advice. Every treatment marked **[CA]** is an assumption to be confirmed by the owner's chartered accountant before it is built.

## 1. What "owner insight, CA compliant" means here

- **Owner insight:** a monthly picture per store: what was sold, what it earned, what is owed, where the cash went, what the store is worth. Drill down from every figure to its bills, invoices or payments.
- **CA compliant:** the same figures could be handed to the CA without being redone. In practice that means:
  1. **Accrual basis** (a sale or purchase counts when it happens, not when it is paid) for the income statement and balance sheet; the cash flow is on a cash basis.
  2. **Double entry**: a trial balance that balances, with ledgers behind every line. A balance sheet that only balances because equity is a plug is *not* acceptable here.
  3. **Consistent, written accounting policies** (stock valuation, discounts, returns, GST, write-offs). **[CA]**
  4. **GST kept out of revenue and cost**, with output tax, input credit and payments in their own accounts, agreeing to the GST returns.
  5. **Cut-off and period locks**: a closed month cannot change without a recorded reversal; an audit trail of who posted or changed what.
  6. **Sub-ledgers agree to the ledger**: payables = unpaid invoices; stock = stock valuation; cash = counted cash; bank = statement.
  7. **Retention of 8 years** (already the app's rule for records).
- **Not the goal:** statutory filing of the financial statements, income-tax computation, depreciation under the Income-tax Act, or audit reports. The CA does those from the app's export.

## 2. The chosen approach

A **double-entry journal layer, posted automatically from the events the app already records**, with the **store as a dimension** on every line. Statements are produced from the trial balance. This was chosen because "CA compliant" needs a real ledger; reports computed straight from operational tables cannot give a balance sheet that stands on its own.

- **Chart of accounts**: a standard pharmacy-retail chart (section 5), each account mapped to the CA's ledger names so export is mechanical. **[CA]**
- **Posting rules**: one rule per event type (section 6). Posting is **idempotent** (an event posts once; a changed event posts a reversal and a new entry), in the same transaction as the event where practical, otherwise by a worker that can be re-run.
- **Manual journals**: for what the app cannot know (capital, drawings, loans, depreciation, provisions, corrections). Restricted to a role, with a reason, audited, and visibly marked "manual".
- **Branch accounting**: each store keeps its own books; the **head office / inter-branch account** balances a store's balance sheet. Stock transfers between stores post at cost to inter-branch accounts that cancel out when the stores are added together. The business as a whole is the sum of the stores plus a head-office "store" for costs and balances that belong to no store (owner's capital, loans, central salaries). **[CA]**
- **Shadow mode first**: for the first quarter the ledger runs beside the CA's books and is compared; it is not relied on until the differences are explained.

## 3. The statements (all per store, all for any period or "as on" date)

| Statement | Basis | Per store means |
|---|---|---|
| **Payables** (ageing, vendor statements, due in 7/14/30 days) | Sub-ledger | The vendors' invoices received at that store |
| **Trading and income statement** | Accrual | Sales less returns less cost of goods sold = gross profit; then store expenses, salaries, bank and gateway charges = store operating profit. Head-office costs shown separately and optionally allocated (an owner setting). |
| **Balance sheet** | As on a date | The store's stock, cash, receivables and payables, balanced by the head-office / inter-branch account; the **business** balance sheet adds the stores and eliminates inter-branch |
| **Cash flow** | Cash basis, direct method for the owner, with the **indirect method** (profit to cash) as the CA's view, both reconciling to the bank and the tills | Receipts and payments by the store, opening and closing cash (tills, vault, bank) |
| **Trial balance and ledgers** | Accrual | The base of the above and what the CA checks |

Each statement carries a **confidence line** (section 8): the known gaps in the underlying records for that period, so a number is never shown without saying what could make it wrong.

## 4. Accounting treatments to confirm with the CA

1. **Legal form and year**: the app's business default is proprietorship; financial year April to March. Presentation follows the CA's format for the legal form (for a proprietorship: trading and profit and loss account plus balance sheet with capital and drawings). **[CA]**
2. **Stock valuation**: at the lower of cost and net realisable value. The app already tracks **batch cost** (each sold line links to its purchase batch), so cost of goods sold is **actual batch cost**; the closing stock is the unsold batches at cost. Expired and short-dated stock is written down or written off. **[CA]**
3. **Revenue**: bill value less GST; returns and credit notes reverse it; bill discounts reduce revenue; rounding off goes to an account of its own.
4. **Purchases**: invoice value without GST into stock; **cash discount** printed on the vendor invoice reduces the cost; input GST to the input credit account (eligibility and any blocked credit **[CA]**).
5. **Digital collections**: card and UPI sales are received as **settlements net of the gateway's fee** (and fee GST). The gross sale, the settlement and the fee are three separate figures; the fee is an expense with its GST. A *clearing account* holds the difference until the settlement arrives. This is the likely reason books and settlements differ today.
6. **Customer store credit** and advances are a **liability**; **dues** are a **receivable**; **staff credit** is a receivable recovered from salary.
7. **Cash short or excess** at shift close is an expense or income account, not an adjustment to sales.
8. **Stock adjustments and audits**: shortage and expiry write-offs are an expense (stock loss); excess is income or a correction, per policy. **[CA]**
9. **GST accounts**: output tax payable, input credit, and the monthly set-off and payment, agreeing to GSTR-3B. **[CA]**
10. **Fixed assets, depreciation, loans, capital, drawings, TDS, advance tax**: entered by manual journal. The app does not compute depreciation (**[CA]** decides the method and rates).
11. **Opening balances** at the go-live date, agreed with the CA's closing figures for the prior year.

## 5. Chart of accounts (starting point **[CA]**)

- **Assets**: Cash in till (per store); Cash in vault; Cash in transit (deposits); Bank (per account); Payment gateway clearing (per provider); Customer dues; Staff advances and credit; Vendor advances and debit notes due; Input GST credit; Stock at cost; Prepaid; **Investments (fixed deposits and others, per party)**; **Deposits and advances given (rent, utility, vendor and other, per party)**; **Employee loans and advances (per employee)**; Interest accrued; TDS receivable; Fixed assets (by class) and accumulated depreciation; Inter-branch (stores).
- **Liabilities**: Vendor payables; Output GST payable; Other taxes and TDS payable; Salary and statutory dues payable; Customer store credit and advances; Loans.
- **Equity** (proprietorship): Capital; Drawings; Current-year profit.
- **Income**: Sales (by store, by schedule of drug if wanted); Sales returns (contra); Discounts allowed (contra); Other income; **Interest income**.
- **Cost and expenses**: Cost of goods sold; Stock loss (shortage and expiry); Purchase discounts; Salaries; Rent; Electricity; Telephone and internet; Bank charges; Payment gateway fees; Delivery cost; Repairs; Other expenses by category; Cash short and excess; Depreciation; Interest; **Staff loans written off**.

## 6. How each event posts

| Event (already recorded by the app) | Entry |
|---|---|
| **Completed bill** | Dr Cash / Gateway clearing / Customer dues / Store credit / Staff advances for the parts paid; Cr Sales (without GST); Cr Output GST. **And** Dr Cost of goods sold, Cr Stock at the batch cost of the lines sold. |
| **Bill return or void** | The reverse of the bill, including stock at its original cost |
| **Purchase invoice received** | Dr Stock (net of cash discount); Dr Input GST; Cr Vendor payables |
| **Vendor payment** | Dr Vendor payables; Cr Bank or Cash |
| **Vendor return / debit note** | Dr Vendor payables; Cr Stock; Cr Input GST |
| **Expense** | Dr Expense by category (and Input GST if eligible); Cr Cash or Bank |
| **Payroll run** | Dr Salaries; Cr Salary payable; later Dr Salary payable, Cr Bank or Cash; staff credit recovered reduces the staff receivable |
| **Shift close** | Cash short or excess to its account; cash counted becomes the till balance |
| **Cash deposit to bank** | Dr Bank (or Cash in transit until it clears); Cr Cash in till or vault |
| **Gateway settlement** | Dr Bank; Dr Gateway fees and Input GST on the fee; Cr Gateway clearing |
| **Bank line not otherwise matched** | Tagged by the existing bank reconciliation, then posts to the tagged account (charges, interest, GST payment, owner drawings) |
| **Stock transfer between stores** | Dr Inter-branch (receiving store) and Cr Inter-branch (sending store) at cost, with the stock moving |
| **Stock adjustment / audit result / expiry write-off** | Dr Stock loss; Cr Stock (or the reverse for excess) |
| **GST payment** | Dr Output GST, Cr Input GST, Dr or Cr the difference to Bank |
| **Fixed deposit placed, interest, TDS, maturity** (section 15.1) | Dr Investments, Cr Bank; interest Dr Interest accrued (or Bank), Cr Interest income; TDS Dr TDS receivable; maturity Dr Bank, Cr Investments and Interest accrued |
| **Deposit or advance given, adjusted, refunded, forfeited** (15.2) | Dr Deposits and advances given, Cr Bank or Cash; adjusted against rent Dr Rent, Cr Deposit; refund Dr Bank, Cr Deposit; forfeited Dr Expense, Cr Deposit |
| **Employee loan or advance paid, recovered in payroll, settled** (15.3) | Dr Employee loans, Cr Cash or Bank; each payroll Dr Salaries (gross), Cr Employee loans (the instalment), Cr Salary payable (net); on exit the balance is taken from the final settlement |
| **Capital, drawings, borrowings, fixed assets, depreciation, provisions** | Manual journal |

## 7. Prerequisites: what must be fixed before the numbers can be trusted

These come from earlier findings and from this design. Phase 0 is mostly these.

1. **Invoice totals**: line totals were stored before tax and payables excluded GST. A correction script exists (`scripts/fix-invoice-totals.sh`, dry run by default) and **has not been run on the live data**. Invoices with payments or closed GST months were left alone and need a decision.
2. **Vendor payments missing in the books** (September 2026: none after July, while the bank shows 41 vendor debits). Needs **creating vendor payments from bank lines** (listed as not built in the finance module).
3. **Digital settlements**: books show more digital sales than Paytm settled (about Rs 44,700 in September). Needs settlement import with fee and GST per payout, and gross versus net handled as in section 4.
4. **Stock valuation reliability**: batches that were sold more than bought make stock negative in places. Needs the stock audit and adjustment trail to be complete, and a policy for expiry write-offs.
5. **GST payments and set-off** are not recorded anywhere yet.
6. **Opening balances and the head-office account** do not exist.
7. **Cash short and excess, deposits and vault** must post consistently with shift close (they are recorded; the mapping is new).

## 8. Controls and the confidence line

Each period shows these checks, and a failing check is stated on every statement for that period:

- Trial balance totals agree (debits equal credits), and per store.
- **Control accounts agree to sub-ledgers**: payables to unpaid invoices; stock to the stock valuation as on the date; till and vault to the counted cash; bank to the statement balance (the existing reconciliation).
- Sales in the ledger agree to the bills; output GST agrees to GST on bills; input credit to purchase invoices.
- **Events not yet posted** (for example a bill saved before the posting rule existed) and **posts that failed**.
- Bank lines untagged, settlements unmatched, vendor debits in the bank with no payment in the books.
- The sum of the stores equals the business, and inter-branch accounts net to zero.

## 9. Closing and the CA's use

- **Month close** by the Business Head locks the period (extending the bank reconciliation sign-off): no posting into a locked month except a dated reversal in the next open month with a reason.
- **Year close** (31 March) after the CA's adjustments; carries balances forward; produces an archive pack.
- **CA export**: vouchers (sales, purchases, receipts, payments, journals) as Excel and Tally-importable XML or CSV, with the ledger mapping; the trial balance, ledgers, payables and receivables listings; GST workings. **[CA]** confirms the format they want.

## 10. Screens (Finance, owner only, as today)

1. **Payables**: ageing by vendor, due in 7/14/30 days, vendor statement, "can we pay this week" against cash and bank. (Extends the existing payables and outstanding screens.)
2. **Statements**: period or "as on" date, store (each store or business), comparison with the previous period or year; income statement, balance sheet, cash flow, trial balance; every line drills to its ledger and then to its bill, invoice or payment.
3. **Cash forecast** (30/60/90 days): payables due, recurring expenses, payroll and average sales, against opening cash.
4. **Manual journals** and the **month close**, with the checks of section 8.
5. **CA export**.

## 11. Phases (rough effort in working days; to be firmed up after phase 0)

| Phase | What | Exit test | Effort |
|---|---|---|---|
| 0 | Decisions with the CA (section 4, 12), the prerequisites of section 7, chart of accounts agreed, opening balances | CA signs the chart and policies; fixes in place | 5 to 10 |
| 1 | Ledger core (accounts, store dimension, journals, idempotent posting, period lock, audit); purchases, vendor payments, expenses, payroll post; **payables screens** | Payables ledger equals unpaid invoices at every month end | 8 to 12 |
| 2 | Sales, returns and **cost of goods sold** post; **store income statement** | Ledger sales and GST agree to bills; gross margin explained for a sample month | 8 to 12 |
| 3 | Cash, deposits, shift variance, gateway settlements with fees, bank tagging post; **cash flow** | Cash and bank agree to counts and statements for three months | 8 to 12 |
| 4 | Stock adjustments and transfers; inter-branch; manual journals; **balance sheet**; month close | Balance sheet balances per store; stores sum to the business; stock ledger equals the stock valuation | 8 to 12 |
| 5 | CA export; **shadow quarter** compared with the CA's books | Differences explained and under the agreed tolerance | 5 + one quarter |

Total roughly 6 to 10 weeks of build plus a shadow quarter; the order lets the owner use payables and the income statement before the balance sheet exists.

## 12. Open questions

1. Legal form and the CA's preferred presentation (proprietorship accounts or otherwise); the financial year (April to March assumed).
2. Which accounting software does the CA use (Tally?), and what export do they want?
3. Stock valuation policy: actual batch cost (proposed), weighted average or FIFO; how short-dated and expired stock is written down.
4. Are head-office costs (owner's salary, central rent) **allocated to stores**, and on what basis (sales share, equal, none)?
5. Who may post manual journals: the owner, the CA, or both (and does the CA get a login)?
6. Opening-balance date and the CA's closing figures to start from.
7. Treatment of payment gateway fees and GST, and of the Paytm clearing account.
8. GST registration type and whether any credit is blocked or reversed (for example on expired stock written off).
9. Fixed assets: a simple register in the app, or only journals from the CA.
10. How long to run in shadow before the CA relies on it.
11. The questions in section 15.5 (fixed deposits, deposits with landlords and institutions, employee loans).

## 13. Risks

- **Coverage of events**: any event type that does not post makes the ledger incomplete. Mitigated by the "events not yet posted" check and by shadow mode.
- **Corrections of past data** (reopened bills, edited invoices): handled by reversal and re-post; locked months need a controlled path.
- **Mistaken confidence**: a statement shown over bad records. Mitigated by the confidence line and by refusing to close a month with failing checks.
- **Scope creep into statutory work**: depreciation, income tax and filings stay with the CA.
- **Performance** of posting on busy stores: posting is per event and indexed by store and date; the heavy work is monthly reporting, which reads the trial balance rather than the bills.

## 14. Not in scope

Statutory financial statements and audit reports; income-tax computation and filing; GST return filing (covered by its own plan in `GST_END_TO_END.md`); payroll statutory returns; budgeting; multi-currency.

## 15. Investments, deposits and advances, and employee loans (added 2026-11-11)

These are **balance-sheet items with their own histories**: not bills, not expenses, and not cash. Each needs a small register with a counterparty, terms, a schedule and events, posting to a control account that the register must always equal (section 8). They are the same pattern three times, so they share one design.

### 15.0 Shared design

- **Parties.** A light register of counterparties that are not vendors, customers or employees: banks and institutions, landlords (individuals), the electricity board, and so on. Kind, name, contact, PAN or GSTIN where relevant, documents (the lease, the FD receipt, the sanction letter) using the app's existing document attachments. Vendors, customers and employees keep their own records and are linked, not duplicated.
- **Arrangement and events.** Every item is one arrangement (a fixed deposit, a deposit with a landlord, a loan to an employee) with a schedule and a list of events (given, interest, adjusted, recovered, refunded, closed). Each event posts through the rules of section 6 and is audited.
- **Store dimension.** Fixed deposits belong to the **head office**. A **deposit** belongs to the store whose premises or connection it secures. An **employee loan** sits with the employee's store (or the head office, owner's choice **[CA]**); it does not move when the employee does.
- **Owner's own money.** If "the shop owner" means the **proprietor of this business**, money drawn is **drawings** (equity), not a receivable, because a proprietorship has no separate person to lend to **[CA]**. The registers below are for *other* people and institutions.
- **Schedules for the CA.** One report lists all three registers by party with amount, rate, dates, interest, TDS and expected recovery, which is the schedule the CA attaches to the balance sheet.

### 15.1 Fixed deposits and other investments (banks and institutions)

- **Register**: institution, deposit number, kind (fixed, recurring, other), principal, rate, start and maturity dates, payout (monthly, quarterly, at maturity or cumulative), auto-renewal, the bank account it was funded from and will mature into, lien or pledge note (for example held as security), TDS on interest, status, documents.
- **Lifecycle**:
  1. *Placed*: Dr Investments, Cr Bank. On the bank reconciliation the debit is tagged as a **transfer to investments**, not an expense.
  2. *Interest*: accrued each month (for cumulative deposits) or each payout date, Dr Interest accrued, Cr Interest income, with the year-end accrual so the income lands in the right year. A payout that arrives Dr Bank, Cr Interest accrued. **TDS** deducted by the bank is Dr TDS receivable (checked against the tax statement the owner downloads **[CA]**).
  3. *Renewed*: closes the old deposit and opens a new one; interest added to principal if compounded.
  4. *Matured or closed early*: Dr Bank, Cr Investments and accrued interest; an early-closure penalty is an expense.
- **Whose deposit is it.** A fixed deposit in the proprietor's own name from personal funds is not a business item; one funded from the business is **[CA]** to classify (business investment, or drawings followed by a personal deposit). Record the owner's decision per deposit.
- **Statements**: *balance sheet* shows current investments (maturing within 12 months) and non-current; *income statement* shows interest income (other income); *cash flow* shows placing and maturity as investing, interest as investing or operating **[CA]**. For **liquidity** the owner's view shows investments **separately from cash**, as a maturity ladder with the cost of breaking each early; "can we pay this week" counts only cash and bank.
- **Alerts** (using the existing alerts engine): maturity in 30 days, renewal due, interest not received on the expected date, tax certificate not yet recorded.

### 15.2 Deposits and advances given to individuals and institutions

Examples: the **rent advance held by the shop's owner (landlord)**, the electricity or telephone security deposit, a franchise or licence deposit, an advance to a vendor.

- **Register**: party, kind, store, amount and date, terms (refundable at the end of the lease or on a date, **adjustable against rent** in instalments, forfeitable for stated reasons), whether interest is paid, the lease or receipt attached, expected refund date, status.
- **Lifecycle**:
  1. *Given*: Dr Deposits and advances given, Cr Cash or Bank.
  2. *Adjusted against rent* (when the lease says so): each month Dr Rent, Cr Deposit for the adjusted part; otherwise rent is paid separately as an ordinary recurring expense.
  3. *Refunded*: Dr Bank, Cr Deposit. *Deducted* by the landlord for damage or arrears: Dr the expense, Cr Deposit. *Irrecoverable*: written off with an approval and a reason.
- **Vendor advances** are shown in the **payables** screens against that vendor (they reduce what is owed), and in the same control account.
- **Classification**: current if due back within 12 months, otherwise non-current. Interest-free deposits are carried at the amount paid unless the CA requires otherwise **[CA]**.
- **Rent itself** is an expense on the store's income statement (a recurring expense already exists). **TDS on rent and GST on rent depend on the landlord, the amount and whether the business is subject to tax audit, so the rule is set by the CA and recorded per lease [CA].**
- **Alerts**: lease or deposit refund date approaching, deposit adjusted fully, refund overdue.

### 15.3 Employee loans and advances, recovered in salary instalments

Four things that look alike and must not be mixed:

| Kind | What it is | Recovered by | Where it lives |
|---|---|---|---|
| **Salary advance** | A small sum against this month's pay | The next payroll, in one go | Employee loans and advances |
| **Loan** | A larger sum with a fixed number of monthly instalments | Payroll, instalment each month | Employee loans and advances |
| **Staff credit** | Goods bought on credit at the store (already built) | Payroll, existing recovery | Its own receivable, same recovery step |
| **Expense advance** | Cash given to spend for the business | Settled by bills, not salary | Employee advances (imprest), cleared on settlement |

- **Loan record**: employee, kind, principal, date and from where it was paid (cash, vault or bank, and the store), purpose, approval (a limit above which the Business Head must approve), number of instalments and amount, first month, interest (none by default; if charged, the rate), generated schedule, running balance, status (active, paused, settled, written off), signed acknowledgement attached.
- **Recovery in payroll** (extends the existing staff-credit recovery and the earlier design, which is on record: instalment each payroll, deferral when pay is short, pause or skip, part payment, approval above an amount, settlement on exit): each payroll run adds a **Loan instalment** deduction line automatically.
  - Recovery order: **statutory deductions first, then the loan, then staff credit, then other deductions**.
  - **Limits**: total deductions from a month's pay stay within the legal cap (commonly **half of the wages [CA, labour law]**) and net pay never falls below a floor the owner sets. A shortfall is carried as **arrears**, visible on the register and the pay slip, never silently dropped.
  - **Skip or pause** a month, or **part-pay**, only with a reason and an approver; **extra repayment** in cash is allowed and posts to the loan.
  - **Exit**: the full and final settlement takes the balance from final dues; anything left stays a receivable under recovery, or is **written off** with approval (Dr Staff loans written off).
- **Postings**: as in section 6. The payroll entry credits the loan account for the instalment, so the employee's net pay falls and the receivable falls by the same amount.
- **Tax**: an interest-free or low-interest loan above a threshold can create a **taxable perquisite** for the employee **[CA]**; the register keeps the rate and balance so the CA can compute it.
- **Visibility**: the employee sees their own loan, schedule, instalments paid and balance in My HR and on the pay slip ("balance after this instalment"); the owner sees outstanding by employee, due this month, arrears, total exposure as a share of payroll, and loans on employees who are leaving.
- **Alerts**: instalment skipped or short, notice given with a balance outstanding, loan ending, exposure above a limit.
- **Controls**: the register equals the control account; no loan without the required approval; locked payroll months are not changed (as for payroll today).

### 15.4 Where these sit in the plan

- **Phase 1 (ledger core)** adds the parties register and the three control accounts.
- **Employee loans** belong with **payroll posting** (Phase 1), because the instalment is part of every pay run; they were deferred earlier by the owner and would resume here.
- **Deposits and fixed deposits** belong before the balance sheet (**Phase 4**), with their schedule report.
- **Opening balances (Phase 0)** must list every fixed deposit, every deposit and advance held by others, and every employee's loan balance at the opening date, agreed with the CA.

### 15.5 Open questions

1. **Fixed deposits**: how many, with which banks; are they in the business's or the proprietor's name; payout type; who tracks the tax statements?
2. **Deposits and advances**: list the landlords and institutions holding money, the amounts, and the lease terms (refund date, adjustment against rent, conditions for forfeit). Is the landlord GST-registered, and is TDS deducted on rent today?
3. **Employee loan policy**: maximum amount, maximum instalments, interest (none?), the deduction cap and net-pay floor, who approves and above what amount, and what happens at exit.
4. Do **salary advances** and **loans** share one monthly deduction limit with **staff credit**?
5. Should loans and deposits be shown **per store** or only for the business (section 15.0)?
6. The CA's position on each **[CA]** point above (own-name deposits, interest-free deposits, perquisite tax, TDS and GST on rent, classification and cash-flow placement).

## 16. Related

`PURCHASING_PAYABLES_GST_PROGRAM.md` (payables and GST reconciliation), `GST_END_TO_END.md`, the finance module (bank import and reconciliation, `finance-bank-records`), the expenses, HR payroll, stock audit and shift cash modules.
