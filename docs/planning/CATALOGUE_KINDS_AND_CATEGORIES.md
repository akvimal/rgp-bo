# Catalogue: product kinds, categories and attributes by business type

Status: **scoped, not built** (2026-10-25). A follow-on to `BUSINESS_TYPES_AND_PACKS.md`, phases 3 to 5.

## 1. Why

The app assumes that everything sold is a stocked item bought from a vendor in batches, and that the categories and fields of a product are a pharmacy's (Medicine, OTC, schedule, composition...). Other businesses differ in two ways:

1. **What they sell is not only stocked items.** A beauty salon sells a haircut (a service) and shampoo (an item). A fitness centre sells a membership (a plan that runs over time) and whey protein (an item). An auto repair shop sells labour (a service) and parts (items). A clinic sells consultations and medicines.
2. **The categories and the fields of a product belong to the business type**, and the owner should be able to adjust them. A garment has size and colour; a phone has IMEI and warranty; a haircut has a duration.

Today the categories and fields come from code (`api-v2/src/packs/pharmacy/pharmacy-config.ts`, served by `GET /packs/config`). A business that is not a pharmacy has none, and nobody can add any from the app.

## 2. What the product record is today (the constraints)

- `product`: `title` (unique, 40 characters), `product_code`, `pack`, `hsn_code`, `mfr`, `brand`, `category` (free text, 40), `description`, `tax_pcnt`, `more_props` (JSON), `bin_location`, `return_rule`, `min_stock`.
- Stock is by **batch**: a purchase item gives a batch with expiry, cost and MRP; a bill line points at that purchase item (`itemid` plus `batch`). A sale of something with no batch is not possible today.
- Rules that assume a stocked item: the MRP guard, price policy and price increases, stock counts and audits, the reorder list, expiry alerts, the outage price list, returns by `return_rule`, purchasing.

So a service cannot be sold today, and a plan cannot exist at all. That is the core change.

## 3. The model

### 3.1 Kind of catalogue entry

Every product has a **kind**:

| Kind | What it is | Examples | Stock | Time |
|---|---|---|---|---|
| `item` | a thing that is bought, held and sold | medicine, shampoo, whey protein, a tyre | yes (batch, or serial, or plain quantity) | no |
| `service` | work done for the customer, sold once per occasion | haircut, oil change, consultation | no (may consume items) | optional duration |
| `plan` | a right that runs over time or a count of uses | monthly membership, 10-session pack, annual maintenance contract | no | start, end, sessions |
| `bundle` (later) | a fixed set sold at one price | bridal package, service kit | its parts | no |

`item` is today's behaviour and stays the default, so nothing existing changes.

### 3.2 Categories belong to a business, seeded by its type

- A **category** has: name, optional parent (one or two levels), the **kind** it creates by default, a **tax default** (HSN for items, SAC for services, rate), an **attribute set**, and for items a **tracking mode**.
- The business has its own list. When the business type is chosen, the list is **seeded from a template** of that type, and the owner can rename, add, hide or reorder. Nothing is shared between businesses.
- `product.category` becomes a reference to the business's category (the old text is migrated into categories one for one, so no product changes meaning).
- A pack can mark a category and some of its fields **locked**: the pharmacy pack's Medicine category keeps `schedule` because the drug register depends on it. Locked fields cannot be removed; other fields can be added.

### 3.3 Attribute sets

- An attribute set is a list of fields: label, type (text, number, choice with options, yes/no, date), required, **shown on the bill**, **searchable in sales**, **printed**, and (for a few built-in ones) **drives a rule** (schedule, expiry, serial).
- Stored per product in `more_props`, as now. The product form, the sale line, the product search and the bill print read the set instead of the pharmacy-only code.
- Types a template can start from: pharmacy (schedule, composition, chronic, generic, document), apparel (size, colour, season), electronics (brand model, warranty months, IMEI or serial), salon and fitness (duration, who may do it, sessions), auto (vehicle make, part number, warranty).

### 3.4 Item tracking modes

Chosen per category, because it decides what a purchase and a sale ask for:

