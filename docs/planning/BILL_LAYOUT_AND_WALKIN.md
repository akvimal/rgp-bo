# Bill print, WhatsApp copy, walk-in customer (planned 2026-11-12, not built)

Plan only. Sources: the owner's list of changes to the printed bill, the WhatsApp copy, the counter and the sales report.

## 1. Decisions (owner)
1. **Amount in words**: kept **only on tax invoices** (the bill with a GST invoice number); removed from the cash bill. (Confirm with the CA that no other bill needs it.)
2. **Discount line**: kept **only when a discount was given**.
3. **Logo**: stays to the **left of the name block**, but its **height matches the block's height** (name, address, licences, GSTIN).
4. **Footer template**: **per store** (a business default fills a store that has none).
5. **Skipped customer**: store **no customer** (empty `customer_id`), not the shared Nil record.

## 2. What exists today
- Printed bill: `sale-view.component.html` / `.css`; one layout for screen and print. WhatsApp copy: `whatsapp/bill-pdf.ts` (pdfkit, hand-built), fed by `whatsapp.service.billData` (title = `stores.location`).
- Bill business details come from the business profile (`name`, logo, website, phones, return note, flags) and the store (address, phone, review link `google_review_url`).
- Counter: a completed sale with no customer typed gets the shared customer "Nil / 0000000000" (its id kept in `localStorage.nil`). `sale.customer_id` is nullable.
- Sales report (`report.service.ts`) prints `name (mobile)`.
- The backend already has the `qrcode` library; the frontend QR is `qrcode-generator`.

## 3. Printed bill
| # | Change | How |
|---|---|---|
| 1 | Less space between title and address | `h1` line-height about 1.15, no bottom margin; address block line-height about 1.3. |
| 2 | Registered / trade-mark suffix (configurable) | New business-profile choice **Name suffix**: None, (R) or (TM). Appended to the business name wherever it is printed as a title (bill and WhatsApp copy). Column `business.name_suffix` (default none). |
| 3 | Logo height = text block height | The head grid becomes `auto 1fr auto` with `align-items: stretch`; the logo box is a grid cell that stretches to the height of the name block and the image uses `height: 100%; width: auto; object-fit: contain`. A cap on width (say 38% of the page) stops a very wide logo from squeezing the text. |
| 4 | Narrower GST column | Its own class: GST about 36 px, Qty about 44 px, MRP and Rate keep 64 px; product and batch/exp take the saved 40 to 50 px. |
| 5 | Amount in words | Shown only when the bill has a GST invoice number. |
| 6 | Review QR on the right, text on its left | The review block becomes a row: "Happy with us? Scan to review us on Google." on the left, QR (about 80 px) on the right. |
| 7 | Totals | One line **Net total (GST included)**; the label becomes **Net total (GST included and rounded)** only when a round-off exists. A **Discount** line is shown only when a discount was given. The "Total (GST included)" and "Round off" rows go. |
| 8 | Footer | See section 4. |
| 9 | Line under "Billed to" | Remove the border and trim the padding; the items header moves up. |

## 4. Footer template (per store)
Under a rule, at the very bottom of the bill: the template, centred by default.

- **Setting**: Settings > Store > Bill footer (Business Head). One template per store; a store with none uses the business's (a business-level default is editable in the business profile). Stored as text (`stores.bill_footer`, `business.bill_footer`).
- **Tokens**: `{store_name}`, `{business_name}`, `{store_phone}`, `{business_phone}`, `{grievance_phone}`, `{website}`, `{bill_no}`, `{date}`. A line whose tokens are all empty is dropped.
- **Phone formatting**: modifier on the token: `{store_phone|spaced}` -> 98765 43210 (the default), `{store_phone|intl}` -> +91 98765 43210, `{store_phone|plain}`. Several numbers in a field are formatted one by one.
- **Text formatting** (safe, no HTML): `**bold**`, `_italic_`, and a line prefix `[c]` centre, `[l]` left, `[r]` right.
- **Default template** reproduces today's foot: the refill and complaints line, the grievance line, the website and the thank-you line, so nothing changes until a store edits it.
- **Editor**: the template box, a token list, and a live preview of the footer as printed.
- **One render function** (shared between the app and the API) feeds the printed bill and the WhatsApp PDF so the two always match.
- The returns note stays above the rule with the QR (unchanged for the printed bill).

## 5. WhatsApp bill copy
- Title: the **business name** (with the suffix); under it the store's address and phone, then licences and GSTIN. Not the store location.
- **No** "Returns accepted..." line.
- **Google review**: QR from the store's review link and "Happy with us? Scan to review us on Google."; skipped when the store has no link.
- Footer: the same store template as the printed bill.
- No change to when a bill may be sent (consent rules stay).

## 6. Walk-in customer (skip at the counter)
- POS gets an explicit **Skip customer (walk-in)** choice. The bill is saved with **no customer** and prints "Walk-in".
- **Not offered (greyed, with the reason)**: a bill with a chronic medicine (needs a real mobile), a Schedule H, H1 or X drug (needs the patient and prescriber), store credit, pay later or staff credit.
- A walk-in bill has: no WhatsApp copy, no review invitation, no loyalty points, no refill reminder.
- The old behaviour (a blank customer silently becoming Nil) goes: leaving the customer blank asks to **Skip** or enter one.
- **Reports and lists** show a missing customer, and the old Nil customer, as **Walk-in**: the sales report and sales list, customer filters, dashboards. The Nil placeholder never prints "0000000000".

### Existing Nil bills (the live data)
- **No data migration at first.** Existing bills keep their Nil customer; every reader treats Nil and an empty customer the same way and shows "Walk-in".
- Reason: many queries join sales to customers with an **inner join** (the sales list, returns, the customer's orders, the review module, refills, dashboard metrics, the WhatsApp reader). A sale with no customer would drop out of the sales list and out of returns unless those become left joins. They are converted and tested first.
- Size on the live database: to be counted with a read-only query before deciding anything (in the local copy 9 of 914 completed bills are Nil).
- **Optional cleanup later**, after every reader is safe: `update sale set customer_id = null` for the Nil customer's bills, with the Nil customer's id saved in a setting so a rollback script can restore it. Nothing in the live data changes until that step is chosen.

## 7. Build order
1. CSS-only items (1, 3, 4, 6, 9) and the totals and words items (5, 7); a visual check against a print preview.
2. Name suffix setting; "Walk-in" label for the Nil customer in the sales report and lists.
3. Left-join audit of the readers above, with specs for a bill with no customer (sales list, bill view, returns, reports, dashboards).
4. Footer template: render function, per-store setting, editor and preview.
5. WhatsApp copy.
6. Skip customer in POS with its rules.
7. (Optional) the Nil cleanup migration and rollback.

## 8. Specs to add
Bill view with and without a discount, with and without a round-off, tax invoice versus cash bill (words), the footer template render (tokens, empty lines, phone formats, bold and alignment), the WhatsApp PDF (title is the business name, no returns line, review QR when a link exists), a walk-in bill through the sales list, returns and reports, and the greyed Skip cases.

## 9. Open points
- The CA's view on "amount in words" for tax invoices.
- Whether the business-level default footer is wanted in addition to per-store templates (this plan assumes yes, as the fallback).
- The live count of Nil bills, before the optional cleanup is considered.
