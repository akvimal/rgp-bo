# WhatsApp media: send an image, video or PDF instead of plain text

Status: **planned 2026-11-19, nothing built.** Asked for: "as an alternative to the text message sent in WhatsApp for customers, based on the type of message, send media (image/video); the system should have configuration to save media files and allow to send." Builds on `docs/planning/WHATSAPP.md` (bill copy and notifications through the Meta Cloud API) and on the refill and contact work in `docs/planning/REFILL_CRM_DASHBOARD.md`.

## 1. What exists today (read from the code)

| Piece | Where | State |
|---|---|---|
| WhatsApp module | `api-v2/src/modules/app/whatsapp/` (rules, adapter, service with a 30 second queue worker, controller, webhook) | built 2026-11-10; every store is in MOCK mode, nothing leaves the server |
| Messages | table `customer_message` (kind BILL, REFILL, DUES, DELIVERY, REVIEW; status PENDING to READ; language en/ta) | one approved Meta template per kind and language, named `bill_copy_en` and so on (`templateName` in `whatsapp-rules.ts`) |
| Store numbers | table `store_whatsapp` (mode MOCK/LIVE, number id, sealed token, caps) | Settings > WhatsApp |
| Adapter | `whatsapp.adapter.ts` `send()` | already uploads a **document** (the bill PDF) and puts it in the template header; no image or video header yet |
| Files | `api-v2/src/modules/app/files/` (multer to the uploads folder) | used for invoices, prescriptions and so on; object storage is a deferred idea (`cloud-file-storage`) |
| Manual sending | Refills page, contact list: `wa.me` links with the text filled in | cannot attach media; the person sends from their own phone |
| Consent | `customer.contact_consent`, `do_not_contact`, STOP handling in the webhook | applies to every message |

Not done in the WhatsApp plan, and still the real wait: a verified Meta business account, a number per store, template approval and credentials. **Until those exist, media sent through the Business API cannot reach a customer.** That is why this plan has a second route (section 4) that works today.

## 2. What media means on WhatsApp (verify against Meta's current documentation before building)

- Outside the 24 hour chat window a business may send only an **approved template**. A template can have an **image, video or document header**, and Meta approves each variant. So "media instead of text" means one more template per (message kind, language, format), for example `refill_due_en` and `refill_due_img_en`.
- Inside 24 hours of the customer writing to the shop, any image or video may be sent without a template.
- Size and type limits as understood now: images JPEG or PNG up to about 5 MB, video MP4 (H.264 video, AAC audio) up to about 16 MB, documents up to about 100 MB. Uploaded media gets an id at Meta that expires, so it is cached and uploaded again when it has.
- Billing is per message by category, not by media; the existing monthly cap column stays the guard.
- Health details stay out of messages and media, as in the template rules already written: no diagnosis, no medicine names beyond what a template already carries.

## 3. Design

### 3.1 Media library
A shop-owned set of files, not customer data.
- Item: title, type (IMAGE, VIDEO, DOCUMENT), language (en, ta, or any), optional caption, valid from and to, status (DRAFT, APPROVED, ARCHIVED), file path, mime type, size, SHA-256, thumbnail, who added it and when.
- On upload: allowed types only, size limits per type (the Meta limits above, set lower if the owner wishes), mime type checked from the content and not the file name, a thumbnail for images (and for video if `ffmpeg` is installed; otherwise a placeholder). Video length is not checked without `ffmpeg`, so the size cap is the guard.
- An item must be **approved by a manager** before any message can use it; archiving removes it from choices without deleting what was already sent.
- No prescriptions, patient photos or customer documents: a warning on the upload and the library takes only the types above, kept in its own folder (`uploads/whatsapp-media/<business>/`) so it is never mixed with the sensitive files.
- Storage: the uploads folder through the files module now; the storage layer in `cloud-file-storage` (S3 compatible) is where it moves later, with a per-plan storage limit.

### 3.2 Message styles
A style says how one kind of message goes out.
- Key: business, optional store, message kind, language. Value: format (TEXT, IMAGE, VIDEO, DOCUMENT), library item, and the template name for that format.
- Resolution order: a store's own style, else the business's, else TEXT.
- **Always a fallback to text.** If the chosen template is not approved, the media item is not approved or has expired, or the media upload fails, the message goes as text and the row records `fallback_from` so the screen can say so. A message is never lost because a style was misconfigured.
- Chosen by kind, language and date (a festival video for a fortnight), never by a customer's health condition.

### 3.3 Template registry
- Table of template names with language, category (UTILITY, MARKETING), header format and status (PENDING, APPROVED, REJECTED), and when it was last checked.
- Filled by hand first (type the name and mark it approved once Meta has), with a "sync from Meta" button later using the template management API. A style may only use an APPROVED template.
- The screen lists, for each kind and language, which formats are ready.