| Mode | What is recorded | Used by |
|---|---|---|
| `batch_expiry` | batch, expiry (today) | pharmacy, food, cosmetics |
| `batch` | batch only | general retail |
| `serial` | one serial or IMEI per unit | electronics, appliances |
| `variant` | one stock line per size and colour | apparel |
| `quantity` | a plain count | consumables, spares |

Today's batch table carries the first two; serial and variants are new in the sale line and purchase item.

### 3.5 Services and plans in the till

- **Service line:** no batch and no stock movement. Carries duration, the **provider** (the stylist, technician, trainer) and an optional appointment time. A service can list **consumables** (this haircut uses 10 ml of colour) that are taken from stock when it is sold, or ignored in the first version.
- **Plan line:** names the member, the start date, the end date or the number of sessions, and creates a **membership record**. Renewal, freeze, balance of sessions and expiry are on that record; an alert warns before it ends (the alerts engine already has the structure).
- **Customer** becomes the member or client: the record needs only what it has today, plus the plans it holds and the services it has had.

### 3.6 What each rule does for each kind

| Area | Item | Service | Plan |
|---|---|---|---|
| Stock, counts, audits, reorder, expiry alerts | yes | no | no |
| Purchasing | yes | no (service bills from vendors are expenses) | no |
| MRP guard, price policy, price approvals | yes | price list only; approval above a limit | price list only |
| Tax | HSN, rate | SAC, rate | SAC, rate |
| Returns | only if the business allows returns (3.7), then by return rule | none, or a credit by decision | refund of the unused part, by decision |
| Bill print | batch, expiry | provider, duration | validity, sessions |
| Reports | by product and category | by service and by provider | active members, renewals, churn |
| Outage price list | yes | yes | yes |

### 3.7 Returns: a global switch, then rules under it

**Built 2026-10-25 (the switch only; the rest of this section is still scope):** module `returns` per business (Shop setup > Modules; on by default, gates `/salereturns` and `/sales/returns`, hides the Returns tab and permission group) and `stores.returns_allowed` per store (Settings > Store > Cash & shifts; migration 105). The store can only narrow the business. Returns already recorded can still be settled. The bill print says goods are not taken back when either is off. QA `returns-switch.spec.ts` RS-1..4.

Some businesses do not take returns at all (a salon, a fitness centre, a made-to-order shop), others only for some things. Today the only control is `product.return_rule`, per product, and the returns screens and API are always on. So:

1. **Global flag** on the business: `returns_allowed` (a module switch like the others: `returns`). Off means the returns menu, the "return" action on a bill and the `/returns` API are gone (403), exactly as a switched-off module is today. Nothing already recorded is deleted; switching it back on restores everything.
2. **Default by business type** from the pack or template: pharmacy on (with its own limits), salon and fitness off, retail on.
3. **Below the flag, the rules narrow it, never widen it:** category default (`return_rule`), then product override; by kind (service and plan: none unless the business chooses a credit or a pro-rata refund); and the return window in days (the bill already carries `expreturndays`).
4. **When the flag is off, what a mistaken or disputed sale does** must still be possible: a **cancel or void** of a bill the same day with approval, and a **credit note by decision**. These are separate from a return of goods and need their own small rule, or staff will work around it.
5. **The bill print** states the policy from the flag ("No returns or exchange") instead of a pharmacy's fixed sentence.

## 4. Templates by business type (what ships)

| Type | Categories (kind) and the fields they start with |
|---|---|
| Pharmacy | Medicine (item; schedule, composition, chronic, generic, document), OTC (item; subcategory, no-expiry), Surgical and devices (item; warranty), Health foods (item) |
| Clinic | Consultation (service; duration, doctor), Procedure (service), Medicine (item, as pharmacy) |
| Salon | Hair, Skin, Nails (service; duration, provider), Hair care and Skin care products (item; brand, size), Packages (bundle) |
| Fitness | Membership (plan; term, sessions, freeze allowed), Personal training (plan, sessions), Supplements and merchandise (item; flavour, size) |
| Apparel | Garments (item, variant; size, colour, season), Accessories (item), Alterations (service) |
| Electronics | Phones and devices (item, serial; model, warranty, IMEI), Accessories (item, quantity), Repair (service), Extended warranty (plan) |
| Auto repair | Labour (service; duration, technician), Parts (item, quantity; part number, vehicle fit), Service contract (plan) |

