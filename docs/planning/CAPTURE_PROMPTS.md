# Capture prompts: rule-based extra data capture at the counter

Status: designed 2026-11-13, not built. Decisions at the end are open.

## Why

When a new customer buys a chronic medicine and gives a mobile and name, the counter has a good moment to capture more: location, how they
found us, whether they agree to WhatsApp messages (bill copy, refill reminders) and when their supply runs out. The dialog must be optional
and must never hold the queue.

That first use is one rule among many a business may want, so the design is generic: a configurable **capture prompt** that decides when to
ask, what to ask and what to do with the answers. The customer-profile dialog is only the first prompt shipped.

## What exists today (reused)

- `product.more_props->>'chronic'` flags chronic medicines; the refill list needs 3 or more chronic visits before it picks a customer up.
- `customer` already has locality, srctype, srcdesc, consent (YES/NO/blank), preferredchannel, messagelanguage, altmobile, email, relationship.
- WhatsApp service messages (bill, refill, dues) send unless consent is NO; promotional audiences need consent YES (`contactable()`).
- Sale hooks (`core/sale-hooks`) let a pack join in when a bill is made, but they are code, not business configuration.
- `core/config` holds single values (int, enum, bool) per business, which cannot hold a rule with conditions and a field list.
- Pure rules files with specs (`*-rules.ts`) are the repo pattern; customer saves go through `customer.service.save` with its checks.

## The model

A capture prompt is one rule: when it applies, what it asks, what happens after.

```json
{ "name": "New chronic customer profile",
  "event": "sale_completed",
  "when": [ {"customer":"is_new"}, {"customer":"has_mobile"},
            {"bill":"has_product_flag","value":"chronic"},
            {"customer":"blank","field":"consent"} ],
  "ask": ["consent", "language", "refill_reminder", "locality", "source"],
  "mode": "optional",
  "repeat": {"max_asks": 3, "gap_days": 1},
  "then": ["send_bill_whatsapp_if_consent"] }
```

### Triggers

- Event: sale completed first. Later: customer added, purchase received, return done.
- Conditions from a fixed vocabulary, combined with AND:
  - customer: is new (no earlier completed sale), has mobile, a named field is blank (consent, locality, source), visit count;
  - bill: has a product flag (chronic), category, schedule H, total above an amount;
  - context: store, role of the staff member, payment mode.
- Repeat: ask once, or up to N times with a gap, remembered from the responses table.
- Priority: when several prompts match, one dialog is shown with their fields merged and duplicates removed.

### Fields (the catalog)

Each field declares its control, where its answer is saved, its checks and whether it is sensitive. Checks reuse the existing ones (mobile,
email, names).

| Group | Fields |
|---|---|
| Core | WhatsApp consent, message language, preferred channel, location (typeahead of localities already used), how they found us, second mobile, email, relationship |
| Pharmacy pack | refill reminder (per chronic medicine, days of supply 15/30/60/90, reminder about 3 days before it runs out), prescriber |

A pack can register more fields, as packs register sale hooks. Custom free-form questions are not in the first versions.

### After-actions

Send the bill on WhatsApp (only when consent is Yes), raise a to-do for the manager, tag the customer.

### Behaviour per prompt

- Mode: **Optional** (Skip button, the default), **Nudge** (a badge on the bill), **Required** (before the next bill).
- Who sees it: roles and stores. Active: on/off and from a date. Labels: English and Tamil.
- Consent is never Required: it must be freely given, so the engine refuses that setting. Required is limited to non-sensitive fields.
- The consent choice is never pre-selected; Yes must be chosen by the customer's agreement. Who captured it, when and "at the counter" are stored.

## Storage and API

- `capture_prompt`: the definitions, per business, with defaults shipped by business type or pack.
- `capture_response`: each time a prompt was shown, saved or skipped, with answers, staff member and time. It gives the repeat rules their memory,
  records who captured each consent, and feeds the report.
- `capture-rules.ts` (pure, with a spec): condition matching, merging, repeat rules, the consent-not-required guard. Saving goes through the
  existing customer save so every current check still applies.
- Endpoints: `GET sales/:id/capture` returns the matching prompt with current values prefilled and the bill's context (for example the chronic
  items); `POST sales/:id/capture` saves the answers, or records a skip.
- The refill reminder needs one new table (customer, product, due date, days of supply); the refill list shows these alongside the median-gap
  reminders, so a customer is reminded from the first purchase instead of the fourth visit.

## Screens

- POS: a compact dialog after the bill is complete and printed. Esc and Skip close it; it never blocks the next bill.
- Settings > Capture prompts: list with on/off, editor (condition rows, ordered field checklist, mode, repeat), live preview, reset to default.
  The alerts "sentence to rule" assistant could draft prompts later.
- Report: shown / saved / skipped per prompt, store and staff member; could become a KPI measure for counter staff.

## Phases

1. Engine and dialog: migration, rules and spec, the field catalog (customer fields and consent), two shipped prompts (general "new customer
   profile", pharmacy "new chronic customer") with on/off and mode only, and the POS dialog.
2. Builder screen in Settings.
3. Refill reminder field (new table), after-actions, the report.
4. More events, custom questions, the KPI measure.

## Open decisions

1. Allow Required mode (off by default, non-sensitive fields only)? Recommended: yes.
2. Allow businesses to add their own questions later, saved as free answers on the customer? Recommended: defer.
3. Is phase 1 the right first cut (shipped prompts switched on and off only, builder in phase 2)? Recommended: yes.
4. Refill reminder per medicine or one date per customer? Recommended: per medicine.
5. Wording of the consent sentence staff read out: for the owner to confirm, with advice if wanted.
