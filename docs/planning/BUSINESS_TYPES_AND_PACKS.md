# Business types and packs

The app began as a pharmacy back office. The aim is one app for any shop or service business (pharmacy, electronics, apparel, fitness centre, auto repair, and so on), with what is specific to one kind of business **pluggable**: present for the businesses that need it, absent for the rest, and removable without touching core.

## 1. The model

| Piece | What it is |
|---|---|
| **Core** | What every business needs: sales and billing, customers, products and stock, purchasing, expenses, finance and bank reconciliation, staff, shifts and cash, alerts, audits, reports. Nothing in core names a kind of business. |
| **Business type** | `business.business_type` (`pharmacy`, `general`, later `electronics`, `apparel`, `fitness`, `autorepair`). Chosen when the business is set up. It decides the defaults, never the limits. |
| **Pack** | Everything one kind of business needs and no other does: its own backend module, screens, rules, settings, reports, alert kinds, checklist items. A pack lives in its own folder (`api-v2/src/packs/<name>`, `frontend/src/app/packs/<name>`) and core never imports it. |
| **Module** | A switch inside a pack (or core): `drug_register`, `hr`, `purchasing`, `stock_audits`... Per business, on or off. A pack's modules default **on** for the business types the pack is made for and **off** for the rest; any business can change them; a hosted plan caps them. |
| **Hook** | The way a pack joins core without core knowing it: `SaleHooks.check` (refuse a bill by a rule) and `SaleHooks.saved` (write the pack's own records inside the bill's transaction). More hook points are added as packs need them (product form sections, bill print, reports, alerts, checklists). |

`PACKS` in the environment lists the packs an installation loads (not set: all of them). A pack that is not loaded adds no routes and no hooks.

### What exists today (this change)
- `business.business_type` (default `pharmacy`: every business here is one), `packsOf(type)`, `PACKS` in `core/modules/modules.ts`; `resolveModules(raw, businessType)` turns a pack's modules on only for its types, and a business's own choice always wins.
- The module gate (API paths answer 403, menus and permissions disappear, plan caps) works for the new `drug_register` module like the others.
- `core/sale-hooks`: the extension point in billing.
- `api-v2/src/packs/pharmacy` and `frontend/src/app/packs/pharmacy`: the **drug register** (Schedule H, H1, X), and the chronic-medicine mobile rule, which used to be hard-coded in the sale controller.
- Finance's paper H1 register check and the standard audit plan for scheduled drugs are shown only to businesses that have the pharmacy pack.

## 2. What is still pharmacy-specific in core

Counted by the files that mention them (API / web / SQL). "Move" means: it belongs in the pharmacy pack and should be taken out of core.

| Area | Where it is now | Verdict |
|---|---|---|
| Drug schedule (`more_props.schedule`), H1 badge on the bill | product form, bill lines, price list (Rx column), stock count scope | **Move**: the attribute goes into the pharmacy attribute set; the badge and the Rx column become pack hooks |
| Composition (`more_props.composition`) | product form, bill line, search | **Move** (pharmacy attribute) |
| Chronic medicines, refill reminders, supply months, quality/refills screens | sale form, `quality/`, customers, sale suggestions, migrations 042, 052, 063, 066 | **Move**: a "refill follow-up" pack module |
| Prescription document required on sale (`more_props.document`) | sale form documents panel | **Generic**: "document required on sale" is useful elsewhere (warranty card, ID proof); keep in core, rename |
| Pharmacist registration, `store_type` pharmacy/other | staff details, users page, migrations 081, 082 | **Move** (pharmacy pack: staff attribute) |
| Drug licence types (retail 20/21, wholesale 20B/21B), FSSAI | store licences, alerts | **Generic list, pharmacy defaults**: licence types become per business type |
| Category names Medicine, OTC, Prescription (Rx) | seeds, filters, labels | **Per business type**: category seeds and labels |
| Return rules by category (refrigerated, inspect first) | `returns/`, migration 090 | **Generic mechanism**, pharmacy defaults |
| Stock audit: scheduled-drugs scope, scheduled-drugs standard plan | `stock-audits/` | **Move** the scope and plan into the pack (the plan is already left out for other types) |
| Pricing governance (trade-margin bands, generic discounting) | `products/pricing-*` | **Generic mechanism** (price policy by class), pharmacy classes as defaults |
| Batch and expiry on every stock line, MRP guard, near-expiry alerts | purchasing, stock, sale lines, alerts | **Generic but not universal**: needs an inventory tracking mode (below) |
| Wording: "pharmacy", "medicine", "pharmacist" in screens | about 25 files | **Terminology** per business type |

