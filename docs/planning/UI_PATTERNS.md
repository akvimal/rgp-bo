# UI patterns: when to use a peek panel, a dialog, a page, a collapsible section

Status: **decisions taken 2026-11-15 (all recommendations); P1 to P5 built, uncommitted.** Asked for: "in the sale list the View action opens a right slider; do the same in customer view and other places; standardize similar actions everywhere (dialog, slider, collapsible section) with a design and rationale."

## 1. What exists today (counted in the code)

| Surface | Where | Count | State |
|---|---|---|---|
| Right slide-over (`p-sidebar`) | Sale list "View" only (`sale-details.component.ts`, 34rem) | 1 | the model to copy |
| Dialog (`p-dialog`) | sales, purchases, stock, shifts, products, todos, feedback and more | 32 files | about 12 different widths (30, 32, 34, 36, 48, 52, 60, 64rem; some with `maxWidth: 96vw`, some without); the click-outside-to-close mask is on in only 6 |
| Full page by route | customer "view" (`cust/view/:id`), product edit, invoice edit, vendor edit, sale view and edit, user, role | about 10 | the customer eye icon leaves the list for a full page |
| Collapsible | 13 native `<details>` | 13 | plain browser look, no shared rules |
| Inline expanding panel | customer detail "Change number / Merge / Move a balance" and similar (`border rounded p-2 mt-2`) | about 10 | a fourth way to do a small edit |
| Confirm | `ConfirmService` (`shared/confirm.service.ts`) in 15 places; one native `window.confirm` (HR staff delete) and one for unsaved changes (HR setup) | 15 + 2 | good service, not used everywhere |
| Row actions | "View" is an eye icon in the sale list, an eye link in the customer list, a text button in other lists; testids and order differ | | inconsistent |

The result: the same intention ("look at this record") behaves differently depending on the screen, and the user cannot predict whether they will lose their list, their filters and their place.

## 2. The rule: choose the surface by the job, not by habit

Ask in this order. The first "yes" decides.

1. **Is it a glance at a record, with the list still needed behind it?** (look at a bill, a customer, an invoice, a batch) -> **Peek panel** (right slide-over).
2. **Is it a short, focused decision or form that finishes in under a minute?** (record a payment, confirm a return, pick a reason; about five fields or fewer) -> **Dialog**.
3. **Is it long, multi-section, has tabs, needs a link people can share, or is a full edit?** (edit a product, an invoice, a staff record) -> **Full page**.
4. **Is it secondary or optional information inside any of the above?** (history, documents, audit trail, advanced options) -> **Collapsible section**.
5. **Is it a single-field change whose result shows in place?** (change a nickname, tick a box) -> **Inline edit**, no surface.
6. **Is it a question that needs yes or no, with a consequence?** -> **Confirm** through the one `ConfirmService`, always.

| | Peek panel | Dialog | Full page | Collapsible |
|---|---|---|---|---|
| Purpose | read a record, take one or two quick actions | decide or fill a short form | work on a record at length | tuck away the secondary |
| Keeps the list visible | yes | dimmed behind | no | n/a |
| Blocks the screen | no (list stays clickable beyond the mask) | yes | n/a | no |
| Address (URL) | optional `?peek=id` so Back closes it and a link reopens it | none | own route | none |
| Size | 34rem right, full width on a phone | S 30, M 36, L 48, XL 60rem; always `max-width: 96vw` | n/a | n/a |
| Closes with | Esc, close button, click outside | Esc, Cancel; click outside only when read-only | Back | its header |

### Why these rules (the rationale)

