# Control plane: running RGP Back Office as a service

Status: **built and verified end to end** (2026-10-23): provisioning, entitlements, suspension, plan changes and plan limits, against a real customer copy. Not built: payments, usage-based metering of invoice scans, automatic subdomains (see the end). Builds on `SAAS_PRODUCTISATION.md` (this implements its "database per customer" route) and `OPERATING_MODES.md`.

## Shape

```
control-plane (container, own Postgres database "controlplane")
   tenants, plans, status, grants, usage, history
   provisions: role + database + schema + first business, store and owner login
   signs entitlements per customer
        ▲ heartbeat every minute (usage up, signed entitlements back)
        │
customer copy  (compose project rgp-<name>: api + frontend, own database rgp_<name>, own database login)
   enforces: suspended/closed, plan modules, store and login limits
```

- One Postgres server holds the control plane's database and every customer's database. Each customer has its own login role that can connect to its own database only (CONNECT is revoked from everyone else; the control plane's own database is closed to customer roles too).
- The pharmacy app is one codebase and one image. It runs in **standalone mode** (no limits, nothing changes) unless `TENANT_SLUG`, `TENANT_SECRET` and `CONTROL_PLANE_URL` are set.
- A customer's app never calls the control plane on a request. It asks every minute, keeps the last signed answer in its own database (`platform_entitlement`, migration 079), and keeps trading if the control plane is unreachable. Only an explicit "suspended" or "closed" stops it, and sign-in still works so the user sees why.

## Running it

```bash
cp .env.platform.example .env.platform        # set the three secrets
docker compose -f docker-compose.platform.yml --env-file .env.platform up -d --build
# admin screen: http://localhost:4000   (sign in with CONTROL_PLANE_ADMIN_PASSWORD)
```

New customer: use "New customer" on the admin screen (or `POST /tenants`). It creates the database and shows the owner's login once. Then start their app:

```bash
scripts/tenant-up.sh <name>          # builds the shared images once, starts rgp-<name> on the port shown (8201, 8202, ...)
scripts/tenant-up.sh <name> down     # stop, data kept
control-plane/scripts/smoke.sh <name> <port>   # suspend / reactivate / plan change / limit check against a running customer
```

Put a reverse proxy (Caddy or Nginx) in front for `name.yourdomain` to `localhost:<port>` and TLS. That step is manual for now.

## What a plan controls

Plans live in the `plan` table (edit on the admin screen): stores, logins, price, and the module set (HR, purchasing off/simple/full, GST, expenses, payment reconciliation, stock audits, transfers). Starter, Shop and Chain are seeded with no prices; set your own. A customer can also be given or denied single modules (`grants`) and different limits than the plan.

- The owner's own module switches (Business details) are held inside the plan: a module the plan leaves out shows "Not in your plan" and stays off.
- Limits: adding a store or a login (not a shared Counter or a Personal login) is refused at the plan's limit.
- Status: `trial` (ends on its date, then reads as suspended), `active`, `suspended`, `closed`. Deleting a customer's data is a separate step (`DELETE /tenants/<name>?confirm=<name>`), only after closing.

## Demos and trials

- **Demo accounts** (tick "Demo with sample data" when creating): copied from a template of invented data (staff, vendors, 38 products, customers, stock received on invoices, two weeks of shifts and sales, a few expenses). Nothing in it is real; never build a demo from production data.
- Build or rebuild the template with `CONTROL_PLANE_ADMIN_PASSWORD=... scripts/demo-template-build.sh` (creates a throwaway Chain customer, fills it through the app's own API, saves it, removes it). Rebuild now and then: the sample dates are relative to the build day.
- A demo's logins all share one password, kept and shown on its Manage panel. **Reset to sample data** swaps in a fresh copy in a few seconds (same address, same keys); **Add 14 days** extends the trial.
- A demo is a trial with a date. When it ends the app reads as suspended; 30 days later (`DEMO_GRACE_DAYS`) it is closed automatically; **Delete closed demos** removes their databases (a separate, explicit step).
- **The alert assistant's key** (see NOTIFICATIONS.md): a customer is on **the platform's key** (the OpenRouter or Anthropic account in `.env.platform`, passed by `scripts/tenant-up.sh`), on **its own key** (set on its Manage panel under Assistant: provider, key, default model, allowed models), or has **no assistant**. A customer's own key is stored encrypted (AES-256-GCM, locked with `ADMIN_JWT_SECRET`), is never sent back by the API or written into the history, and is written only into that customer's env file; the platform's key is then not added. "Own key" without a key set means off, never the platform's key. A change applies when the customer's app is next started with `tenant-up.sh`. Changing `ADMIN_JWT_SECRET` makes stored keys unreadable (they must be entered again).
- **Upload and scan allowances** hold resource use down: *documents* = files uploaded in all (invoice copies, receipts, statements imported), *scans* = invoice copies and payment statements read in a month. Defaults: demo 20 / 10, trial 100 / 30 (`DEMO_MAX_DOCUMENTS`, `DEMO_MAX_SCANS`, `TRIAL_MAX_DOCUMENTS`, `TRIAL_MAX_SCANS`); a paid plan has the figures on the plan (empty = unlimited). A figure set on one customer wins. The app refuses the upload before it is written, with a message saying what was used. Demos also have a 2 MB file-size cap.

## Not built yet

- Payments and invoices to customers (flip the status by hand for now).
- Billing on scans (they are counted and limited now; charging for them is not built).
- Subdomain routing and TLS.
- Upgrades are partly handled: `scripts/tenant-up.sh <name>` first asks the control plane to apply the schema files the customer's database has not had (`POST /tenants/<name>/migrate`; applied files are recorded in the customer's `schema_migration` table), then rebuilds and starts the app. A customer built before that record existed needs one call with its baseline, for example `{"baseline":"081"}` (081 and later are missing). Still manual: rebuilding the shared images once per release and re-running `tenant-up.sh` for each customer, and a rollback path if a migration fails halfway (each file runs in its own transaction, so a failure leaves the customer on the previous schema).
- Backups per customer database (the existing backup service is for the single-database deployment).
