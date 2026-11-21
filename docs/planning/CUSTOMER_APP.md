# Customer mobile app (an add-on module of the RGP SaaS)

Status: **design only, written 2026-11-21 from the code. Nothing is built.** The brief is `PHARMACY_APP_PROMPT.md` (seven product decisions are already taken, below). The design stops at the questions in section 15; no code starts until they are answered. Three placeholders in the brief were never filled in: the brand name for package ids (`in.<<brand>>.<slug>`), the domain for tenant addresses (`<<domain>>`), and the SMS provider (`<<MSG91 / other>>`). They are open questions 1 to 3.

## 1. What it is, in plain words

A customer installs a pharmacy's own app (the first one is RGP's), signs in with their mobile number and a code, searches medicines, uploads a prescription, orders for pickup or home delivery, and sees their refills, wallet and dues. Staff see each online order in the back office, check any prescription, bill it at the counter as they bill everything else, and hand it over or send it out. The app is a **plan module** (`customer_app`) sold on top of the SaaS, and also works on a standalone install.

It adds one thing the shop does not have today: **a way for the customer to reach the shop's data without a person in between.** So most of this design is about that boundary: who the caller is, what they may see, what they may change, and how money and prescriptions are kept honest.

## 2. Decisions

### Taken (from the brief)
| # | Decision |
|---|---|
| 1 | React Native with Expo (TypeScript strict), Android first, iOS-ready, in a new top-level `mobile/`. |
| 2 | One codebase, white-label builds from a tenant profile (`mobile/tenants/<slug>.json`): name, package id, icon, splash, colours, API base URL, stores, support numbers, licence text; one EAS profile per tenant; RGP first. |
| 3 | Umbrella mode (store code resolved by the control plane) is designed now and not built; the config layer supports both modes from day one. |
| 4 | `customer_app` is a plan module. Off: every customer endpoint answers 403 and the staff screens are hidden. Standalone installs have it on. |
| 5 | Identity is the existing household-by-mobile model. "Who is this for?" is the people on the number. Consent, do-not-contact, language, wallet and dues stay household level. |
| 6 | Staff bill every online order at the POS. The app creates an *online order* that staff pick, bill and hand over or dispatch. |
| 7 | Schedule H and H1 lines need a pharmacist-approved prescription, enforced in the API. Schedule X: "visit the store", no online ordering. |

