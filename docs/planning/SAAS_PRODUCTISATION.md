# SaaS productisation: business onboarding fields, feature packaging, tenant isolation

Status: **deferred** by the product owner (2026-10-22). Nothing here is built. Recorded so the analysis is not redone.

## 1. What business creation captures today

- Create form: name and an Active tick only.
- Business profile (set later by the Business Head): legal name, GSTIN, state code, address, pincode.
- Stores: location, address, pincode, phone, deposit threshold, Telegram chat, licences per store.

## 2. Fields worth capturing

| Group | Fields |
|---|---|
| Identity | display name, legal name, business type (retail pharmacy / wholesale / clinic with dispensary / general retail), constitution (proprietorship / partnership / LLP / Pvt Ltd), PAN, GSTIN, GST scheme (regular / composition), state, registered address, Udyam number (optional) |
| Contacts | owner name, mobile and email (becomes the first Business Head login), billing contact, support contact |
| Pharmacy compliance | pharmacist-in-charge name and registration number (bills, Schedule H register), FSSAI, shop and establishment licence; drug licences stay per store |
| Locale and documents | logo, bill header and footer, bill-number prefix, financial year start (April), timezone, currency, rounding, tax-inclusive default |
| Commercial | plan, enabled modules, limits (stores, users, bills per month), trial start / end, subscription status, billing cycle, billing GSTIN, sales owner |
| Technical | tenant slug or subdomain, per-business integrations (Telegram, WhatsApp, Razorpay), data retention |

Creation should be a wizard: identity, then plan and modules, then the first Business Head, then the first store.

## 3. Packaging: a core plus add-ons (not fixed tiers)

| Package | Contents |
|---|---|
| Core (always on) | POS and sales, returns, products, customers, stock, users and roles, store settings, business profile, basic reports, audit |
| Purchasing and payables | purchase requests and orders, invoices, vendors, payments |
| GST reconciliation | 2A/2B matching (needs Purchasing) |
| Cash and shifts | till, denominations, shift close, deposits |
| Stock control | transfers, cycle counts, bin locations, refills, discrepancies |
| Credit | store credit from returns, staff credit (salary recovery needs HR) |
| Expenses | ledger, approval, recurring entries, report |
| HR and payroll | staff, leave, attendance, KPI, payroll, pay stubs |
| Quality and oversight | grievances, staff sales, notifications |
| Multi-store | more than one store, transfers, store switcher |

## 4. Enforcement design

1. `business_feature` table: business, feature key, enabled, limits, expiry.
2. One choke point: a user's effective permissions = role permissions intersected with the business's enabled features. `/auth/me` returns the filtered list, so the existing menu hiding works unchanged; the role editor lists only enabled features.
3. `@Feature('hr')` guard on controllers as a second layer; schedulers and jobs skip disabled features (recurring expenses, Telegram digests).
4. Turning a module off keeps its data (hidden or read-only); re-enabling restores it.
5. RGP is grandfathered with everything on.

## 5. Blocking issue: tenant isolation

Only users and stores carry `business_id`. These are shared across every business today:

- products, customers, vendors
- roles (a Business Head editing a role changes it for all businesses)
- settings (`app_setting` has no business column: expense limit, KPI settings, staff credit cap)
- integration credentials (in `.env`)

The app is effectively single-tenant; a second business would share customers, catalogue and vendors.

Options:

- **Database per customer (recommended first).** Same code, one database or deployment per customer, feature flags per customer. Almost no change to the raw-SQL queries, strong isolation; cost is running migrations once per customer. Fine for the first 5 to 20 customers.
- **Shared database with `business_id` everywhere plus Postgres row-level security.** Better long-run economics but touches nearly every query and needs per-business roles and settings.

## 6. Suggested order when resumed

Entitlements, plans and the wizard are independent of the isolation choice, so build them first:

1. Expanded business form (section 2).
2. `business_feature` table and the permission intersection (section 4).
3. Plan and add-on picker for the Site Admin on the platform side (`/platform/login`).
4. Pricing and package matrix (not drafted yet).

Open decisions: database per customer for now (agreed in principle, not confirmed); pricing model.
