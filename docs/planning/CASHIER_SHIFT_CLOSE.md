# Cashier self-close + denomination tally

**Date:** 2026-09-04
**Branch:** feature/shift-cash-phase1
**Status:** BUILT (2026-09-04) — migrations 024/025, denomination grid, POS "My Shift" card,
manager grid + report breakdown, backend authorization, shift-required-before-sale. qa/ suite
132/132 green; verified end-to-end in the browser.
**Goal:** retire the paper shift-handover form. The person at the till opens and closes the
shift themselves, entering both the opening float and the closing drawer count by denomination.
Managers review variances after the fact.

## Decisions (locked)

| # | Question | Decision |
|---|---|---|
| 1 | Identity model | **B — shared terminal login + operator pick.** The "cashier" for a shift is the **selected operator** (`selected_operator_id`), not the JWT user. Permissions are checked on the terminal login's role; the operator is a label for *who was at the till*. |
| 2 | Close flow | **Direct close.** Cashier closes straight to `CLOSED`. No `PENDING_REVIEW` state. Managers review variances on the dashboard afterwards. |
| 3 | Can staff open shifts? | **Yes.** Sales Staff get `store.shift.open` **and** `store.shift.close`. |
| 4 | Opening float by denomination? | **Yes.** The open-shift form captures the float as a denomination grid; `opening_cash` = its sum. |
| 5 | Denomination set | **Fixed in code.** No per-business setting. |
| 6 | Shift required before POS? | **Yes.** A `COMPLETE` sale is rejected when the store has no `OPEN` shift. `PENDING`/parked sales are still allowed. |

---

## Where we are today

| Piece | Current behaviour |
|---|---|
| Shift lifecycle | Store Head / Business Head only. `/secure/store/shifts` — open, assign, close, view report. |
| Sales Staff | **No `store` permission.** `AuthGuard` bounces them from the Shifts screen. They are only `assigned_user` on the shift and `acting_user` on sales. |
| "Check-in" | Not a real thing — at POS the person picks themselves from the **Staff** dropdown (`selected_operator_id`, localStorage), defaulting to the logged-in user. |
| Closing | Manager opens the Shift Report modal, types a single **Counted Cash** number, confirms. `variance = counted − expected`. |
| Backend auth | `store-cash.controller` is `@UseGuards(AuthGuard)` only — **no per-action permission check**. Any logged-in user can already call `POST /store-cash/shifts` and `PUT /store-cash/shifts/:id/close`. The gate is entirely front-end. |
| Denominations | Not captured. `counted_cash` is one float. |
| Empty count | `closeShift` defaults a blank count to `0` → large negative variance (CASH-13, unguarded). |
| Sales with no open shift | Silently saved with `shift_id = null` — orphaned from cash reconciliation, no warning at POS. |

---

## Design

### 1. Identity model (decision 1 — B)

The shift belongs to a **store**, not a person. Whoever is at the terminal picks themselves in the
existing POS **Staff** dropdown (`selected_operator_id`). That operator id is:

- written to the shift as `assigned_user_id` when the shift is opened
- written to a new `closed_operator_id` when it is closed
- already written to every sale as `acting_user_id`

Permissions are checked on the **terminal login's role** (the JWT). There is no per-person scoping
— if your role has `store.shift.open` / `store.shift.close` and the shift is at a store you're
assigned to, you can do it. `opened_by` / `closed_by` keep recording the JWT user as the hard
system-of-record; the operator fields record *who was physically counting* for the shift report.

Consequence: the operator dropdown must have a real selection before open/close (today it can be
blank). Block the action with "Select the staff member at the till first" when it isn't set.

### 2. Permissions

Add two actions to the `store` resource (keep it on `store`, not a new resource — the nav path is
already there):

| Action key | Roles | Front-end gate |
|---|---|---|
| `store.shift.open` | Store Head, **Sales Staff (new)** | `*isAuth="'store.shift.open'"` on the Open button |
| `store.shift.close` | Store Head, **Sales Staff (new)** | `*isAuth="'store.shift.close'"` on the Close button |

`store.shift.assign` (reassign a shift to a different operator) stays Store-Head-only — Sales Staff
open with themselves and can't move a shift to someone else.

**Back-end (this is a live gap — do it regardless):** `store-cash.controller` is JWT-only today.
Add a guard/service check on `POST /store-cash/shifts`, `PUT /store-cash/shifts/:id/close`,
`PUT /store-cash/shifts/:id/assign`, `POST /store-cash/ledger`:
- caller's role must carry the matching `store.shift.*` / `store` action
- the target store must be one the caller is assigned to (or the caller is a Business Head)
- reject `assign` for non-managers

### 3. "My Shift" on the POS landing (decision 2 — direct close)

A card at the top of `sale-pos.component` (the cashier is already there — no separate route):

**No open shift for the store:**
> ⚠ No open shift — sales cannot be completed. **[ Open shift ]**
> → opens the denomination sheet in *opening* mode (float count) + optional notes.

**Open shift:**
> Shift: Morning (2026-09-04) · opened by {operator} at 09:04
> Opening float ₹2,000 · Expected now ₹8,450 · 23 bills · your sales ₹6,450
> **[ Close shift ]** → denomination sheet in *closing* mode → confirm → `CLOSED`.

Direct close: on confirm, `PUT /store-cash/shifts/:id/close` with the tally; status goes straight
to `CLOSED`, `variance = counted − expected`. Managers review variances on the dashboard / Shift
Report afterwards. No intermediate state.

Sales Staff still can't reach `/secure/store/cash` or the manager Shifts list — only this card.

