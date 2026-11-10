# WhatsApp for customers: bills and notifications

Decided 2026-11-10 (supersedes the open questions in the 2026-10-31 design):

| Decision | Choice |
|---|---|
| Provider | Meta WhatsApp Cloud API, direct, behind a provider-neutral adapter |
| Number | Each store has its own WhatsApp number (phone number id + token per store) |
| Scope, release 1 | Bill copy and service notifications. Marketing later |
| Languages | English and Tamil templates, chosen per customer |
| Bill format | PDF attachment |

## What already exists (verified 2026-11-10)
- `messaging/` module: outbox worker (`processOutbox`, claim with `skip locked`, retry, `ChannelError`), Telegram adapter. `message_outbox` (migration 140) is **staff-only**: `recipient_user_id NOT NULL`, `chat_id varchar(40)`.
- Customer consent (migration 123): `contact_consent` YES/NO/null, `do_not_contact`, `preferred_channel`, contact log, 7-day cap.
- Customer WhatsApp is manual `wa.me` links (worklist, audiences, refills).
- `pdfkit` is installed and used for PO, price-list and audit PDFs. **There is no server-side sale bill PDF**; it has to be written.
- Per-store settings live on `stores` (migration 074 style columns).

## Build

### 1. Migration (next number after 179)
- `customer_message` (separate from the staff outbox, so staff alerts are untouched): business_id, store_id, customer_id, sale_id null, kind (BILL, REFILL, DUES, DELIVERY, REVIEW), template, language, params jsonb, to_mobile, status (PENDING, SENT, DELIVERED, READ, FAILED, SKIPPED), attempts, send_after, wa_message_id, last_error, created_on, sent_on, delivered_on, read_on. Unique on (kind, sale_id) where sale_id not null so a bill goes once.
- `store_whatsapp`: store_id, phone_number_id, waba_id, access token (encrypted at rest, same way as the AI key), display number, enabled, verified_on, auto_send_bill boolean, monthly_cap.
- Webhook verify token as a server env value.
- Permission `whatsapp` (view, send, settings).

### 2. Adapter
`whatsapp.adapter.ts`: `sendTemplate(store, to, template, lang, params, documentUrl?)`, `uploadMedia` (PDF), error mapping (permanent: invalid number, template not approved, opted out; retryable: 429, 5xx). Mobile normalised to E.164 (+91).

### 3. Bill PDF
`sales/bill-pdf.ts` with pdfkit: store header (name, address, GSTIN, licence numbers from store profile), bill no and date, customer, lines (name, batch, expiry, qty, MRP, rate, GST, amount), totals, payment mode, return policy line. Tamil text needs a Tamil-capable font bundled (pdfkit default fonts cannot draw it); decide whether the PDF itself is English-only (recommended for release 1) with only the message text in Tamil.

### 4. Sending
- "Send on WhatsApp" button on the completed bill and an optional auto-send per store.
- Rules: a mobile exists, `do_not_contact` is false, consent is not NO. Bill copy is a service message, so it goes to anyone who has not said NO.
- Worker (cron, like `tick`) claims rows, uploads the PDF, sends the template, stores `wa_message_id`.
- Quiet hours for notifications (not for a bill just paid).

### 5. Notifications (release 1)
Refill due, dues reminder, delivery update, review invite. Driven from the existing worklist/alerts code; the 7-day cap and consent rules already in migration 123 apply. Marketing stays off.

### 6. Webhook (built 2026-11-10)
`GET /whatsapp/webhook` answers Meta's registration check when `hub.verify_token` equals `WHATSAPP_VERIFY_TOKEN`. `POST /whatsapp/webhook` needs a valid `X-Hub-Signature-256` (HMAC-SHA256 of the raw body with `WHATSAPP_APP_SECRET`; with no secret set it accepts nothing) and then:
- moves a bill's message forward only (Sent, Delivered, Read) with Meta's own timestamps, or to Failed with Meta's reason; late or repeated receipts change nothing;
- an inbound STOP (or the Tamil word) sent to one of our store numbers sets `do_not_contact`, cancels that customer's waiting messages and writes an audit event.

Set-up in Meta: webhook callback URL `https://<your domain>/api/whatsapp/webhook` (the app's nginx sends `/api/` to the API and strips the prefix), the same verify token as `WHATSAPP_VERIFY_TOKEN`, subscribe to the `messages` field. The API host must be reachable from the internet over HTTPS. The Meta app secret goes in `WHATSAPP_APP_SECRET`. Not done: a reply to the customer confirming the stop, and a team inbox for other replies.

### 7. Screens (split 2026-11-10)
- **Settings > WhatsApp** (`/secure/settings/whatsapp`, permission `whatsappsettings.manage`, migration 181): per store the mode, number id, account id, token, monthly limit, the two switches and a test message.
- **Sell > WhatsApp** (`/secure/whatsapp`, permission `whatsapp.view`): the log of what was sent and its status, with a note and a link to Settings when the store is not switched on.
- The bill page keeps the send button and status (`whatsapp.send`). Consent and message language are on the customer form.

## Templates to submit to Meta (en + ta each)
1. `bill_copy`: utility. Header document, body: "Hi {{1}}, thank you for shopping at {{2}}. Your bill {{3}} for Rs {{4}} is attached."
2. `refill_due`: utility. "{{1}}, your medicine {{2}} may be due for a refill. Reply or call {{3}}."
3. `dues_reminder`: utility. "{{1}}, Rs {{2}} is pending at {{3}}. Thank you."
4. `delivery_update`: utility. "Your order {{1}} is {{2}}."
5. `review_invite`: utility or marketing (Meta decides category on review). Keep neutral wording.
No diagnosis or health detail in any template text.

## Outside the code (the real wait)
- Meta Business account verification, one WhatsApp Business Account, and one registered number per store (a number already on the WhatsApp app must be migrated or a new number used).
- Template approval (minutes to a day each).
- Test number and test credentials from Meta's developer console: nothing is sent to a real customer until these exist and the user says go.

## Open items
- Tamil font for the PDF (English-only PDF recommended first).
- Where the access token is held: per store row (encrypted) vs control-plane setting.
- Fee budget per store (monthly cap column is in the plan).
