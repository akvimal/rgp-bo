# RGP Back Office — QA suite runbook

Self-running Playwright suite + realistic API data generator for `feature/shift-cash-phase1`.
Case IDs map 1:1 to `docs/testing/manual-test-plan.html`.

## One-time

```bash
cd qa
npm install
npx playwright install chromium
cp .env.example .env          # adjust ports only if your machine differs
node scripts/verify-password.mjs
```

## Full cycle

```bash
npm run stack:up      # down -v -> build -> postgres -> bootstrap schema (ddl 001-005 + migrations 008-025 + demo 006) -> api + frontend
npm run seed          # ~3-4 min: 3 businesses, 8 stores, 25 users, 800 products, ~550 sales, 48 shifts (via the API)
npm test              # runs every spec; writes report/index.html
npm run coverage-check # spec IDs vs manual-test-plan.html
```

Bands: `npm run test:p0` (~62) | `test:p1` (~44) | `test:p2` (~28).
Status: **All 3 phases complete** — 132 tests green, stable across repeated runs, **120/120 manual-plan
case IDs covered** across all 19 modules. 15 findings fixed (below / `report/index.html`), plus the
cashier shift-close feature (SHIFT-STAFF / SHIFT-REQUIRED specs, CASH-13 flipped).
Iterate on the schema/data only: `npm run stack:bootstrap && npm run seed:reset`.
Tear down: `npm run stack:down` (keeps volume) or `npm run stack:down -- --wipe`.

## Layout

| Path | What |
|---|---|
| `docker/compose.qa.yml` | override: empty-DB init + pg_stat_statements; ports/JWT via env in `scripts/_env.sh` |
| `scripts/` | `stack-up` / `bootstrap-db` / `stack-down` / `verify-password` |
| `seed/` | API data generator — `catalog.ts` (masters), `operations.ts` (POs/GRN + sales history), `run.ts` |
| `seed/manifest.json` | generated: stable ids/logins the specs resolve against (`fixtures/data.ts`) |
| `fixtures/` | `auth.ts` (sessionStorage injection), `perf.ts` (metrics capture), `index.ts` (the `test` object) |
| `support/selectors.ts` | every `data-testid` added to the Angular app |
| `specs/*.spec.ts` | one file per module, one `test('<ID> ...')` per case, tagged `@p0/@p1/@p2` + type |
| `reporters/perf-reporter.ts` | merges pass/fail + per-case browser/API/DB metrics + pg_stat_statements → `report/index.html` |

## Seed accounts (password `admin123`)

`siteadmin@local.test` · `businesshead@local.test` · `storehead@local.test` · `sales1@local.test` · `sales2@local.test`
Generated: `bh.<slug>@qa.local`, `role.approver@qa.local`, `role.readonly@qa.local` (see `seed/manifest.json`).

## Findings — GitHub issues #130–144 (akvimal/rgp-bo). **All 15 FIXED + all issues CLOSED** on `feature/shift-cash-phase1`.

