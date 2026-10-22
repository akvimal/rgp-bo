# Operating modes: configuring the app for how a shop actually runs

Status: **approved, build in the order of section 8, one step at a time** (2026-10-22). Builds on `SAAS_PRODUCTISATION.md` (module packaging) and the existing shift desk, shift templates, user-store assignments and the POS operator picker.

## 1. The shops to cater for

| # | Shop |
|---|---|
| 1 | One worker (often the business head) |
| 2 | Owner (business head) and sales staff |
| 3 | Store manager and several sales staff |
| 4 | Business head with several stores, each with sales staff only or store head plus sales staff |

Each can close shifts one of two ways:

- **Time-based**: one shared till, closed at handover (morning / evening). Staff use the counter login in any order.
- **Staff-based**: each person has a drawer and closes their own.

Shifts, with reconciliation of cash, are always kept (decided). Nothing is "no shift".

## 2. Decisions taken

1. If a store head is present they are accountable for a cash difference; with no store head it is the business head. In staff-based mode the person who closed the drawer is also recorded.
2. A **login is not a person**. Time-based shops share a counter login that staff use at random, so every bill asks *who is serving* (the existing operator picker, stored as the acting user). Purchase is a separate account that sales staff never see. Everyone also has their own personal account for HR and self-service, which has no sales or purchase rights.
3. Shift with reconciliation is required in every setup.
4. A business can switch preset later; configuration changes, data is kept.

## 3. Account kinds

| Account kind | Typical use | Rights |
|---|---|---|
| Owner-operator | scenario 1: the only login | sales + purchase + stock + cash, no HR or admin screens |
| Business Head | owner | everything the business has switched on |
| Store Head / purchase staff | manager, buys stock | purchase, stock, shift close, approvals for their store |
| Counter (shared) | the till | sales and shift only; asks for the operator on each bill |
| Sales Staff (personal) | one person | sales as themselves |
| Personal / self-service | everyone | My HR, leave, ratings; no transactions |

A person may hold a counter or sales account plus a personal one. HR linking (staff without login exists already, 058) ties them to one person record, so attendance, incentives and sales performance follow the person even when the till login is shared.

## 4. Settings

**Business profile** (one per business)

- `staffing_preset`: solo, owner_and_staff, manager_and_staff, multi_store (sets defaults only)
- `approval_mode`: `self` (the maker may approve their own adjustment, PO or expense) or `separate`
- modules on/off: HR and attendance, purchasing (simple / full), GST reconciliation, expenses, digital-payment reconcile, stock audits, transfers

**Store profile** (one per store)

- `shift_mode`: `time` or `staff`
- `till`: `shared` or `per_person` (follows shift mode by default)
- `accountable_role`: store head if the store has one, else business head
- `operator_required`: ask who is serving on each bill (on by default for time-based and shared counter logins)

## 5. Behaviour by shift mode

| | Time-based | Staff-based |
|---|---|---|
| Shift opens | at handover, by whoever has the counter login; template gives name and hours | when each person starts |
| Drawer | one, shared | one per person |
| Bills carry | the operator picked per bill | the signed-in person |
| Close | handover closes the till for everyone; variance is per shift | each person closes theirs; variance is per person |
| Variance owner | store head (or business head) | the person, reported to the store head |

## 6. Presets

| Preset | Accounts created | Shift mode | Approvals | Hidden |
|---|---|---|---|---|
| Solo | Owner-operator | staff (single person) | self | HR, transfers, audits, store-head screens |
| Owner + staff | Business Head, Sales Staff or Counter | per shop | self | HR (optional), transfers |
| Manager + staff | Store Head, Counter and/or Sales Staff, Business Head | per shop | separate | transfers when one store |
| Multi-store | Business Head; per store a Store Head and/or Sales Staff | per store | separate | nothing |

## 7. Enforcement

- Settings are read by both the API and the Angular nav. A switched-off module disappears from menus **and** its endpoints return 403.
- `approval_mode = self` relaxes the maker-checker rules in stock adjustment, purchase order, expense and payment approval; with `separate` they stay as today.
- Switching a preset rewrites defaults only; it never deletes users, shifts or history. Changing from `staff` to `time` mode while a shift is open requires closing it first.

## 8. Build order

1. Store profile: `shift_mode`, accountable role, operator rule; make the shift desk, POS and cash close follow it. (Largest piece.)
2. Business profile: `approval_mode` plus self-approval in the maker-checker places.
3. Module on/off with API enforcement and nav hiding.
4. Account kinds: Owner-operator role, Counter role, personal-account linking to the HR person.
5. Setup wizard with presets and later switching.

## 9. Points settled (2026-10-22)

- The counter keeps the last operator for a configurable time, so the cashier is not asked on every bill.
- A solo owner uses one login for sales, purchase and personal screens.
- A multi-store owner can set `approval_mode` per store (the business value is the default).