### Proposed here (each is a recommendation to approve or change)
| # | Proposal | Why (section) |
|---|---|---|
| P1 | A **new `online_order`** (with lines, status history and a payment ledger), not an extension of `customer_commitment`. Out-of-stock "order on request" items reuse `customer_commitment` as it is. | 6 |
| P2 | Customer tokens use their **own secret and audience**, and the staff guard also refuses a customer audience. | 5 |
| P3 | Prepaid money is held on the order (not in any shift) and applied on the POS bill as a tender, like a commitment advance but with no shift. | 6 |
| P4 | Prescriptions live in a **new private store** with signed, short-lived, audited access. The existing `files` module is not used for them. | 8 |
| P5 | Stable addresses by a Caddy edge (caddy-docker-proxy labels on the tenant's web container), one host per tenant, API under `/api`. | 4 |
| P6 | Push (FCM) is a new channel on `customer_message`; the OTP goes through the same outbox as an "authentication" kind. | 9, 5 |

## 3. What exists today (read from the code)

| Area | What is there | Where |
|---|---|---|
| People | `customer` is a person; `household` is the account behind one mobile (unique by number), kept in step with `customer` by triggers. Consent, do-not-contact, channel, language and the review opt-out are one answer per household. Store credit, dues and the pay-later limit are household level. Relationship and date of birth are optional on the person. | migrations 193 to 196; `customers/customer-household.service.ts`, `household-rules.ts` |
| Contact rules | `contact_consent`, `do_not_contact`, `preferred_channel`, `message_language` (en, ta); a 7-day contact cap and the contact log; a STOP word from WhatsApp sets do-not-contact and cancels waiting messages. | 123, 194, 230; `whatsapp/whatsapp-webhook.service.ts` |
| Messages | `customer_message` (kinds BILL, REFILL, DUES, DELIVERY, REVIEW; channel; status PENDING to READ; language; params; unique bill per sale), a 30 second worker, `store_whatsapp` per store (mode MOCK or LIVE, sealed token, monthly cap). **Every store is MOCK today: nothing has left the server.** Meta needs a verified account, a number per store and approved templates. | 180, 181, 218; `whatsapp/*` |
| Bill PDF | A server-side bill PDF exists (`whatsapp/bill-pdf.ts`, pdfkit, English). | `whatsapp/bill-pdf.ts` |
| Orders taken by staff | `customer_commitment` (OPEN, ORDERED, READY, COLLECTED, CANCELLED), lines, and an **advance ledger** (RECEIPT, REFUND, APPLIED, REVERSAL, each stamped with the shift it was taken in; cash joins that shift's drawer, digital that shift's provider total). The bill collects it as a tender. A purchase request links a line to the purchase flow, then goods are held for the customer. | 190; `commitments/*` |
| Bills and delivery | `sale` carries `order_type` (Walk-in, Phone, Whatsapp) and a delivery type; `sale_deliveries` has status (Pending, Delivered, Failed...), delivery by staff or courier, charge, receiver, cost paid. | `entities/sale.entity.ts`, 179, 189; `sales/sale-delivery.service.ts` |
| Prescriptions on a bill | A Schedule H, H1 or X bill records patient, prescriber and registration number, the prescription date, how it stands (attached, seen, later) and an optional document id; the drug register reads these. There is **no table of a customer's prescriptions** to reuse. | `packs/pharmacy/drug-register.service.ts` |
| Stock | Per-store availability is computed from batches (bought, less sold, plus approved adjustments, less approved disposals), with expiry. A product has no stock number of its own. `stock.service.findByCriteria` takes a store. | WS-6; `stock/stock.service.ts` |
| Prices | `price_view` gives the product's price (before GST), MRP, GST. What a customer pays is price plus sale GST, never above MRP (the rule already used in the price comparison). Pricing rules and policy are in `PRICING_GOVERNANCE.md`. | `products/*`, `sales/price-compare-rules.ts` |
| Products | title, pack, mfr, brand, category, `more_props` (composition, schedule, chronic, generic...), dosage form. **No picture column** (the product-pictures idea is deferred). Brand dictionary and same-composition matching exist. | `entities/product.entity.ts`, `sales/drug-ref.service.ts`, `sale-suggestion.service.ts` |
| Refills | Customers with 3 or more visits including a chronic medicine, a usual gap per customer and (step 4) per medicine, due and overdue buckets; one contact log with turnaround measured. | `quality/refill.service.ts`, `REFILL_CRM_DASHBOARD.md` |
| Files | Multer to a folder; the type check trusts the browser's mime type; `POST /files/view` returns any file under the uploads folder to **any signed-in staff token**; there is no per-file access rule and no signed link. | `files/*` |
| Staff auth | Passport JWT signed with `JWT_KEY` (24 h), a guard that also checks the user is active, MFA (TOTP) for staff, registered store PCs. The guard does not check an audience. | `modules/auth/*` |
| Modules and plans | `ModuleState` (hr, purchasing, gst, expenses, payment_recon, stock_audits, transfers, drug_register, refills, returns, feedback) is the one definition behind the API 403, the permission list the app receives and the schedulers; the control plane's plans, grants and a signed entitlement heartbeat feed it; `documents` and `scans` are counted and limited. | `core/modules/modules.ts`, `core/platform/*`, `control-plane/src/*` |
| Tenants | One compose project per customer (`rgp-<name>`), a shared image, own database and uploads volume, a web container on port 8201 and up, env written by the control plane (`TENANT_SLUG`, `TENANT_SECRET`, `APP_BASE_URL` already exist). **No subdomains, no TLS.** A beta edge network for Caddy exists by name only (`docker-compose.beta.edge.yml`). | `docker-compose.tenant.yml`, `scripts/tenant-up.sh`, `control-plane/src/tenants.service.ts` |
| API shape | Swagger at `/api` with `@ApiTags` on controllers; no codegen config; body limits set per route; CORS open; a global exception filter. **No rate limiter** (no throttler package), **no OTP code** (only TOTP for staff), **no FCM, no Razorpay.** | `main.ts`, `package.json` |
| Back office | Angular 12, menu and permission registry (`permission-registry.json`, `menu.ts`), app guide, UI patterns (peek, dialog, page). | `docs/ui-standard.md`, `UI_PATTERNS.md`, `MENU_AND_PERMISSIONS.md` |

## 4. Gaps this design has to close
1. A customer identity separate from staff: tokens, devices, OTP, lockout.
2. A way to send an OTP at all: WhatsApp is MOCK everywhere and its OTP-style template is not submitted; SMS has no adapter.
3. A rate limiter (OTP, login, public routes) and a signed-link mechanism (prescription images, bill PDFs).
4. A customer prescription store, a pharmacist review screen, and cover rules (which medicines, how long, how many fills).
5. An online order with a payment that is not taken in a shift, and a webhook that decides the payment status.
6. Customer-safe catalogue rules (never cost, margin, vendor, exact quantity) and a product picture field.
7. A push channel and device tokens.
8. A stable HTTPS host per tenant and, for umbrella mode, a public resolver.
9. A customer-token audit actor (the audit log's actor is a staff user id).
10. The `files` module's weak points must not be inherited (section 8).

## 5. Customer sign-in, separate from staff

### Who signs in
The **household** signs in with its mobile. Inside the app the person is chosen with "Who is this for?" (spouse, child, parent): that is the `customer` row on the number. A new mobile can **register**: it creates a customer (name asked once, then the household follows by the trigger). A number that is a *masked* or shared counter number is never used.

### Tokens
- A **customer JWT** signed with `CUSTOMER_JWT_KEY` (a new secret, never `JWT_KEY`), `aud: "rgp-customer"`, `iss` the tenant slug, subject the account id, 15 minutes. A **rotating refresh token** (opaque, hashed at rest, one per device, a family id so a reused old token revokes the whole family), 60 days sliding.
- The customer guard `@CustomerAuth()` verifies secret and audience, then checks the account and the device are still active, as the staff guard checks the user. It sets `request.customer` (account id, household id), never `request.user`.
- The **staff guard gets one extra line**: a token with `aud === "rgp-customer"` is refused. The two secrets already make a crossover impossible; the check makes it impossible even if someone configures the same secret by mistake. Staff MFA and device trust are untouched.
- Customer routes live under `/c/…` and use only the customer guard. A test fails if any controller outside `customer-app` uses `@CustomerAuth()` or any `/c` route uses the staff guard.

### OTP
- Request: `POST /c/auth/otp` with the mobile (normalised to +91, the existing `normaliseMobile`). Always the same answer ("if this number can receive a code, one is on its way") so numbers cannot be probed.
- A 6 digit code, stored as an HMAC (keyed with a server secret), valid 5 minutes, 5 wrong tries then the code is dead. Limits: 3 codes an hour and 10 a day per mobile, 20 an hour per IP, and a 30 minute lockout after 10 failures; counted in a table (`app_otp`), since the API has no shared cache and one API process serves a tenant.
- Delivery: **WhatsApp first** through the store's number as a new message kind `OTP` (a Meta *authentication* template with the copy-code button, English and Tamil), **SMS fallback** through a provider adapter (placeholder `<<MSG91 / other>>`) when WhatsApp is MOCK, fails permanently, or the number is not on WhatsApp. DLT registration (India's SMS template and sender rules) is an outside wait. Until a provider exists the OTP is MOCK: in a test tenant the code is shown in the staff log, never in a production response.
- An OTP is a service message: it ignores the 7 day marketing cap and quiet hours, but not do-not-contact **for marketing**; a customer who asked the shop to stop messaging them can still sign in (decision for the user, question 4).
- Verify: `POST /c/auth/verify` with mobile, code and device id returns the tokens. **Device binding:** the first sign-in binds the device (`app_device`: id hash, platform, model, push token, last seen); a new device on an account asks for a fresh OTP and is listed to the customer under Account; the customer or staff can revoke a device.
- Audit: sign-in, failure, lockout, device bound or revoked, token reuse, deletion request, all as events with a **customer actor** (a new nullable `customer_id` and `actor_kind` on `audit_event`; staff rows unchanged).

### Account deletion and erasure (DPDP Act 2023)
- In-app "Delete my account" removes the **app login**: the account, devices, refresh tokens, push tokens, saved addresses and app notification settings, and signs out everywhere.
- It also files an **erasure request** for the personal data the shop holds. What the law requires the shop to keep stays: **bills (GST), the drug register entries and the prescriptions behind Schedule H, H1 and X sales** for their statutory periods. The app says this plainly on the screen (it names what is deleted and what is kept and why). The retention periods and what a pharmacy must keep are for the user's CA or lawyer to confirm (question 9); nothing here states them as fact.
- Erasure runs as a staff-approved task, not a button that drops rows: the customer record is anonymised only where no legal record needs the name; households with a balance or dues are told to settle first.

## 6. Online orders and money

### Two ways, compared

| | A. Extend `customer_commitment` | B. New `online_order` (recommended) |
|---|---|---|
| Fit | Built for an item the store does not have, paid in advance at the counter, ordered from a vendor, held on arrival. | Built for in-stock items, ordered from a phone, paid online or on delivery, picked from the shelf. |
| Status | OPEN, ORDERED, READY, COLLECTED, CANCELLED, computed from purchase-request links (`statusOf`). App states (Rx check, Packed, Out for delivery) do not fit; adding them touches rules, alerts and screens that assume the purchasing flow. | Its own states (section 7), no purchasing coupling. |
| Money | The advance is **stamped with a shift**: cash joins the drawer, digital the shift's provider total. An online prepayment is not taken in any shift, so a receipt would have to leave the shift empty and every query that sums by shift (`SHIFT_DIGITAL_SQL`, the drawer ledger, the digest) would need a new rule. | A separate ledger with no shift, so the shift tally cannot be disturbed. |
| Reuse | Hold, alerts, the "bill collects it" tender, refunds. | The **same patterns** (signed ledger rows, a tender on the bill, void gives it back), written for this table. |
| Risk | High: the cash and digital tally is the most protected part of the system. | Low and contained; one new tender type on the bill. |

**Recommendation: B**, and keep commitments for what they are for. A product that is not in stock shows **"Order on request"**: tapping it creates a `customer_commitment` (source `APP`, no advance, status OPEN) through the existing service, and staff handle it exactly as a counter order (purchase request, arrival, "ready" message). That gives the app the special-order flow with **no new code on the commitment side except a `source` column and an `APP` creator**.

### Money, step by step
1. **Order**: the server totals the lines at today's customer price (price plus GST, never above MRP) and delivery charge; the amount is fixed on the order. Stock is **not reserved** at this point (question 7).
2. **Pay online**: `POST /c/orders/:id/pay` creates a Razorpay order (amount in paise, `receipt` = our order number). The app opens checkout. **The app's "success" is never trusted.** The server marks the order paid only when the `payment.captured` (or `order.paid`) **webhook** arrives with a valid `X-Razorpay-Signature` (HMAC-SHA256 of the raw body with the webhook secret; with no secret set it accepts nothing, the same rule as the WhatsApp webhook), and the amount and currency match. The app may also send the payment id and signature, which the server checks (HMAC of `order_id|payment_id` with the key secret) only to show "paid" sooner; the webhook still decides.
3. **Held**: a row in `online_order_payment` (RECEIPT, positive, provider, payment id, amount, `captured_on`, no shift). The total held is a liability figure for the owner (shown on the order and in a report).
4. **Billing**: "Bill this order" opens the POS with the lines loaded (batches chosen by the usual soonest-expiry rule), the customer set, `order_type = App`, the delivery type set. The bill carries `online_order_id` and `online_order_amount`; the paid amount counts toward the bill total as a **non-cash, non-digital tender** (nothing is added to the drawer or the shift's digital total, so nothing is counted twice), exactly as a commitment advance is applied today. The ledger gets an APPLIED row. Any balance is paid at the counter or on delivery.
5. **COD**: no receipt; the order is marked "collect on delivery" and the delivery's existing cash-on-delivery fields and collection status carry it; the money is counted when the courier or staff hands it in, through the normal delivery and shift flows.
6. **Cancel before billing**: a Razorpay **refund** to the source, a REFUND row, order CANCELLED. **A bill voided** gives the applied amount back (REVERSAL), as for commitments. **A return of a bill paid online** refunds the online part to the source through Razorpay, or to wallet credit by the customer's choice and a Store Head's step; the refund mode is recorded. Razorpay refunds are asynchronous: the ledger row is PENDING until the `refund.processed` webhook.
7. **Reconciliation**: Razorpay settles to the bank in batches. The existing bank statement import and reconcile (finance) is the place to match settlements; the order's payment id is the reference. (How much matching to build is question 8.)
8. **Price protection**: a prepaid order is billed at the **lower** of the agreed and the current price; an unpaid order is re-priced at billing and the customer is shown the change before they pay on delivery. (Question 7.)
9. **GST**: the POS bill is the tax invoice either way. Whether an online advance needs anything at receipt is the same open question already recorded for commitments, for the CA.

Razorpay keys (key id, key secret, webhook secret) are per tenant, stored **sealed** in a new `store_payment` row (like `store_whatsapp` and the AI key), set under Settings, never returned by the API. A tenant without keys takes COD only. The React Native Razorpay SDK needs a **development build** (it will not run in Expo Go); this is stated in the mobile README.

## 7. Order states the customer sees

| Customer sees | Meaning | Existing record it maps to |
|---|---|---|
| Placed | Order saved (payment pending or paid) | `online_order.status = PLACED` |
| Prescription check | A line needs a prescription that is not yet approved | derived: any Rx line without an approved, covering prescription; order stays PLACED until it clears |
| Confirmed | Staff accepted it (and Rx cleared) | `CONFIRMED`, who and when |
| Packed | Billed at the POS | the linked `sale` is COMPLETE (`sale_id` on the order) |
| Out for delivery | Handed to staff or courier | `sale_deliveries`: delivery by set, **a new `dispatched_at`** timestamp (not a new status, so existing screens and reports keep working) |
| Ready for pickup | Billed and waiting at the store | `sale` COMPLETE, delivery type Counter, `ready_on` on the order |
| Delivered / Collected | Done | `sale_deliveries.status = Delivered` / collected at the counter |
| Cancelled | By the customer before Packed, or by the shop with a reason | `CANCELLED`, reason, who |

Every change writes a row to `online_order_event` (state, by whom, when, note); the customer's timeline is that list. Cancel by the customer is allowed until Packed and refunds as in section 6.

## 8. Prescriptions

### Why not the `files` module
It trusts the browser's mime type, and `POST /files/view` hands any file under the uploads folder to **any signed-in staff user**, with no record of who looked. A prescription is sensitive health data (DPDP), so it gets its own store.

### Store and access
- A private folder outside the web root, `uploads/rx/<household>/<uuid>`, written only by the prescription service. The type is checked from the **content** (JPEG or PNG magic bytes; HEIC is converted on the phone), the size at most 2 MB each after on-device compression, up to 5 images a prescription, EXIF removed on the server.
- **Short-lived signed access:** an image is served only at `GET /rx/image/:id?exp=…&sig=…` where the signature is an HMAC over id, viewer and expiry (5 minutes), generated for the customer by `/c/prescriptions/:id` and for staff by the review screen. **Every view is audited** (`rx_view`: who, when, from which screen).
- **Consent before the first upload**, recorded (`rx_consent`: text version, language, time, device); declined means no upload.

### Review (pharmacist) and cover
- A pharmacist reviews in a new Angular screen **Sell > Prescriptions** (queue: new, in review, approved, rejected, expiring): zoom, rotate, patient, prescriber, registration number, date, and **what it covers**: for each medicine (a product or a composition), the number of fills and the most per fill, and a validity date (default the shop's rule; the existing "older than six months is flagged" rule is the starting point). Reject needs a reason shown to the customer in plain words. Reviewer, time and outcome are audited.
- **One prescription serves several orders** until its fills or validity run out (`rx_cover` with fills used).
- **Hand-off to the POS:** billing an order with Rx lines prefills the existing scheduled-drug panel (patient, prescriber, registration, date, basis "attached", the document) from the approved prescription, so the drug register stays the single legal record.
- **Server rule, not a screen rule:** `POST /c/orders` refuses a Schedule H or H1 line with no approved covering prescription (it creates the order with the line held in "Prescription check" only if the customer has uploaded one waiting for review, otherwise it refuses); **Schedule X** lines are refused outright with "visit the store". The staff "Confirm" action refuses the same. A test covers each.

### Statutory records
The prescription and its images are kept for the period the shop's pharmacist and advisor confirm (question 9), independent of the customer deleting the app.

## 9. Notifications: a PUSH channel next to WhatsApp

- `customer_message` gets `channel = PUSH` (alongside WHATSAPP) and the kinds **ORDER_STATUS, REFILL, DUES, OFFER, OTP**. A PUSH row carries the device token in `to_mobile`'s sibling `to_token` and the same params; the worker sends through **FCM HTTP v1** (service account, per tenant, sealed). Tokens come from `app_device.push_token` and are removed on FCM's "not registered".
- **Rules unchanged:** household consent, do-not-contact, quiet hours and the **7 day contact cap** apply to REFILL, DUES and OFFER. **ORDER_STATUS and OTP are service messages** (no cap, and sent to anyone who has not said STOP on that channel). **OFFER (marketing) stays off** until the household has recorded marketing consent, which the app's consent screen is the first place to capture.
- **Channel choice:** if the household has the app and push is on, ORDER_STATUS goes by push, then falls back to WhatsApp when the push is undelivered or there is no token. A customer can turn each kind off in the app (writes to the household).
- Nothing health-related in a push: "Your order #1042 is out for delivery". No medicine names on the lock screen (an option in Account, default off).
- Language follows `message_language` (en, ta).

## 10. Catalogue exposure

A customer-safe **view**, not the staff queries.

| Show | Never show |
|---|---|
| title, generic composition, pack, dosage form, manufacturer, MRP, the customer price (price plus GST, never above MRP), Rx or OTC flag, picture, availability for the chosen store | cost, purchase rate, margin, vendor, batch number, exact quantity, who set the price, the price history |

- **Availability** per store, three words: **Available** (more than a shop setting, default 5 packs), **Few left**, **Order on request** (none, or only batches near expiry: the 30 day rule used by the counter guide). The number is never sent.
- **Schedule X** is hidden from order and shows "Visit the store". **Rx** shows a prescription badge and a health disclaimer on the screen.
- **Alternatives:** "Same medicine, other brands" uses the existing same-composition and same-form matching, only for products that need no prescription or when the customer's approved prescription covers that composition. For a prescription medicine the app never swaps one brand for another: the pharmacist decides at review.
- **Pictures:** there is none today. v1 ships with a category icon; a `product_image` table and a staff upload (the deferred product-pictures plan) follow, and the app reads the first image. (Question 6 asks whether pictures are wanted in v1.)
- **Visibility:** every active product with a price and some stock history is searchable by default, with an exclusion flag on the product (`more_props.online = false`) to hide one. (Question 5.)
- **Performance:** server-side paging (20 a page), search on title, brand and composition (existing `ilike` with the indexes), a short cache per store (60 s) with ETag, and the response kept small for 3G.

## 11. Refills, wallet, dues

- **My medicines:** the refill engine already finds, per customer and per chronic medicine, the usual gap and the due date. A read endpoint `GET /c/medicines` returns the household's medicines (name, last bought, due date, status) **by person**. One tap "Order again" creates an order from the last bill's lines. A reorder that follows a refill contact is credited to the turnaround measure as any bill is (the measure reads bills, so nothing is counted twice and no staff contact is double-credited: the contact log row stays the staff's, the order is the customer's own).
- A **refill reminder names the medicine, not the patient**, as in the household plan. The app shows the medicines of each person only to the signed-in household member and says so.
- **Wallet:** the household store-credit balance and its ledger, read only. **Points:** shown once `LOYALTY_REWARDS` is built (the wallet is built household level from the start). Redemption stays at the counter with the operator's confirmation.
- **Dues:** the household's pay-later balance, due dates and history, read only. **Paying dues online** is possible with the same Razorpay flow and a `DUE_COLLECTION`-style entry, but a payment must land in a shift or in the online liability and then be applied; recommend **not in v1** (question 8).

## 12. Entitlements, limits and per-tenant settings

- `customer_app` joins `ModuleState`, `MODULE_KEYS`, the labels, `clampModules`, `lockedModules` and the control plane's `ModuleSet` and plans (off for Starter, on for Shop and Chain by default; a grant can override). A **choke point guard** `@Module('customer_app')` on every `/c` controller and on the staff controllers for orders and prescriptions answers 403 when off; schedulers (push, order timers) skip it; the Angular menu and routes follow the permission list the app already receives.
- **Limits** on the plan, counted on the heartbeat like documents and scans: **orders per month** and **push per month** (empty means no limit); refused with a message saying what was used. SMS and WhatsApp OTP messages count toward the existing monthly cap of the store number.
- **Settings** (Settings > Customer app, Business Head or Store Head): which stores take online orders, **service pincodes** (a list per store, or a radius when stores gain coordinates), delivery charge rules (free above an amount, flat or by distance band), **slots** (windows and cut-off), **minimum order**, **COD on or off**, Razorpay keys (sealed), banner and offer images (media library from `WHATSAPP_MEDIA`), the low-stock threshold, support numbers, store timings, the licence text (drug licence numbers and the pharmacist's name come from the store profile that already holds them).
- New permission group `customerapp` (view orders, bill orders, review prescriptions, manage settings, see devices), registered in `permission-registry.json`, with a migration that grants it to the owner roles and a Store Head default.

## 13. Tenant routing and the stable address

**Today:** each tenant's web container (nginx) listens on a host port (8201, 8202...) and already proxies `/api/` to its API (the WhatsApp webhook URL in `WHATSAPP.md` relies on that). There is no TLS and no hostname.

**Proposal (P5):**
- One **Caddy** container on a shared `edge` network (the name the beta compose already uses) with automatic HTTPS. A tenant's web container joins `edge` and carries **caddy-docker-proxy labels** written by `docker-compose.tenant.yml` from `TENANT_HOST`: `caddy: <slug>.<<domain>>`, `caddy.reverse_proxy: "{{upstreams 80}}"`. The customer app calls `https://<slug>.<<domain>>/api/c/…`; staff use the same host.
- A **wildcard certificate** (`*.<<domain>>`) through the DNS provider's challenge, so a new tenant needs no certificate wait. (The DNS provider is part of question 2.)
- The **control plane** gets `tenant.host` (default `<slug>.<<domain>>`, editable, unique); `envFor(slug)` writes `TENANT_HOST` and sets `APP_BASE_URL=https://<host>` (the field exists and is already validated); `scripts/tenant-up.sh` adds the compose override for the edge network; the admin screen shows the address and whether it answers.
- Webhooks (Razorpay, WhatsApp) use the same host, so each tenant registers `https://<slug>.<<domain>>/api/payments/webhook` and the existing WhatsApp one.
- The platform stays private: only `/resolve/*` of the control plane is published (below).

### Umbrella mode (designed, not built)
- The customer enters or scans a **store code** (a short code printed on the shop's poster or bill). The app calls the control plane `GET https://api.<<domain>>/resolve/<code>` (**public, rate limited, cached**) and gets `{ apiUrl, brand, colours, logo, stores:[…] }` for that tenant, then runs as a white-label app pointed at it.
- The control plane owns a **store code registry** (code to tenant slug and store id; unique across all tenants, issued by the platform, not typed by the shop). A tenant registers or retires a code through its heartbeat (the shop cannot pick another tenant's code). The resolver answers the same "not found" for unknown and retired codes, caps requests per IP, and caches positive answers (short TTL).
- **Config layer from day one:** the app reads `mobile/tenants/<slug>.json` in a branded build; in umbrella mode the same shape arrives from `/resolve`. All code takes its base URL, brand and stores from one `useTenant()`, so no screen knows which mode it is in.

## 14. The mobile app (shape only)

- `mobile/` with Expo Router, TanStack Query, Zustand (cart, session, active person), react-hook-form with zod, NativeWind over a small design system that takes its colours from the tenant profile; `app.config.ts` reads the profile (`app name`, `package id`, `icon`, `splash`, colours, API base URL, stores, support numbers, licence text); one EAS build profile per tenant; RGP first.
- **Types from Swagger:** the API publishes a second Swagger document limited to the customer module (`SwaggerModule.createDocument(app, config, { include: [CustomerAppModule] })`, served at `/api/customer-json`); `openapi-typescript` generates the types and a typed fetch client in CI. DTOs carry `@ApiProperty` so the types are real (today most DTOs are bodies read as `any`, so the customer controllers use DTO classes from the start).
- `expo-image-picker` and `expo-image-manipulator` (compress to about 1600 px, JPEG), `expo-notifications` (FCM), `expo-secure-store` (tokens), the Razorpay RN SDK (development build), local **dose reminders** that work offline (a schedule kept on the device; the server never sees it), i18n English and Tamil matching the templates, Sentry.
- **Low-end Android (2 GB, slow 3G):** skeletons, cached images, paged lists, an offline banner, retry with backoff, no heavy maps, small bundles (Hermes, no unused locales).

## 15. Back office changes (Angular)

- **Sell > Online orders:** a queue with tabs New, Rx check, To pack, Out for delivery, Ready for pickup; a peek panel for the order (UI_PATTERNS), actions Confirm, Bill this order, Mark packed, Dispatch, Ready for pickup, Cancel with reason; payment and refund shown.
- **Sell > Prescriptions:** the pharmacist's review screen (section 8).
- **Settings > Customer app:** section 12.
- **Customer page:** a customer-app section: app login active, devices (revoke), last order, push on or off.
- Menu entries and permissions in `menu.ts` and the registry; app guide entries (the guide test requires one for each menu page); QA specs for each screen.

## 16. Compliance, enforced on the server
- **DPDP:** explicit consent screens (app, health data, marketing separately), consent records, export and erasure requests, no health data in messages or pushes, prescriptions through signed access with every view audited.
- **Schedules:** section 8; a health disclaimer on medicine screens; no diagnosis anywhere.
- **Google Play:** `docs/release/play-data-safety.md` (what is collected and why), Health apps declaration notes, a privacy policy URL per tenant, permission prompts only when used (camera when uploading, notifications when asked), in-app account deletion, the current target API level. Each tenant's app is published under **that pharmacy's own organisation developer account** (D-U-N-S): the onboarding checklist is `docs/release/tenant-app-onboarding.md` (a new `docs/release` folder; none exists yet).

## 17. Data (migrations, next numbers after 237; each with a rollback)

| # | Content |
|---|---|
| 238 | `customer_app` permission group and module grants; `audit_event.customer_id`, `actor_kind` |
| 239 | `app_account`, `app_device`, `app_otp`, `app_refresh_token`; `customer_message.kind` adds OTP, ORDER_STATUS, OFFER and `channel` adds PUSH with `to_token` |
| 240 | `store_online` (pincodes, delivery rules, slots, minimum, COD, hours) and `store_payment` (sealed Razorpay keys), `store_push` (sealed FCM) |
| 241 | `product` visibility flag and `product_image` (if pictures are in v1) |
| 242 | `rx_prescription`, `rx_image`, `rx_cover`, `rx_consent`, `rx_view` |
| 243 | `online_order`, `online_order_line`, `online_order_event`, `online_order_payment`; `sale.online_order_id`, `online_order_amount`; `sale_deliveries.dispatched_at`; `customer_commitment.source` |
| 244 | `erasure_request` |

Money rules sit in pure, tested files (`online-order-rules.ts`: totals, price protection, tender, refund sign rules; `otp-rules.ts`; `rx-cover-rules.ts`; `catalogue-rules.ts`), like the commitment and price-compare rules.

## 18. Build order (adjusted from the brief)

1. This document and the questions (**stop here**).
2. Tenant routing (Caddy edge, `TENANT_HOST`, control-plane host field) and the `customer_app` module wired through control plane, entitlement, API guard and Angular menu, with an empty `/c/health` that answers 403 when off.
3. Customer auth (OTP, tokens, devices, audit, rate limits) with OTP in MOCK and SMS adapter stub; the Swagger customer document and client generation; the `mobile/` scaffold, the tenant-profile config layer (branded and umbrella-ready) and the RGP profile.
4. Catalogue and availability endpoints; mobile search, product and home.
5. Prescriptions: consent, upload, private store and signed access, the pharmacist review screen.
6. Online orders, Razorpay, the webhook, the Online orders queue, "bill this order" at the POS, the delivery link, order-on-request through commitments.
7. The PUSH channel, order notifications, "My medicines" and one-tap reorder.
8. Wallet, dues view, account, deletion and erasure, Tamil, Sentry, analytics events.
9. Hardening: tests, a Maestro flow (sign in, search, cart, COD order, staff bills it), a performance pass, the EAS production build for RGP, the Play checklist.
10. Umbrella mode (resolver, store code registry, store code screen), **only after you approve**.

Each step ends with: its migration and rollback, Jest unit and API tests, Playwright specs where a screen changes, the AOT build, and this document's Status section updated with what was built and **how it was verified** (nothing is marked verified that was not run).

## 19. Risks
- **The shift tally** is protected by design: online money never touches a shift. A test proves a prepaid order billed at the POS leaves the drawer and the digital total unchanged.
- **Meta and SMS waits are outside the code:** WhatsApp is MOCK everywhere today, so until a verified account, a number and an approved authentication template exist the OTP rides on SMS or stays MOCK; SMS needs DLT registration.
- **Prescription data** is the most sensitive thing the system will hold. Signed access, audit of every view and the separate store are the controls; a leak is a DPDP event.
- **Price and stock drift** between order and billing (question 7).
- **Weak spots found in what exists** that the app must not inherit: the `files` view endpoint and the mime-only upload filter; no rate limiter; DTOs read as `any`; the audit actor is staff only.
- **Staff load:** a queue of online orders is new work at the counter; the plan's limits and the "minimum order" and slots settings are how a shop controls it.

## 20. Open questions (twelve)

1. **Brand and package id.** What goes in `in.<<brand>>.<slug>`: your own brand (the platform) or RGP's? Is the platform brand the umbrella app's name too?
2. **Domain and DNS.** Which domain for tenant addresses (`<slug>.<domain>`), and which DNS provider holds it (the wildcard certificate needs its API)?
3. **SMS provider.** MSG91 or another? Do you have DLT registration (entity, sender id, templates) or does it need starting?
4. **OTP and "do not contact".** A customer who told the shop to stop messaging them: may they still receive a sign-in code, and order-status pushes? (Recommended: yes for codes and order status, never for refills or offers.)
5. **What is visible online.** The whole catalogue by default with a per-product hide, or only products someone marks as online? Any category that is never sold online (devices, restricted items, anything you name)?
6. **Pictures in v1.** Product pictures do not exist. Ship v1 with category icons and add pictures later, or build the picture upload first?
7. **Stock and price at order time.** Reserve stock when an order is placed or only when staff confirm it? And for a prepaid order, bill at the **lower** of the agreed and the current price, or always the agreed price?
8. **How much of the money side now.** Pay dues online, and matching Razorpay settlements to the bank statement: in v1, or after the first orders? (Recommended: neither in v1.)
9. **Retention.** What must the shop keep, and for how long, for GST bills, Schedule H, H1 and X records and the prescriptions behind them, and what may be erased on a customer's request? This needs your CA or lawyer; it shapes the deletion screen's wording.
10. **Who reviews prescriptions.** Only the registered pharmacist, or a trained staff member for a first pass with the pharmacist approving? (The review rule decides the permission design.)
11. **Delivery.** Own staff and couriers only? Charges by pincode, by distance, or free above an amount? Same-day cut-off and slot windows? Is COD wanted from day one?
12. **RGP as the first tenant.** Which stores take online orders first, and is the first release a pilot (invited customers, one store, pickup only) or open to everyone? That decides how much of step 6 is needed before launch.

## Status
Design written 2026-11-21. Not started. Waiting for the answers to section 20.
