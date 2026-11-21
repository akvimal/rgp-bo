# Counter guide: common medicines for everyday, non-chronic problems, from stock

Status: designed 2026-10-31 (deferred), refined 2026-11-21 after the brand check, composition matching and price comparison were built. **Nothing is built.** Do not build past phase 1's screen until a clinical sign-off owner is named (see "Open decisions").

## What it is

A short guided dialog for counter staff and the pharmacist. A customer describes a common problem (a headache with vomiting, stomach pain, a burn); the guide asks the fewest questions that change the answer, stops with "see a doctor" when a warning sign is present, and otherwise shows what the shop has in stock for it: product, batch to sell first, expiry, price. Staff add the chosen product to the bill.

It is a tool for the person at the counter. It is not customer-facing and it does not diagnose. Whether to offer a medicine stays the pharmacist's decision, as in Check brand.

## What it is not

- No AI-written clinical advice at the counter. AI may help draft cards offline for a pharmacist to approve (see "Content"); it never answers at the counter.
- No prescription-only medicines. Schedule H, H1 and X products are never offered (the product's `schedule` flag already exists and `needsPrescription` in `composition-match.ts` reads it).
- No ranking by margin. The order is the card's order (first choice, then second).
- No chronic conditions (BP, diabetes, asthma control and so on). Those are for the doctor and the pharmacist's own advice.
- Legal position: India has no formal OTC list. The shop's pharmacist and advisor confirm what may be suggested without a prescription. This plan is not legal advice.

## The flow: five taps at most

Ask only what changes the outcome, in this order. A card declares which steps it needs, so a simple card skips the rest.

1. **Who is it for?** Child under 2, child 2 to 12, adult, over 60, pregnant or breastfeeding. Pre-filled (and skipped) when the customer on the bill has an age on record.
2. **The problem.** Pick a card (about 15 to begin with). Examples below.
3. **How long?** Under 2 days, 2 to 7 days, over 7 days. Past the card's limit the guide says "refer".
4. **Warning signs.** The card's own tick list of three to five, in plain words. Any tick stops the guide with "see a doctor" and shows **no medicines**.
5. **Anything else?** One screen of ticks that decide which options are safe: allergy to painkillers or antibiotics, ulcer or acidity, high BP, diabetes, kidney or liver problems, asthma, blood thinners, other medicines now. Pre-filled from the customer record where it exists.

### Example cards (the structure only: clinical content is written and signed off by a pharmacist)

- **Headache with vomiting.** Warning signs: sudden severe headache, fever with a stiff neck, a head injury, drowsiness or confusion, blurred vision, weakness or speech trouble, vomiting for over a day or unable to keep fluids down, a child under 5. Because many antiemetics are prescription-only, the likely result is simple measures, ORS and a non-prescription pain option, with a referral note.
- **Stomach pain.** Warning signs: severe or constant pain, pain on the right lower side, black stool or blood, fever, pregnancy, over 3 days.
- **Burn.** Warning signs: larger than the palm, face, hands, feet or genitals, large blisters, chemical or electrical, a young child.

## What comes out

- **Options from stock**, filtered by the answers. Each card option is a composition and strength (written as in the brand dictionary, for example "Paracetamol 500 mg"), a dosage form, an age range, a duration limit and a list of exclusions (the step 5 ticks it must not be given with). The options match the shop's products by composition key and form, the way Check brand and the price comparison already do.
- **Per product:** the batch to sell first (in date for at least 30 days), expiry, price per pack and per unit, stock count. Reuses `SaleSuggestionService.matches` and `liveBatches`.
- **Nothing in stock for the first choice:** show another brand of the same composition, or say "not available" and count the lost sale.
- **Guidance text** from the card: how to take it, what to watch for, when to come back. Written, signed off and translated; the system adds nothing of its own.
- **Add to bill** works through the same `BrandCheckBus` as Check brand: offered only while a bill is open.

## Content: the real risk

The guide is exactly as safe as its cards.

- A named **registered pharmacist (or doctor) signs off every card**. A card stores who approved it, when, and a version. A new version never changes bills already made; a card that is not approved does not appear.
- Cards are English and Tamil. The staff-facing text and the customer-facing line are both approved.
- **AI drafting is allowed offline only:** a model with web search drafts a card from the standard references (national treatment guidelines, essential medicines list, standard pharmacopoeias), with its sources, into a Draft state. A person edits and approves it. It uses the existing AI provider and monthly limit and is logged as its own assistant.
- Every option shows the card and version it came from.

## Data model (sketch)

Shared per business, editable by the Business Head (and the signed-off pharmacist), versioned.

- `guide_card` (id, key, name, name_ta, steps (which of the five apply), duration_limit_days, referral_text, referral_text_ta, status draft / approved / retired, version, approved_by, approved_on).
- `guide_warning` (card_id, text, text_ta, order): the red flags of step 4.
- `guide_option` (card_id, composition, form, age_min_months, age_max_months, max_days, excludes text[] (tags from step 5), order, guidance, guidance_ta, note). A product matches an option by composition key and form.
- `guide_use` (id, store_id, user_id, customer_id null, card_id, card_version, answers jsonb, outcome (GIVEN, REFERRED, DECLINED, NOTHING_IN_STOCK), products jsonb, created_on): the log for reports and the follow-up.

Prescription-only is never stored on the option: it is read from the product at the moment of matching, so a changed schedule takes effect at once.

## API (sketch)

- `GET /counter-guide/cards`: the approved cards with their steps and warnings.
- `POST /counter-guide/advise`: `{ cardkey, who, duration, warnings[], issues[], storeid, customerid? }`. Returns `{ refer: true, text }` when a warning or the duration stops it, otherwise the options with in-stock products. Pure rules decide (and are unit tested); the service only reads stock.
- `POST /counter-guide/use`: logs the outcome.
- Card editing endpoints (Business Head).

## Screens

- **Counter guide** box in the Sales header beside Check brand, opening a step dialog with large tap targets (chips, not typing). Pharmacy pack only, like Check brand.
- **Settings > Counter guide cards** (Business Head): list, edit, approve, retire; a Draft with AI button.
- **Reports:** demand by problem, how often referred, nothing in stock (lost sales), outcome by person.

## Extras

- **Follow-up:** after two days a "How is it?" contact through the existing contact-today worklist, in the customer's language (see customer relationships).
- **Referral note:** a printable or WhatsApp line saying why the doctor is advised.
- **Pre-fill** from the customer's record (age, allergies, conditions) where captured.
- Lost sales feed the buying brief the same way the "asked but not stocked" brand checks do.

## What already exists and is reused

- Composition keys and the form-aware matching (`composition-match.ts`, `dosage-form.ts`); stock by batch with expiry (`liveBatches`); prescription flag by schedule.
- The Check brand dialog, its header box and the bill bus.
- The brand dictionary (card options can be picked from real compositions) and the price lists (an option can show the Jan Aushadhi price per unit).
- The AI provider, model setting per assistant and usage log (for card drafting only).
- The alerts engine and contact-today worklist (follow-up); the audit log.

## Phases

1. **Cards and the step dialog**, about 15 problems, content signed off. Seeds written by a pharmacist (AI-drafted first if wanted). No stock yet: the options show as compositions.
2. **Stock link and the prescription-only block**, add to bill.
3. **Log, follow-up and reports.**
4. **Optional:** free text mapped to a card (a model only picks a card; it never writes advice).

The screen is the smaller part of phase 1; the cards are the work.

## Tests

- Pure rules: warning stops with no options; duration limit; age range; exclusions from step 5; prescription-only products dropped; first-choice order; nothing in stock gives the substitute or the refer text.
- Service against a scratch database: matching by composition and form, the batch to sell first, an unapproved card never returned.
- Browser: the five steps, a warning ending the guide with no products, add to bill, the log.

## Open decisions

1. **Who signs off the clinical content?** Required before phase 1's content is used. Name the person (registered pharmacist or doctor) and whether they approve in the app.
2. **Where does it appear?** The Sales header beside Check brand (recommended), or also inside the bill.
3. **Which problems come first?** Give the 10 to 15, or take a proposed list for the pharmacist to edit.
4. **Follow-up call in phase 1,** or after the log exists.
5. **Dose guidance:** whether cards carry typical doses (more clinical content to sign off) or only "as directed by the pharmacist".
6. **Prescription-only products:** never shown (recommended), or shown with a "pharmacist must confirm a prescription" gate.
7. **Pregnancy and children under 2:** refer always (safest, recommended) or give options with exclusions.
