# Cashier self-close + denomination tally

**Date:** 2026-09-04
**Branch:** feature/shift-cash-phase1
**Status:** Scope — not started
**Goal:** retire the paper shift-handover form. Let the cashier close their own shift from a
focused screen, entering the drawer count by denomination; keep the manager in the loop for
variance sign-off.

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

### 1. Identity — who is the cashier? (decide first)

Sales Staff have individual logins, but the POS operator-picker means a store *could* run on one
shared terminal login. This choice drives everything else.

- **Option A — one login per cashier (recommended).** The shift's `assigned_user_id` is a real
  person; they log in as themselves, see "My Shift", close it; `closed_by` / `submitted_by` come
  from their JWT. The operator-picker stays for stores that still share a terminal, but the
  *default and expected* path is self-identified.
- **Option B — shared terminal login + operator pick.** "My Shift" resolves via the selected
  operator, not the JWT. Weaker audit trail (the JWT user isn't the person counting), and the
  close action can't be permission-gated per person. Only choose this if stores genuinely can't
  give each cashier a login.

Rest of this doc assumes **A**.

### 2. Permissions

Add actions to the `store` resource (or split a new `shifts` resource — cleaner):

| Action | Who | Scope |
|---|---|---|
| `shift.open` | Store Head; optionally Sales Staff | their assigned store |
| `shift.close` | Store Head; **Sales Staff (new)** | Sales Staff limited to a shift assigned to them, at their store |
| `shift.assign` | Store Head only | — |
| `shift.review` | Store Head only | confirm a submitted count |

- Front-end: `*isAuth="'store.shift.close'"` gates the button; `AuthGuard` already allows
  `/secure/store/shifts` for the roles that need it (migration `023`).
- **Back-end: add real checks to `store-cash.controller`** — resolve the caller's role +
  store assignment, reject `close` when the shift's `assigned_user_id` ≠ caller and the caller
  isn't a manager. This closes the current hole regardless of the UI.

### 3. "My Shift" cashier screen

A focused route (e.g. `/secure/store/my-shift`) **or** a card on the POS landing
(`sale-pos.component`) — the latter is better, the cashier is already there.

Shows the cashier's current open shift **for their assigned store**:
- opening float, running expected cash, bill count, *their* sales total (cash + digital)
- a "no open shift" state with a note that sales won't be reconciled until one is opened
- **Close my shift** → opens the denomination sheet (below)

Hard limits: can only see/close a shift assigned to them (or unassigned) at their store; cannot
reopen, cannot touch past or other-store shifts, cannot assign.

### 4. Denomination tally

**Storage** — `jsonb` on `store_shifts`, no new table (denominations are only ever read as a block
with the shift):

```
counted_denominations   jsonb   -- [{ "d": 500, "n": 12 }, { "d": 200, "n": 5 }, ...]
opening_denominations   jsonb   -- optional: the float counted at open
```

**Denomination set** — Indian default, fixed in code to start:
`500, 200, 100, 50, 20, 10` (notes) · `20, 10, 5, 2, 1` (coins). Make it a `Setting` key later if a
business needs to change it.

**UI** — replace the single "Counted Cash" input with a small grid:

```
  ₹500  ×  [ 12 ]  =  6,000
  ₹200  ×  [  5 ]  =  1,000
  ...
  ────────────────────────
  Counted total          7,000     ← derived, read-only
  Expected               6,850
  Variance               +150      ← live, coloured
```

`counted_cash` stays the authoritative total = `Σ d×n`. Variance maths unchanged. The manager's
Shift Report gains a denomination breakdown row.

**Guard (fixes CASH-13):** reject a close with an empty/zero tally — "Enter the drawer count" —
instead of silently recording 0.

### 5. Manager sign-off (recommended — this is the real paper-form replacement)

Two-step, mirroring "cashier fills the form, manager signs it":

1. Cashier submits the count → shift `status = 'PENDING_REVIEW'`, `submitted_by` / `submitted_on`
   set. Sales for that shift stop (a new shift must be opened).
2. Manager sees it on the Shifts screen / dashboard ("1 shift awaiting review"), verifies the
   physical cash, confirms → `status = 'CLOSED'`, `closed_by` / `closed_on` set. Manager can
   adjust the count with a reason before confirming.

Simpler alternative if you don't want the extra state: cashier closes straight to `CLOSED`,
manager reviews variances after the fact on the dashboard (already possible). Loses the
"nothing is final until the manager checks the drawer" property.

---

## Schema changes

`sql/migrations/024_shift_denominations.sql` (+ rollback):

```sql
alter table public.store_shifts
  add column if not exists counted_denominations jsonb,
  add column if not exists opening_denominations jsonb,
  add column if not exists submitted_by int4 references public.app_user(id),
  add column if not exists submitted_on timestamp;
-- status already varchar(20); 'PENDING_REVIEW' needs no DDL change
```

Seed: add the new `store.shift.*` actions to Sales Staff and Store Head in `sql/ddl/005_seed.sql`
+ a permissions-patch migration (same pattern as `023`).

---

## Effort

| Item | Effort |
|---|---|
| Denomination tally — jsonb + UI grid + derived total + empty guard | S–M |
| "My Shift" card on POS + self-close, store/assignee scoped | M |
| Back-end authorization on `store-cash` endpoints + new permission actions + seed/migration | M |
| Manager PENDING_REVIEW sign-off step | M (optional) |
| **Total** | **M–L (~2–4 days)** depending on the sign-off step |

Back-end authorization is worth doing regardless — it's a live gap.

## Open questions

1. **One login per cashier, or shared terminal?** (Option A vs B above.)
2. **Direct close, or submit → manager confirms?** (§5)
3. **Can Sales Staff also *open* a shift, or manager-only open + cashier-only close?**
4. **Capture the opening float by denomination too, or just the closing count?**
5. **Denomination set** — Indian default hard-coded, or per-business setting from day one?
6. Should opening a shift be **required** before the POS accepts a sale (vs. today's silent
   `shift_id = null`)?

## Not in scope

Multiple tills per store / mid-shift cashier hand-off with drawer custody; petty-cash sub-accounts;
digital (UPI/card) reconciliation against a payment gateway. Separate tracks.