### 4. Denomination tally (decisions 4 & 5 — opening + closing, fixed set)

**Fixed denomination set** (code constant, shared FE/BE):
`2000, 500, 200, 100, 50, 20, 10` (notes) · `20, 10, 5, 2, 1` (coins).

**Storage** — `jsonb` on `store_shifts`, no new table:

```
opening_denominations   jsonb   -- [{ "d": 500, "n": 4 }, { "d": 100, "n": 0 }, ...]
counted_denominations   jsonb   -- same shape, at close
```

**UI** — one reusable denomination grid, used in both the open sheet and the close sheet:

```
  ₹500  ×  [ 12 ]  =  6,000
  ₹200  ×  [  5 ]  =  1,000
  ...
  ─────────────────────────
  Total          7,000            ← derived, read-only
  (close mode only)
  Expected       6,850
  Variance       +150             ← live, coloured
```

- Opening: `opening_cash` = `Σ d×n` of the grid (the manual "Opening cash" number field is removed).
- Closing: `counted_cash` = `Σ d×n`. Variance maths unchanged.
- The Shift Report (manager modal) gains an opening-vs-closing denomination breakdown.

**Guard (fixes CASH-13):** reject a close whose tally sums to 0 / is empty — "Enter the drawer
count" — instead of silently recording 0. Same for opening a shift with a 0 float (allow 0 only if
explicitly confirmed).

### 5. Shift required before a sale (decision 6 — yes)

`sale.service.create`: when `status` is `COMPLETE`, resolve the store's `OPEN` shift; if there is
none, reject with **"Open a shift before completing sales."** (`BadRequestException`). `PENDING` /
parked sales are unaffected — you can build a cart without a shift, you just can't finalise it.

This makes shift discipline enforceable and removes the silent `shift_id = null` orphan case.
Pairs with the "No open shift" banner on the POS card so the cashier knows what to do.

### 6. Manager view — unchanged

Store Head keeps the full Shifts screen (open/assign/close/report for any shift at their stores)
and the Cash screen. The Shift Report just gains the denomination breakdown. No PENDING_REVIEW
state, no new manager screen.

---

## Schema changes

`sql/migrations/024_shift_denominations.sql` (+ `024_rollback.sql`):

```sql
alter table public.store_shifts
  add column if not exists opening_denominations jsonb,
  add column if not exists counted_denominations jsonb,
  add column if not exists closed_operator_id int4 references public.app_user(id);
```

Permissions: add `store.shift.open` + `store.shift.close` actions to the **Sales Staff** and
**Store Head** role rows — in `sql/ddl/005_seed.sql` and a jsonb-patch migration
`025_shift_permissions.sql` (same pattern as `023_nav_permission_paths.sql`) for existing DBs.

---

## Backend surface

| Endpoint | Change |
|---|---|
| `POST /store-cash/shifts` | accept `opening_denominations` (→ `opening_cash` = Σ); require a valid operator; permission check; reject 0-float unless `allowZero` |
| `PUT /store-cash/shifts/:id/close` | accept `counted_denominations` (→ `counted_cash` = Σ) + `closedoperatorid`; reject empty tally; permission check; `closeShift` already guards re-close (#140) |
| `PUT /store-cash/shifts/:id/assign` | manager-only check |
| `POST /store-cash/ledger` | permission + store-assignment check |
| `GET /store-cash/dashboard` | already returns `openShift`; add `opening_denominations` / `counted_denominations` passthrough |
| `POST /sales` (`sale.service.create`) | reject `COMPLETE` with no `OPEN` shift for the store |
| `GET /store-cash/shifts/:id/report` | include both denomination blocks |

## Frontend surface

- `support/` denomination constant + a `<app-denomination-grid>` shared component (grid + live total).
- `sale-pos.component` — the "My Shift" card (open/close, both use the grid).
- `shifts.component` (manager) — Open form: swap the "Opening cash" number for the grid; Close
  modal: swap "Counted Cash" for the grid; Report: show breakdown.
- `sale-header` operator dropdown — surface a validation message when unset and an open/close is attempted.
- New `store.shift.*` entries in `permission-catalog.ts`.

## QA / seed impact

- `qa/seed/operations.ts` already opens shifts before selling — update `createShift` / close calls
  to send denomination arrays; the "shift required before sale" rule then holds for the seed.
- Specs that ring up `COMPLETE` sales assume an open shift exists — verify the seed guarantees one
  on store 1 for the whole run (it closes the demo shift then leaves the final one open — keep that).
- CASH-13 spec flips from "defaults to 0" → "rejected". New specs: SHIFT open/close by a Sales
  Staff token; `COMPLETE` sale with no open shift rejected; denomination sum = counted_cash.

## Effort

| Item | Effort |
|---|---|
| `<app-denomination-grid>` + constant | S |
| Migration 024/025 + seed permission rows | S |
| Backend: denomination in open/close, Σ → cash, empty guard, operator required | S–M |
| Backend: authorization on store-cash endpoints + catalog actions | M |
| Backend: block `COMPLETE` sale with no open shift | S |
| POS "My Shift" card (open + close) | M |
| Manager Shifts screen: grid in open form + close modal + report breakdown | M |
| QA: seed update + flip CASH-13 + ~3 new specs | S–M |
| **Total** | **M–L (~2–3 days)** |

## Not in scope

Multiple tills per store / mid-shift cashier hand-off with drawer custody; petty-cash sub-accounts;
digital (UPI/card) reconciliation against a payment gateway; per-business denomination sets. Separate tracks.