- **A peek keeps context.** On a list people filter, scroll and compare. A full page throws that away; a peek does not. Looking is the commonest action on a list, so it should be the cheapest and the most reversible. This is why the sale list already feels right.
- **A peek is not a modal.** Nothing is blocked, so a person can click the next row and the panel swaps. That is the speed gain over opening and closing dialogs.
- **A dialog is for decisions, not for reading.** It interrupts on purpose: it asks for an answer. Long read-only content in a dialog (a 60rem document viewer) is the wrong tool; that belongs in a peek or a page.
- **Full pages are for work and for sharing.** If it has its own route it can be linked, bookmarked and reached with the Back button. Anything big enough to need that should not hide in a panel.
- **Collapsibles reduce noise, they do not hide risk.** A section that holds a problem (an overdue item, a failed check) opens by itself and shows a count in its header; a quiet section stays closed. Nothing important is buried.
- **Always the same confirm.** A destructive action that names the thing, says what happens and says whether it can be undone, in the same wording and colours everywhere, prevents the wrong click more than any clever layout.

## 3. Standard behaviour for each surface

**Peek panel.** Header: title, one-line subtitle, status badge, close. Body: the summary, then collapsible sections. Footer or header actions: at most one primary action and an "Open full page" link when a page exists. Loading shows a placeholder, an error shows "Try again" (the same states as the dashboard widget frame). Esc closes; focus moves in on open and back to the row on close; the row stays highlighted while its panel is open; clicking another row swaps the content. On a phone it takes the full width.

**Dialog.** Title is a verb and a noun ("Record payment", not "Payment"). Footer: the main action on the right, Cancel next to it, the destructive one never as the default. Focus lands on the first field; Enter submits when it is safe. If the person has typed something, closing asks first ("Discard your changes?"). Errors show inside the dialog next to the field and the dialog stays open. Success closes it and shows one toast.

**Full page.** The existing `app-page-header` (title, subtitle, actions on the right, Back to the list). Unsaved-changes guard on leaving.

**Collapsible section (`app-section`).** Title, an optional one-line summary shown when closed ("3 documents, 1 pending"), an optional count or alert badge, a chevron. Opens by default when it holds something that needs action; closed otherwise. The same look everywhere, replacing the bare `<details>`.

**Row actions (every list).** One action cell, same order everywhere: **View** (eye; opens the peek; also what a click on the row or name does), **Edit** (pencil; opens the page or dialog), then the rest in a "more" menu, with destructive actions last, in red, behind a confirm. Same testid pattern `<entity>-view`, `<entity>-edit`, `<entity>-more`. Permissions hide actions, they do not grey them out unexplained.

## 4. The kit to build once

1. `app-peek` — wraps `p-sidebar` (position right, 34rem, max-width 100vw): title and subtitle slots, status badge, actions slot, "Open full page" link input, loading and error states, optional `?peek=` address, focus and Esc handled.
2. `app-modal` — wraps `p-dialog` with a `size` input (`sm`, `md`, `lg`, `xl`), the standard footer, a `dirty` input that asks before discarding, and the mask rule (closable by clicking outside only when read-only).
3. `app-section` — the collapsible.
4. `app-row-actions` — the standard action cell (view, edit, more, destructive last).
5. `ConfirmService` stays the only confirm; the two native `confirm` calls move to it.
6. A short "UI patterns" page in the app guide (for people) and this document (for the code).

## 5. Where each existing screen lands

| Screen | Today | Becomes |
|---|---|---|
| Sale list View | peek (34rem) | the same, on `app-peek` |
| **Customer list View** | eye icon leaves for a full page | **peek** with name, badges (segment, tier, inactive), outstanding dues, consent, last visits, the last 5 bills, and "Open full page" and "Edit" |
| Customer detail page | long page with inline panels | stays the page; "Change number / Merge / Move a balance" become dialogs; history and documents become collapsible sections |
| Purchase invoice list | opens the edit page, some dialogs | View -> peek (items, payments, status); Edit -> page |
| Vendor list | edit page | View -> peek (stats, outstanding, licences); Edit -> page |
| Purchase order list | route to the order | View -> peek; the order page stays for work |
| Product list | edit page | View -> peek (price, stock by batch, expiry); Edit -> page |
| Expenses, stock batches, disposal passes, shifts, leave requests | mixed | View -> peek; decisions (approve, reject, discard) -> dialog with confirm |
| Dialog widths (about 12) | ad hoc | four sizes; read-only document viewers move to a peek |
| `<details>` (13) | bare | `app-section` |
| `window.confirm` (2) | native | `ConfirmService` |