## 3. What other kinds of business need that core does not have

- **Electronics:** serial/IMEI numbers and warranty on a sold item, service tickets, exchange and repair history.
- **Apparel:** variants (size and colour) of one product, a size matrix at purchase and sale, seasonal markdowns.
- **Fitness centre:** memberships and plans (recurring, not stock), check-ins and attendance of members, renewals and expiry reminders, trainers' sessions.
- **Auto repair:** vehicles and their history, job cards (labour and parts on one bill), estimates and approvals, parts reserved to a job.

Each is a pack plus, for some, one change in core (below).

## 4. The core changes the packs need

1. **Inventory tracking mode per product class**: `batch+expiry` (pharmacy, food), `serial` (electronics), `variant` (apparel), `none` (services, memberships, labour). Today every stock line is a purchase-invoice batch with an expiry and an MRP. The model keeps working; the tracking mode decides which fields are asked for and checked, so a service line can be sold with no stock at all.
2. **Attribute sets instead of `more_props` free-for-all**: each business type (or pack) declares the product attributes it adds (name, type, required, shown on the bill or not). The product form, search and bill read the set. `more_props` stays as the storage.
3. **Terminology**: a labels map per business type ("Medicine" or "Product" or "Item"; "Pharmacist" or "Technician"; "Prescription" or "Job card"), applied through one lookup in the screens.
4. **Business type chosen at setup**: in the setup wizard and when a hosted tenant is provisioned (the control plane's plans already limit modules; they should also name the type).
5. **More hook points** as packs need them: product form sections, bill print footer and header, reports and dashboard tiles, alert kinds, shift checklist items, standard audit plans.

## 5. Order of work

| Phase | What | State |
|---|---|---|
| 1 | Business type, pack and module mechanism, sale hooks; the drug register as the first pack; the chronic rule moved out of the sale controller | **Built** |
| 2 | Move the rest of section 2 behind the pharmacy pack; terminology lookup; choose the business type at setup; a `general` business shows no pharmacy menu, field or word | Next |
| 3 | Inventory tracking modes (batch+expiry optional, then serial, then variants); attribute sets | After 2 |
| 4 | A first non-pharmacy pack as the proof (apparel variants or electronics serials are the nearest to what core has) | After 3 |
| 5 | Fitness and auto repair: they are different in kind (no stock, or parts plus labour), so they come last | Later |

## 6. Rules to keep it pluggable

- A feature goes into core only if two or more business types use it. Otherwise it is a pack's.
- Core never imports from `packs/`. A pack reaches core through a hook, a module switch or a route of its own.
- No kind of business is named in core: not in an `if (type === ...)`, not in a screen's words. A difference of behaviour is a hook or a module; a difference of words is a label.
- A pack's records are written inside the core transaction through `saved` hooks, so they stand or fall together.
- A pack's module, with its path in the module gate and its resource in the permission filter, is switchable per business; the defaults come from the business type.
- Every pack has its own tests, and a test that the module switched off leaves core unharmed (see `drug-register.spec.ts`, DREG-5).

## 7. Taking the pharmacy pack out

- For one business: `business.business_type = 'general'` (its modules default off), or switch `drug_register` off under Shop setup.
- For an installation: leave `pharmacy` out of `PACKS`. No pharmacy route or hook is loaded.
- For good: delete `api-v2/src/packs/pharmacy`, `frontend/src/app/packs/pharmacy`, the pack's import in `app.module.ts` and in `sales.module.ts`, and the panel element in `sale-form.component.html`. Section 2 lists what must have moved before this is complete.