### 3.4 Sending through the Business API
- `customer_message` gains `format`, `media_id` (library item) and `fallback_from`.
- The adapter's header builder grows from document to image and video; the Meta media id is cached per store number and file hash (table `wa_media_upload`: store, sha256, meta media id, uploaded on) and uploaded again after expiry.
- The consent rules do not change. A message that is not a service message (a campaign, a festival greeting) needs consent YES, like the audiences; the first release stays service messages only (open question 3).

### 3.5 The link page (works before Meta is ready)
Staff send through `wa.me` today, which can carry text only. A library item gets a short public page, `/m/<code>`, showing the image or playing the video with the shop's name, and the text message carries that link.
- No Meta template and no approval needed; works from the Refills page and contact list as they are.
- The code is random and unguessable, can expire, and the page carries no customer data. Opens are counted (not who opened it) so the style comparison has something to read.
- The `{medicine}` and other wording tokens already in the shop's text keep working; a new token `{media}` becomes the link, and when the chosen style is media and the wording has no `{media}` the link is added on a new line.
- Downside: a tap to open instead of an image in the chat. It is the stop-gap, and stays useful for video larger than Meta's limit.

### 3.6 Choosing at the point of sending
- The Refills page, the contact list and the bill page get a "Send as" choice: Text, Image, Video, PDF, limited to approved items for that kind and language, defaulting to the style. Staff cannot upload from here.
- A staff reply inside the 24 hour window may pick any approved item (needs inbound messages stored; the webhook receives them today and acts on STOP only). Later phase.

### 3.7 Measuring what works
Record the style, format and library item on the contact (`customer_contact_log` gets `style` and `media_id`, written the same way as the other contact columns). The turnaround measure then answers "do customers who got the video come back more often than those who got text?", beside the baseline already planned, with counts next to every percentage. Read receipts and link opens give a second, weaker signal.

## 4. Screens
- **Settings > WhatsApp > Media**: the library (upload, preview, approve, archive, expiry), size and type rules, storage used.
- **Settings > WhatsApp > Message styles**: a table of kind by language showing the format, the item, the template and its status, with a phone-shaped preview and a "send me a test" button (MOCK shows it on screen).
- **Sell > WhatsApp** (the log): shows the format and, for a fallback, why.
- Permission: `whatsappsettings.manage` for the library and styles (as Settings > WhatsApp today); a new action `media.approve` for approving, owner by default; `whatsapp.send` is enough to choose among approved items.

## 5. Data (migration 231)
- `wa_media` (library), `wa_style`, `wa_template`, `wa_media_upload` as above, `wa_media_link` (code, media id, expires on, opens), and the new columns on `customer_message` and `customer_contact_log`. Rollback in `231_rollback.sql`. Test on a copy of the database first, as with 230.
- No change to existing rows: every current message is TEXT with no media.

## 6. Build order
1. **Library and styles with text fallback, and the link page** (works now): migration, upload and approve, styles screen, `/m/<code>` page, "Send as" on Refills and the contact list, format and item recorded on the contact.
2. **Image headers through the Business API**: template registry, adapter header and media id cache, styles that use IMAGE, fallback logging. Needs Meta credentials and approved image templates to go live; works in MOCK before that.
3. **Style comparison** on the follow-ups page and manager scorecard; then **video headers**, replying with media inside 24 hours, and seasonal announcements (needs the marketing and consent decision).

## 7. Open questions (defaults taken if not answered)
1. Which route first? Default: the link page and the library (phase 1), then Business API images.
2. Which kinds first? Default: refill reminders and delivery updates; review invites after.
3. Marketing content (festival greetings, offers)? Default: **not allowed in the first release**; service messages only, as WhatsApp release 1.
4. Who approves media? Default: the owner roles; a Store Head may upload drafts.
5. Limits? Default: images 5 MB, video 16 MB and about 30 seconds, documents 10 MB; local storage for now.
6. Language: one item per language, or one for all? Default: either, chosen per item.

## 8. Risks and notes
- **Meta rules change** (limits, categories, template review). The limits live in one settings object, not scattered through the code.
- **Rejected templates**: a media template may be rejected or recategorised as marketing, which costs more. The fallback to text keeps messages flowing, and the registry shows the status.
- **Public link pages** must not expose anything but the library item: random codes, no directory listing, expiry, `noindex`, and a take-down switch (archive the item, the page answers "no longer available").
- **Storage growth** from video: a plan limit and a "storage used" figure on the library screen.
- **Copyright and likeness**: the owner is responsible for what is uploaded; the upload screen says so, and the library shows who added each item.
- **Tamil** captions and template text are drafts for a native speaker to review, as elsewhere.
- Nothing is sent to a real customer without the Meta credentials and an explicit go-ahead; stores stay in MOCK until switched on, as in the WhatsApp plan.

## 9. Tests planned
Pure rules (style resolution, fallback reasons, file checks, link expiry) with unit tests; the migration on a copy of the database (apply, re-run, roll back); the adapter header builder against a stubbed Meta; an API run on a scratch database for upload, approve, send as text, image (MOCK) and fallback; the link page for an unknown, expired and archived code; a Playwright spec for the library and the styles screen.
