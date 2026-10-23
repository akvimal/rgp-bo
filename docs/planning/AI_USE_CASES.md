# Where AI earns its place in the pharmacy app

Status: **analysed and deferred** by the product owner (2026-10-23). Nothing here is built except the plumbing noted in section 6. Recorded so the thinking is not redone.

## 1. How to decide

- **AI is justified when the input is unstructured**: photos, scans, handwriting, free text, messy names.
- **Plain code is better for numbers** (buying patterns, refill timing, forecasting, anomalies): cheaper, explainable, nothing invented.
- **Nothing is called per bill at the till.** Anything the till shows is worked out beforehand (latency, cost, and no model advice at the counter).
- **A person reviews anything that touches money, stock or a patient.** The model suggests; it never completes.

## 2. The use cases, ranked

| # | Use case | AI? | Value | Risk | State |
|---|---|---|---|---|---|
| 1 | **Purchase invoices**: vision model as the fallback when local reading fails; vendor aliasing; matching lines to the product master | yes, as a fallback | highest (about 1,700 invoices keyed by hand) | low: vendor prices, not patient data; totals check and review catch errors | local reading (PDF text, OCR) built and tuned on two real layouts |
| 2 | **Product master enrichment and clean-up**: generic name, composition, therapeutic class, usual course length, schedule, duplicates; also maps the columns of a messy CSV import | yes, a batch job, cached and reviewed | high: an enabler for suggestions, substitutions, search, GST matching and the deferred product import | low | not started |
| 3 | **Prescription capture**: read medicines, strengths, doctor, patient; suggest bill lines; fill the Schedule H / H1 register entry | yes | high | **high**: handwriting misreads become dispensing errors; a prescription image is health data | not started; no prescription handling exists |
| 4 | **Other pharmacies' bills** (section 3) | yes | medium to high | medium: customer data, needs consent | not started |
| 5 | **Customer buying patterns**: next refill date, lapsed customers, what is bought together | mostly **no** (SQL and simple statistics); a model only for the wording of a reminder, such as a Tamil message | medium | low | refill reminders and per-medicine supply months already exist |
| 6 | **Up / cross-selling** | not at the till; the model enriches the product master (row 2) offline | medium to high | low commercially; **drug-interaction advice needs a licensed clinical database, not a language model** | rule-based suggestions built (bought together, same composition, bulk supply); every show / add / dismiss is logged, so measure the acceptance rate first |
| 7 | **Owner's daily briefing** in English or Tamil, written from numbers the app already computes | yes, summarising only | medium | low | not started; fits the alerts and Telegram plan |
| 8 | **Ask the data in plain words** | yes (text to query) | medium | medium: needs read-only views and row limits | later |

Better as statistics than AI: reorder forecasting; cash-difference, adjustment and discount anomaly checks; price-change flags between invoices.

## 3. "Medical bills" = bills from other pharmacies

A customer brings (handed over, or sent on WhatsApp) the sale bill of another pharmacy. Uses, in order of value:
1. **Read the lines** (medicine, strength, quantity, price, date) and match them to our products: shows which are in stock here, at what price, and any same-composition alternative (win-back and price-match).
2. **Add to the customer's history** what they buy elsewhere, so refill reminders and buying patterns see the whole picture (a lost sale becomes visible).
3. **Onboard a new customer** from a bill: name, medicines, and the supply length for chronic medicines.

Design notes: it is a document upload on the customer record, read like an invoice (local reading first, a vision model when that fails); a person confirms the lines; nothing becomes a sale. **Consent first**: the bill may carry the patient's name and conditions, so the customer agrees (recorded on the customer) before the image goes to any model. WhatsApp intake is its own piece of work (the WhatsApp Business API); until then it is a photo taken or uploaded at the counter.

## 4. Privacy and consent

- **Invoices**: the product owner agreed to send images to an AI provider, **per customer (the shop) and with consent**. Switchable per account; a customer with no key or with the assistant off sends nothing.
- **Prescriptions and other pharmacies' bills** are health data: consent from the patient or customer is recorded before an image is sent; use only a provider that keeps nothing (OpenRouter routes between providers, so allow-list named zero-retention providers with `AI_ALLOWED_MODELS`, or run it on the shop's own setup); keep the extracted text, and the image only as long as the shop already must keep a prescription. Check the retention duty and the H1 register format with the pharmacist or the licensing authority; do not guess.
- A person verifies every extracted line; the model never adds a line to a bill, a stock movement or a register by itself.

## 5. Order when resumed

1. Invoice vision fallback, with vendor and product matching (measure how often the fallback runs and what it costs per invoice).
2. Product master enrichment.
3. Prescription capture, as a pilot on anonymised samples.
4. Other pharmacies' bills.
5. Daily briefing and customer message drafting.
6. Ask the data.

## 6. What is already in place

- **The alert assistant** ("Describe an alert", Settings > Alerts): one stateless call that drafts a rule. The weakest use of AI here; it is small and done, and will not be extended.
- **The plumbing it needed, and which the cases above will reuse**: `api-v2/src/modules/app/alerts/ai-provider.ts` (OpenRouter with a model chosen in the app, or a direct Anthropic key; allow list; `AI_PROVIDER=off`), a per-customer key set in the control plane (stored encrypted, the platform's key otherwise, or none), and a per-business draft rate limit.
- **Local invoice reading** and **rule-based suggestions**, above.

## 7. Open, to supply when resumed

- A handful of real invoices (digital and photographed), and a few prescriptions with patient details covered.
- The model and who pays for it (the platform's account, or the customer's own key).
- A named person to review Tamil wording of customer messages.
