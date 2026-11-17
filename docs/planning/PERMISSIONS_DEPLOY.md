# Deploy checklist: fine-grained permissions and the grouped menu

Release of 2026-11-16 (branch `v3`, from commit `671f3f848`). Design and decisions: `MENU_AND_PERMISSIONS.md` (sections 7 to 23). This page is the order of work, what changes for people, how to check it, and how to undo it.

## 1. What this release does, in one paragraph

Permissions that were decided by role name inside the API, or by a bare "page open" check, are now **actions on the role's stored permissions** (JSON on `app_role.permissions`). The owner roles (Business Head, Owner-operator) hold every new action **by name**, so they never depend on the migrations. Everyone else holds an action only if their role has it stored. **The migrations are what gives existing roles the actions they could already use.** The code is only safe to run once they have run. The grouped menu also becomes the default.

## 2. Order of work (do not reorder)

(Scope on the grant, commit `8c7913c38`, and the menu default, `56a058fbc`, need no migration: a role with no scope written behaves as before, and the menu default is a setting read at run time.)

1. **Back up** the database.
2. **Rehearse** on a copy.
3. **Run the migrations 208 to 218** on the live database. Old code ignores the extra actions, so this step is safe to do first and is reversible.
4. **Deploy the code** (api, then frontend).
5. **Verify** (section 6).
6. Keep the rollback ready for one day (section 8).

**Why migrations before code:** new code reads the new actions. If it ran first, every custom role (Accountant, Purchase Staff, Store Head, and so on) would lose access it has today until the migration ran. Old code that meets the new actions simply ignores them.

## 3. Before you start

- [ ] **Which migrations does the target already have?** `scripts/prod-upgrade.sh` applies **every** numbered migration not yet recorded in `schema_migrations`, in order. If the live database is far behind (the 2026-11 production upgrade covered 008 to 037), the permission migrations are not the only thing a cutover will run. Check first:
  ```sql
  select name from schema_migrations order by name desc limit 20;   -- if the table exists
  ```
  Anything below 208 that is missing will run too (for example 182, the purchase flow revision, was never applied). Read those files before you start; this release only vouches for 208 to 218.
- [ ] **The database you are about to change is the one you mean.** `api-v2/.env` points at the **production** database on the developer machine. Do not run a migration, a script or a test from there without naming the target explicitly (`PGDATABASE`, `PG_PREFIX`).
- [ ] **Nobody is mid-shift** if you can help it (a role edit during a shift is harmless, but the check in section 6 is easier when the till is quiet).
- [ ] The migrations are idempotent (each skips an action a role already has), so a repeat run changes nothing. They still belong in `schema_migrations` once run.

## 4. Backup and rehearsal

```bash
# backup (live)
docker exec rgp-db pg_dump -U rgpapp -Fc rgpdb > backups/pre-permissions-$(date +%F).dump

# rehearse on a copy: restores the dump into a scratch database and runs the full upgrade on it
PG_PREFIX="docker exec -i rgp-db" bash scripts/prod-upgrade.sh rehearse backups/pre-permissions-$(date +%F).dump
```

Then run section 6's database checks against the scratch database and keep the output. Drop the scratch database afterwards.

## 5. The migrations, what each does to existing roles, and how to undo it

Each file is in `sql/migrations/`; the rollback sits beside it. `roles` below means a role that already holds that page in its stored permissions.

