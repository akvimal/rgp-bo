# Release checklist: migrations 160–172 (staff credit, vault, leave policy, attendance, AI assistants)

What goes live: customer dues and staff credit by store (160–166), vault float to drawer (167), to-do proof (168), leave policy (169), attendance by PIN and webcam (170), AI job roles, KPIs and incentives (171), and the assistant usage log and monthly limit (172).

## What was rehearsed (2026-11-08)

On a copy of the live database (`rgp_prod_20261030.dump`, the freshest dump in `D:\workspace\rgp-migration`), with the current code:

| Check | Result |
|---|---|
| Full chain 002 … 172 through `scripts/prod-upgrade.sh rehearse` | **PASS**, 167 migrations applied, 129 s, history unchanged (sales, items, purchases, customers, products, stock all match) |
| Rollbacks 171 → 167 in order, then forward again | clean both ways |
| Each of 170, 171 run twice | no error (idempotent) |
| The current API started against the upgraded copy; every GET route that takes no id (226) called as the Business Head | 223 ok, 2 forbidden, 1 not found, **0 server errors** |
| Attendance, payroll hold, Rules tab, AI key card, usage limit, Role assistant | browser and API specs pass (`qa/specs/attendance-punch.spec.ts`, `qa/specs/hr-assistant.spec.ts`) |

The rehearsal started from the 30 Oct dump. The live database may already be further along: the steps below only apply what is missing.

## Before

1. **Find out where live is.** On the live database: `select name from schema_migrations order by name desc limit 5;`
   - If it lists the migrations applied so far, the upgrade script applies only what is missing.
   - If the table is missing or empty although the schema is current (migrations were run by hand), **do not run the script without `--assume-applied`**: earlier migrations are not all safe to run twice. Apply 167–172 by hand instead (each is safe to run twice, tested).
2. **Back up**: `pg_dump -Fc` of the live database to a file outside the repo. Check it lists with `pg_restore -l`.
3. Pick a quiet time: no open shifts, no payroll being worked out.
4. Check there is a store PC registered for every counter that will punch in (Settings > Stores > Store PCs: register the PC you are on and choose its Counter login) and note who counts as "staff who clock in" (see After).

## Upgrade

Either the script (applies what is missing, takes its own backup, runs the history checks):

```bash
PG_PREFIX="docker exec -i <db container>" PGDATABASE=<live db> bash scripts/prod-upgrade.sh cutover --backup-dir <outside the repo>
```

or by hand, in order, each file once: `167_vault_float_to_drawer.sql`, `168_todo_proof.sql`, `169_leave_policy.sql`, `170_attendance_punch.sql`, `171_ai_roles_kpi_incentives.sql`, `172_ai_usage.sql` (after anything before 167 that is missing).

Then deploy the API and the frontend **together** (the payroll page calls a new API route; the old frontend with the new API is fine, the new frontend with the old API shows no hold banner).

## After (smoke check, ten minutes)

1. Sign in as the Business Head. Dashboard loads; Settings > AI assistant shows the key card and, once there is a key, the models table ("No key yet" unless the server has a key).
2. People > Attendance review opens, with the Days, Who punches (PINs) and Rules tabs.
3. Staff and HR > Payroll: the month shows no banner, or lists the days still to review (expected until attendance is reviewed for staff who clock in).
4. Staff and HR > Role assistant lists the job roles.
5. App guide opens and lists To-dos, Price changes, Mark attendance and Attendance review.

## Turning the new features on

- **Attendance**: register the counter PC; in Attendance review > Who punches (PINs) switch each person on and give them a PIN (shown once). Staff who are not switched on are not held back by the payroll review.
- **AI assistants**: Business Head opens Settings > AI assistant, picks the provider, pastes the key, presses Save key, then Test. Check the monthly limit (300 to start; 0 means none) and raise or lower it. Then choose the models: a default, and if wanted one per level of difficulty or per assistant (small for Simple, the most capable for Complex).
- **Leave advice** (casual leave between the 11th and 25th, not on weekends, for pharmacy store staff) is set per leave type under Setup; it advises, it does not block.

## Roll back

If the API or screens misbehave after deploy and the data is fine: redeploy the previous API and frontend (the new tables and columns are ignored by the old code).

If the data must go back: stop the API, restore the backup taken above. Only if the backup cannot be used, run the rollbacks in reverse: `172_rollback.sql` … `167_rollback.sql` (each tested). Rolling back 170, 171 and 172 drops the punch history, the assistant's saved job roles and KPI bands' amounts, and the usage log.