These are starting points; the owner edits them.

## 5. Where it touches the code

| Part | Change |
|---|---|
| Database | `product.kind`; `product_category` (business, name, parent, kind default, tax default, attribute set, tracking mode, locked, sort); `attribute_set` and fields; `member_plan` (customer, product, start, end, sessions total and used, status); bill line allows no batch for a service or plan; provider on the bill line. Migration turns each distinct `product.category` into a category of the business |
| `GET /packs/config` | returns the business's own categories and attribute sets (from its tables) merged with the pack's locked ones, so the frontend contract barely changes |
| Product form and list | category chosen from the business's list; fields from the set; kind shown; service and plan hide stock, pack and bin |
| Till | a service or plan line; provider picker; membership created on completion; no stock check for a service |
| Modules | a `returns` module (flag), gating the returns screens and API; `return_rule` and the bill print follow it |
| Hooks | `check` and `saved` already exist: a plan creates its record in `saved`; a serial item is checked in `check` |
| Stock, purchasing, audits, alerts | skip non-items; a plan-expiring alert; serial and variant stock |
| Settings | a **Catalogue** screen for the Business Head: categories, kinds, attribute sets, templates, hide or show |
| Reports | revenue by kind; by provider; members |
| Pricing governance | applies only where the category says so |

## 6. Phasing

| Step | What | Depends on |
|---|---|---|
| A | Categories table and the Catalogue screen; attribute sets; product form and sale line read them; migration of existing categories; templates for each type | packs phase 2 (done) |
| B | `kind` and services: a bill line without a batch; provider; services skip stock, audits, MRP guard; SAC and tax | A |
| C | Item tracking modes: quantity, then serial, then variants | A |
| D | Plans and memberships: record, renewal, freeze, sessions, expiry alert, member list | B |
| E | Consumables used by a service; bundles | B, C |
| F | Appointments and provider commission (a separate scope: calendar, no-show, payout) | B |

A and B unlock a salon or a repair shop; D unlocks a fitness centre; C unlocks electronics and apparel. The first non-pharmacy pack (packs phase 4) should be built on A and B together.

## 7. Decisions to take before building

1. **Own categories or pack categories only?** Recommended: the business's own, seeded by its type, with a pack able to lock what its rules need.
2. **One product table or a separate service table?** Recommended: one table with `kind`, so search, price lists, bills and reports stay single.
3. **Does a service reduce stock through consumables in the first version?** Recommended: no, add in step E.
4. **Is the provider a user or a staff record?** A salon's stylist is not always a login. Recommended: a staff record (HR), optional login.
5. **Plans: prepaid or billed monthly?** Prepaid in the first version (one bill, a term). Recurring billing needs the payments side and comes later.
6. **Product title is unique and 40 characters.** A garment in several sizes, or a service per stylist, needs longer titles or variants; decide whether to relax the rule for non-pharmacy business types.
7. **Returns flag:** confirm the default per business type, and what replaces a return when it is off (void on the same day, credit note by decision).
8. **Pharmacy's existing data.** All products keep working: they become `item` under the migrated categories. Confirm that the Medicine and OTC categories stay locked.

## 8. Risks

- The sale line and the stock table are the heart of the app; a bill line with no batch touches billing, returns, shift totals, GST and reports. This needs the same care as the bill-number concurrency work and its tests.
- A free-form attribute set can become a mess if every business makes its own; the templates and a short list of field types keep it controlled.
- Pricing governance, stock audits and the outage kit were written for items only and each needs a check that it skips services.
- Hosted plans (`entitlements`) may need to price by kind (services and plans are a bigger module than items).

## 9. Out of scope here

Appointments and calendars, provider commission and payroll, recurring billing, online booking, loyalty, and multi-currency. Each is its own scope once services and plans exist.