| # | Gives these actions | To which existing roles | Undo |
|---|---|---|---|
| 208 | `customerorders` view and manage; `deliverypartners` manage | view: every role holding `sales`; manage: owner roles and Store Head. Delivery partners: owner roles, Store Head, roles with purchases add or edit | `208_rollback.sql` |
| 209 | Reports: `sales`, `purchases`, `stock`, `export`, `ask`, `margin` | every role holding `reports` gets sales, purchases, stock, export; Store Head also `ask`; owner roles also `ask` and `margin` | `209_rollback.sql` |
| 210 | HR: 11 actions (`staff.*`, `pay.*`, `payroll.*`, `attendance.manage`, `leave.manage`, `kpi.setup`, `bonus.manage`) | **owner roles only**, where they hold the HR page | `210_rollback.sql` |
| 211 | Purchasing: `payments.view/record/reverse`, `returns.manage`, `invoices.editcompleted/approvepay/recalculate` | view: roles with `read`; record: roles with add or edit; returns: add or delete; **reverse: owner roles and Store Head only**; the three invoice actions: owner roles | `211_rollback.sql` |
| 212 | Stock: `qty.adjust`, `audit.approve`, `count.perform`, `transfer.request`, `transfer.receive` | owner roles, Store Head, any role with `store.adjust` or `stock` adjust or audit (a role with none of the page gets a `store` block with an empty path that opens no page) | `212_rollback.sql` |
| 213 | Finance: `bank.import`, `reconcile`, `records`. GST filing: `prepare`, `export`, `lock`, `unlock` | every role holding the page; **`unlock` owner roles only** | `213_rollback.sql` |
| 214 | Setup: `modules.manage`, `transfer.export`, `transfer.import` (on Business Details); `mfareset` (on Users) | owner roles for the first three; every role with `users` edit for `mfareset` | `214_rollback.sql` |
| 215 | Customers: `merge`, `creditlimit.set`, `credit.correct`, `households.manage`, `followup.wording`, `relationships.setup` (and `delete`) | owner roles all of them; Store Head `creditlimit.set`, `households.manage`, `followup.wording` | `215_rollback.sql` |
| 216 | Sales: `batchstop.override`, `creditlimit.override`, `deliveries.manage`, `returns.settings` | owner roles all four; Store Head the first three | `216_rollback.sql` |
| 217 | Customers day to day: `dues.view`, `dues.collect`, `audiences.use`, `worklist.use`, `consent.manage` | **every role holding the Customers page** gets all five | `217_rollback.sql` |
| 218 | Refills: the follow-up outcome "message sent" (WhatsApp reminder from the Refills page) | no role change; widens the allowed outcomes only | `218_rollback.sql` (deletes the "message sent" records) |

Run them in numeric order:

```bash
for n in 208 209 210 211 212 213 214 215 216 217 218; do
  f=$(ls sql/migrations/${n}_*.sql | grep -v rollback)
  echo "== $f"
  docker exec -i rgp-db psql -v ON_ERROR_STOP=1 -U rgpapp -d rgpdb < "$f"
  docker exec rgp-db psql -U rgpapp -d rgpdb -c "insert into schema_migrations(name) values ('$(basename "$f" .sql)') on conflict do nothing"
done
```

(If you use `scripts/prod-upgrade.sh cutover` instead, it does the backup, the migrations and the recording itself; follow its prompts.)

## 6. Verify

### Database (run after the migrations, before the code)

```sql
-- every role with the permission pages this release touches, and the actions it now holds
select r.name, e->>'resource' as page,
       (select string_agg(p->>'action', ', ' order by p->>'action') from json_array_elements(e->'policies') p) as actions
  from app_role r, json_array_elements(r.permissions::json) e
 where e->>'resource' in ('reports','hr','purchases','store','finance','gstfiling','businessprofile','users','customers','sales','customerorders','deliverypartners')
 order by r.name, page;
```

Check by eye:

- [ ] **Business Head** and **Owner-operator**: the new actions are present on every page they hold (they work by name anyway).
- [ ] **Store Head**: `reports` has `ask`; `purchases` has `payments.reverse`; `store` has the five stock actions; `customers` has `creditlimit.set`, `households.manage`, `followup.wording`; `sales` has `batchstop.override`, `creditlimit.override`, `deliveries.manage`.
- [ ] A **custom role that handles payments** (e.g. Purchase Staff): `payments.view`, `payments.record`, `returns.manage` present, **no** `payments.reverse`.
- [ ] A **role with the Finance or GST filing page** (e.g. Accountant): the finance actions and `prepare`, `export`, `lock` present, **no** `unlock`.
- [ ] **Counter / Sales Staff**: no new override actions (they were never allowed them), but the five day-to-day customer actions are present (migration 217 gave them to every role with the Customers page).
- [ ] No role holding a page ended up with an empty `policies` list that it did not have before.