Fixes in commits `2825d1f6a` (#130, #132), `151c7d42e` (#131, #133–142), `61300b9dc` (#143, #144) — not pushed.
Every spec now asserts the *fixed* behaviour. Full request detail in `report/index.html`.
Two more filed and fixed in commit `61300b9dc` (issues closed): **[#143](https://github.com/akvimal/rgp-bo/issues/143)**
(SALE-10 — over-return: both `/sales/returns` and `/salereturns` capped at sold qty net of prior returns) and
**[#144](https://github.com/akvimal/rgp-bo/issues/144)** (PROD-2 — `product.service` validates a non-blank,
non-duplicate title). Their specs are flipped to assert the fix.

| # | Finding | Case | Fix |
|---|---|---|---|
| [130](https://github.com/akvimal/rgp-bo/issues/130) | Shift report 500s (bad `created_on` order) | CASH-14, SALE-11 | `store.service.ts` order by `transdate`/`id` |
| [131](https://github.com/akvimal/rgp-bo/issues/131) | Deactivated users can still log in | USR-4 | `auth.service.login` checks `isActive`/`isArchived` |
| [132](https://github.com/akvimal/rgp-bo/issues/132) | Price history / set-sale-price 500 | PROD-5/8, INV-8 | controller null-guard · `findSalePrice` qualified cols · `addPrice` clamps effdate |
| [133](https://github.com/akvimal/rgp-bo/issues/133) | Shifts + Delivery-Partners routes bounce to `/login` | SHIFTS-NAV, DLVP-3 | `005_seed.sql` + migration `023` add the paths |
| [134](https://github.com/akvimal/rgp-bo/issues/134) | `/dashboard/admin-summary` not admin-gated | DASH | `dashboard.service` role check (Site Admin / Business Head) |
| [135](https://github.com/akvimal/rgp-bo/issues/135) | Empty PO submits and auto-approves | PO-7 | `purchase.service.submitOrder` rejects 0 line items |
| [136](https://github.com/akvimal/rgp-bo/issues/136) | A SUBMITTED PO can be deleted | PO-8 | delete guard: only `PENDING` |
| [137](https://github.com/akvimal/rgp-bo/issues/137) | Sale accepted when tenders ≠ total | SALE-2 | `sale.service.create` tender check (counter sales) |
| [138](https://github.com/akvimal/rgp-bo/issues/138) | Oversell accepted by the API | SALE-4 / STK-7 | `sale.service.create` per-batch availability check |
| [139](https://github.com/akvimal/rgp-bo/issues/139) | Negative price / tax accepted | PROD-7 | `product.service` validates `saleprice`/`taxpcnt` ≥ 0 |
| [140](https://github.com/akvimal/rgp-bo/issues/140) | Re-closing a closed shift unguarded | CASH-15 | `store.service.closeShift` rejects `CLOSED` |
| [141](https://github.com/akvimal/rgp-bo/issues/141) | Change-password screen unreachable | AUTH-7/8 | `AuthModule` before `AppRoutingModule` (wildcard last) + login link |
| [142](https://github.com/akvimal/rgp-bo/issues/142) | Second open shift per store allowed | CASH-4 | `store.service.createShift` rejects if an OPEN shift exists |

Not a bug (recorded as behaviour): duplicate vendor name/GST is blocked with HTTP 409 (`VEND-2`).

## Settings the suite expects

`pricing/sale_mrp_guard` and `pricing/sale_gst_guard` are `off` on the QA database: many specs and the seed post bills at the batch's own GST rate, which the GST guard (migration 149) would send back. `gst-sale-rate.spec.ts` (GSTS-1..4) and `price-policy.spec.ts` switch the guard they test on for themselves and put it back.

## Running specs against a scratch stack (without wiping the dev volume)

The specs read `QA_BASE_URL` (the frontend), `QA_API_URL` and `QA_ADMIN_PASS`, so they can run against any stack that has the seed logins, for example a scratch database with the API on 3000 and `ng serve` on 4200:

```bash
QA_BASE_URL=http://localhost:4200 QA_API_URL=http://localhost:3000 QA_ADMIN_PASS=<the password of those logins> npx playwright test specs/attendance-punch.spec.ts specs/hr-assistant.spec.ts
```

- `attendance-punch.spec.ts` (ATT-1..10) runs the punch screen in Chromium with a fake webcam. A person has one In and one Out a day, so a second run on the same day needs `hr_punch`/`hr_attendance` rows for `sales1`/`sales2` cleared first (or a fresh seed).
- `hr-assistant.spec.ts` (AIA-1..5): AIA-1..3 need no model. AIA-4 and AIA-5 need the stand-in model: start `node qa/support/ai-standin.mjs`, start the API with `AI_PROVIDER=anthropic ANTHROPIC_API_KEY=server-env-key-0000000000000000 ANTHROPIC_BASE_URL=http://localhost:3911 AI_MODEL=claude-haiku-5-5`, and set `QA_AI_STANDIN=1`.
- The guide spec APPG-1 expects the seeded Counter role; on a database where Counter has been given other permissions (for example `purchases.request`) its "counter sees no Setup page" check fails for that reason alone.
