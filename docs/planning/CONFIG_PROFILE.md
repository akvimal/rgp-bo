# Business setup file: export and import

Status: **built and verified** (2026-11-06, uncommitted). Scope of the first version: the business, its stores (with shift templates) and staff logins. No migration.

Screen: Settings > Business details > "Copy setup: export / import" (`/secure/settings/business-profile/transfer`). Business Head / Owner-operator only.

## What it does

- **Export** the setup as JSON (the full format) or Excel (the same thing laid out for typing). **Blank Excel template** has the headings and dropdowns.
- **Import** a JSON or Excel file: it is read, checked, and shown as a preview (new / changed / skipped, field by field). Nothing is saved until "Load this setup". The load is one transaction: all of it or none.
- New logins get a **temporary password**, shown once on the result screen (copy, or download CSV). Only the bcrypt hash is stored; the audit entry lists who got one, never the passwords. The answer carries `Cache-Control: no-store`.

## Rules

- Matched by name, never by id: store by name (case-insensitive), login by email, role by name.
- **Upsert only. Nothing is deleted.** A store, shift or login missing from the file is left alone.
- A key missing from the file means "leave as it is" (new record: the default). In JSON, `null` clears a value. In Excel, an empty cell means leave as it is.
- A login's stores in the file replace its store assignments in this business (first listed is the main store).
- Skipped with a reason (never fatal): owner logins (Business Head, Owner-operator, Site Admin), an email that belongs to another business, a removed login, an unknown role or store.
- Blocked (nothing is changed): a hosted plan's store or login limit would be passed (Counter and Personal logins are free), a shift-mode change on a store with a shift open, two stores here with the same name. A vault that still holds cash stays on (warning).
- Not in the file: passwords, MFA, keys, Telegram chat ids, logo, module switches, registered store PCs, products, stock, sales, history.

## Format

`{ format: "rgp-business-profile", schemaVersion: 1, business: {...}, stores: [{ name, ..., shifts: [...] }], staff: [{ email, fullName, phone, location, role, stores: [...] }] }`. Field lists are `BUSINESS_FIELDS` and `STORE_FIELDS` in `api-v2/src/modules/app/config-profile/config-profile.ts`. A newer `schemaVersion` than the app reads is refused.

## Code

`api-v2/src/modules/app/config-profile/`: `config-profile.ts` (checks, planner, temp password; pure), `config-profile-xlsx.ts` (workbook both ways), `config-profile.service.ts` (SQL, transaction, audit), controller (`/config-profile/export`, `export.xlsx`, `template.xlsx`, `read-xlsx`, `preview`, `apply`). `main.ts` takes a 5 MB body on `/config-profile` only (parsers are set up by hand there; Nest skips its own defaults once one is added). `PlatformService.roomLeft()` gives the seats left.

## Verified

Unit tests (`config-profile.spec.ts`, 18). Live against a scratch copy of the dev database (248 stores, 190 logins): JSON and Excel round trips show no changes; create, update, idempotent re-run, temporary password signs in, bad files rejected.

## Not built

- Customers, vendors, alert rules, settings and product categories in the file.
- A forced password change at first sign-in (the app has none): people are asked to use "Change password".
- A setup-wizard step "start from a file" and a control-plane "new customer from a profile".
- A "replace" mode that removes what the file does not list.