### In the app (after the code is deployed), one login of each kind

- [ ] **Business Head**: opens the grouped menu (Home, Sell, Inventory, Purchasing, Accounts, People, Oversight, Setup, Learn); Reports tabs show Sales report, Ask the shop, Weekly summary; HR opens with every tab; Finance and GST filing open; Settings > Business Details can export and import setup.
- [ ] **Owner-operator**: same, and HR now opens (it did not before).
- [ ] **Store Head**: Ask the shop works and the weekly summary does not; can approve a stock audit, run a count, dispatch and receive a transfer; can set a customer credit limit; cannot merge customers or correct a balance.
- [ ] **A purchasing clerk**: can record a vendor payment, cannot reverse it (the Reverse button is hidden).
- [ ] **Accountant**: can close a GST month, cannot reopen it.
- [ ] **Counter**: bills a sale, rings a customer on credit within their limit, and is refused past it, as before; the menu is the grouped menu.
- [ ] The **role editor** (Settings > Roles): new actions listed under each page; a "Reaches" choice under the view of Expenses, Vendor issues, Inquiries and Digital payments.

## 7. What people will notice (tell the owner)

These are the only behaviour changes; everything else is the same on day one.

1. **The menu changes for every business** that had not saved the old one: eight groups instead of the old drawers; the old "Staff and quality" drawer is gone and its pages sit under their jobs. A business can be put back (section 8).
2. **Reversing a vendor payment** is now for the owner roles and the Store Head. A clerk who could reverse before can no longer (they can still record).
3. **Reopening a closed GST month** is now for the owner roles only (anyone with GST filing could before).
4. **Owner-operator can use HR** (it could not before).
5. **A custom role with the old HR boxes ticked still has no HR access.** Those boxes never opened the API. Give actions in the role editor.
6. **A role built with only `store.adjust`** no longer changes stock (it now means managing shifts); stock changes are their own actions. Roles that existed keep what they had.
7. **A custom role with the Customers `delete` box ticked can now delete** (the API used to refuse everyone but managers).
8. **A Reports role with the page but no actions opens nothing**; the migration gave every existing Reports role its actions, but a role created in the old way after the migration needs them ticked.
9. **Roles created after this release** must be given the actions they need; the page alone no longer implies them.
10. **A role without the Customers page can no longer see who owes, take a dues payment, or use the contact list and audiences** (any login could before). Roles with the page keep all of it. Billing on credit still works for any role that can add or bill a sale.
11. **The "who owes" list works.** It returned an error for everyone before (a query bug fixed in this release).

## 8. Rollback

**Quick way back for the menu only** (no code change): Settings > Dashboards and compliance > Views, turn "The grouped menu" off; or

```bash
curl -X PUT $API/config/views -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
     -d '{"values":{"new_menu":false},"effectiveFrom":"YYYY-MM-DD"}'
```

**Full rollback** (a day or less after deploy):

1. Redeploy the previous code (api and frontend).
2. Run the rollbacks **in reverse order**: `218_rollback.sql`, `217`, `216`, `215`, `214`, `213`, `212`, `211`, `210`, `209`, and `208` last (208 also takes the two pages off every role again). Each removes only the actions it added.
3. Delete the matching names from `schema_migrations` so a later run applies them.
4. Caveat: a rollback removes **every** stored action with those names, including ones an owner ticked in the editor in the meantime. Note down any role the owner edited before rolling back.

Do **not** roll back the migrations while the new code is still running: roles would lose the actions the code is checking for.

## 9. After the deploy

- [ ] Ask the owner to open the role editor once and review the roles (especially any custom ones), now that each page lists its actions.
- [ ] After a quiet release, remove the old menu (`MENU_AND_PERMISSIONS.md` section 23).
- [ ] Not part of this release (open items): the full Purchasing split (Orders, Invoices, Payables, Vendors), disposal/vault/cash, the Sales keys with no enforcement yet (discount, price override, credit sale, reprint, customer add and edit).
- [ ] The QA suite is run against a QA database where about 100 older specs already fail for reasons unrelated to this work (data state, rules newer than their specs). A green run is not the check for this release; section 6 is.
