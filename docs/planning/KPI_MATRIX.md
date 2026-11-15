# KPI matrix for a pharmacy: positions, gates and starter sets

Status: **built 2026-11-15, uncommitted; migration 203 and the new SQL never run.** Spreadsheet: `docs/planning/KPI_MATRIX.xlsx` (regenerate with `npx ts-node -T scripts/gen-kpi-matrix.ts` from `api-v2`; it reads the same starter sets the app loads, so the two cannot drift apart).

## Decisions (2026-11-15)
1. **Legal duties are gates, not points.** A gate carries no points; if it is not met the month's incentive is nil whatever the points.
2. **Positions:** Business Head, Store Head, Sales Staff, Pharmacist (weekends only).
3. **Both** a spreadsheet and the app's KPI templates.
4. **First missing measure to build:** customer-capture rate.

## What was built
- **Gates** (`is_gate`, migration 203, engine, setup, review and rating screens). A gate is a figure against a limit (system) or Met or Not met confirmed by the manager (manual, a scale of two). A failed gate sets the month's band to "Gate not met" and the incentive to nil; the points are still shown. A gate cannot be overridden: correct the rating or the figure.
- **Bills with a named customer** (`CUSTOMER_CAPTURE`): the share of the person's completed bills with a customer who has a name and is not the counter placeholder (mobile 0000000000). A customer kept by name and location counts. Higher is better; judged after a minimum number of bills.
- **Starter sets** (`hr-kpi-templates.ts`): Sales Staff, Pharmacist (weekends) and Store Head, 100 points each, 2 to 3 gates each. Preview and load from HR > Setup > KPI > "Starter sets for a pharmacy" (`GET /hr/kpi/templates`, `POST /hr/kpi/templates/apply`, preview by default, `confirm: true` to write; a job role is matched by name or created; a measure is matched by name within the job role). Measures a job role already has are kept and counted with these.
- **Business Head:** not scored in the app (nobody can rate the owner). The sheet is a monthly scorecard that points at Health, the Financial dashboard and the compliance register.

## Points, in short
| | Sales Staff | Pharmacist (weekends) | Store Head |
|---|---|---|---|
| Gates | no expired medicine sold; scheduled drugs with prescription details; cash within Rs 1,000 | expired; scheduled drugs; present for the assigned hours | licences, registers and rules in order; no expired stock on the shelf |
| System points | named customer 20, cash 15, discarded bills 10, grievances 10, absent days 10, suggestions 5 | named customer 15, grievances 10, discarded bills 5, cash 5 | audits late 15, audits done 5, inquiries late 10, inquiries closed 5, grievances 5, cash 5, absent days 5 |
| Rated points | counselling and honest advice 10, cleanliness and hygiene 10, shelf order and expiry-first 10 | prescription checking and registers 25, counselling 20, expiry check 15, cleanliness 5 | expiry control 15, stock planning 10, cleanliness 10, staff guidance 10, purchase and receiving 5 |

## Limits to know
- Targets and limits are starting values. Set them from the History of each measure after a few months.
- The three legal gates and the prescription rating are manual until the system measures them (spreadsheet sheet "Gaps to build"). Those measures are not built: scheduled-drug prescription capture rate, expired batches sold, expired value on the shelf.
- Incentive bands and the pay are not in the sets.
- Legal items are described generally; check each against the licence conditions and the current rules.