## 6. Plan

| Phase | What | Size |
|---|---|---|
| P1 | The kit: `app-peek`, `app-modal`, `app-section`, `app-row-actions`; move the sale list peek onto `app-peek` with no change in behaviour; a short guide page | M |
| P2 | Customer list peek (the summary becomes one component used by the peek and the detail page); inline panels on the customer page become dialogs | M |
| P3 | Peeks for invoices, vendors, purchase orders, products, expenses, stock batches | M-L |
| P4 | Dialog clean-up: map the 12 widths to four sizes, apply the mask and dirty rules, move the two native confirms | M (mechanical, 32 files) |
| P5 | `<details>` to `app-section`; row-action cell on every list | S-M |

Each phase is shippable alone. P1 and P2 give the visible win asked for (customer view like the sale view); P4 and P5 are tidy-up with no new behaviour.

## 7. Decisions needed

1. **Row click opens the peek** (not only the eye icon)? Recommended yes: the name or the row, and the eye, do the same thing; Edit is always an explicit button.
2. **Peek in the address** (`?peek=123`)? Recommended yes: Back closes the panel instead of leaving the list, and a link opens the list with the panel already open.
3. **Customer peek content:** the list in section 5 (name, badges, dues, consent, last visits, last 5 bills). Anything to add or leave out? Mobile numbers follow the existing reveal rules and are not shown to anyone who could not see them today.
4. **Dialog close rule:** click outside closes only read-only dialogs; forms close only with Cancel, Esc or the X, and ask first if something was typed. OK?
5. **Edit goes to a page** for records that have one today (product, invoice, vendor, customer), and stays a dialog for short ones. OK?
6. **Order:** P1 and P2 first (the sale list model, then customers), then P3, then the tidy-up?

## 8. As built (P1 and P2, 2026-11-15)

Decisions taken: all six recommendations (row click opens the peek; peek in the address; the customer peek content below; forms close only with Cancel, Esc or X; Edit goes to the page where there is one; order P1, P2, P3, then tidy-up).

- **`app-peek`** (`shared/components/peek.component.ts`): right slide-over, 34rem, full width on a phone; title, subtitle, badges and actions slots, "Open full page" link, loading placeholder, error with Try again. The bill panel on the sale list now sits on it with no change in what it shows.
- **`PeekAddressService`** (`shared/peek-address.service.ts`): keeps the open panel in `?peek=ID`; opening adds one history entry (Back closes it), closing replaces it. Used by the customer list. The sale list is **not on it yet**: its panel gets the bill from the row, so opening it by id from a link needs the header to load from the bill itself (done in P3).
- **`app-section`** (`shared/components/section.component.ts`): the collapsible (title, summary while closed, count, alert badge). Used by the customer peek; the 13 bare `<details>` move to it in P5.
- **Customer peek** (`customer-peek.component.ts`): the eye icon and the name now open it. It shows name, segment and tier badges, due-back, the reason line, what they owe (and what is overdue), mobile (masked for a login that may not read it all, with the same counted "Show details"), location, consent, other people on the same number (click to switch), and the last three months of buying (bills and amount). Edit and Open full page are in its header. **The last five bills are replaced by the last three months** because there is no endpoint for a customer's last bills; the months come from the existing one.
- **Not built yet:** `app-modal` and `app-row-actions` (they land with P4 and P5, where they are first used), peeks for the other lists (P3), the inline account panels on the customer page becoming dialogs (P2 follow-up: the page is unchanged for now).

## 9. As built (P3, 2026-11-15)

- **Vendor list:** the name and a new eye icon open a vendor peek: owed and overdue, bought in 12 months and in all, last purchase and payment, terms, contact, GSTIN, licence status, links to its invoices and what is owed; Edit in the header. It shows what the row already holds, so it opens at once. Block, disable and the rest stay as list actions.
- **Purchase invoice list:** a new eye button on each row opens an invoice peek: amount, paid, balance, dates and days late, then the items and payments once loaded (two collapsible sections); Pay in the header (the list's own pay dialog); "Open invoice" goes to the items page. The invoice number still links to that page, because that is where the work is done, so on this list the row click is not changed. Opening a panel no longer reloads the list or sends it back to page one (the list now reloads only when its tab, vendor or view changes).
- **Sale list:** its bill panel is now in the address too (`?peek=ID`). The list shows one day, so a link to a bill of another day shows no panel until that day is chosen.
- **A bug found and fixed on the way:** "Open full page" and Edit used to close the panel first, which started a second navigation that cancelled the first. They now just navigate; Back returns to the list with the panel open.
- **Not done, with reasons:**
  - *Expenses:* the row already shows every field (date, category, payee, mode, bank match, amount, GST, status, who decided), so a panel would only repeat it.
  - *Purchase orders:* the list already has its own master-detail pane (row click opens it).
  - *Products:* a useful panel needs price, stock by batch and expiry, which are not in the list row and need an endpoint or two; left for a later pass.
  - *Stock batches:* the same: needs the batch and movement history.

## 10. As built (P4, 2026-11-15)

- **One directive, not a wrapper.** Instead of replacing 50 `<p-dialog>` tags with a new `app-modal` (a large, risky edit), a directive on the `p-dialog` selector (`shared/dialog-standard.directive.ts`, exported by `SharedModule`, which every module that has a dialog already imports) makes each one follow the rules. So `app-modal` is **not built**; new dialogs just use `<p-dialog>`.
- **Four widths:** sm 30, md 36, lg 48, **xl 64rem** (the plan said 60; the 64rem price table would have been squeezed). A dialog's own width is moved to the nearest size (30 and 32 to sm; 34, 36, 40 to md; 42 to 52 to lg; 58 to 64 to xl; `vw` and `%` widths read as md up to 35 and lg above). `dialogSize="lg"` picks one by name; `dialogSize="keep"` leaves a dialog alone. A dialog with no width keeps the width of its content.
- **Never wider than the screen** (`maxWidth: 96vw`, which many dialogs lacked) and **not draggable**.
- **Click outside to close** was already off by default and on only for the 6 read-only viewers, so the rule held without a change. Forms close with Cancel, Esc or the X.
- **Native confirms gone:** the HR staff delete now uses `ConfirmService.confirmDelete`, and the HR Setup "leave with unsaved changes" guard uses a new `ConfirmService.confirmLeave()` (same dialog, "Leave" or "Stay"). The guard is now provided by the HR module instead of the root so it can use the service.
- **Not built:** the "discard your changes?" question when a *dialog* with typed values is closed (it needs each form to say whether it is dirty); `app-row-actions` and `app-section` for the 13 `<details>` are P5.

## 11. As built (P5, 2026-11-15)

- **Collapsible sections:** 12 of the 13 `<details>` are now `app-section`: the weekly review's five lists (each with its count, open by itself when there is something in it), the GST summary buckets, the pricing rules (Advanced, and More options inside it), the returns help, store settings Advanced, the shift desk checklists, and the pharmacy guide's scenarios (that module now imports the shared module). The QA spec for the guide was changed to click the section header. **One is left native:** the "Cannot scan? Enter the key by hand" on the sign-in page, which is before login and outside the shared module.
- **`app-row-actions`:** the standard action cell: view (eye) and edit (pencil) as icons, then a "more" menu (three dots) in the order given with destructive actions last and in red; an action with a link navigates, any other emits its key; Esc or a click outside closes the menu. Test ids `<name>-view`, `<name>-edit`, `<name>-more`, `<name>-<key>`. **Adopted on the vendor list** (view, edit, invoices, block or unblock, enable, disable: previously six loose icons) **and the customer list** (view only, because the list deliberately has no edit or delete). **Not yet on the other lists:** the sale list already has its own more-menu, and the invoice list has context buttons (Pay, Approve, Hold) that are the main action of a row, not a menu; moving those is a later pass list by list.
