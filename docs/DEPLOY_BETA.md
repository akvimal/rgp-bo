# Running the new version beside the live one

The live system stays as it is. The new version runs next to it on the same server, with its **own database loaded from a dump of the live data**, its own
uploads, its own keys and its own port. Users enter in both while they try the new one. The live database is only ever read (to make the dump).

When the new version is accepted, the same script is run with a last dump and the live address is moved to it (see "Cutting over").

## What it is

| | Live (old) | Beta (new) |
|---|---|---|
| Code | the folder it runs from today (branch `v2`) | a second clone of this repository, branch `v3` |
| Database | the existing Postgres | its own Postgres container (`beta_pgdata` volume), never published to the network |
| Port | as today | `BETA_PORT` (default 8080); put your web server in front of it |
| Keys | its own | its own `JWT_KEY` and database password (a login from one is not accepted by the other) |
| Telegram, AI | as today | **off** unless you set them: the copy holds the real staff and customers |

## First time

On the server, in a **new folder** (not the live one):

```bash
git clone <this repository> rgp-beta && cd rgp-beta
git checkout v3

cp .env.beta.example .env.beta
# set POSTGRES_PASSWORD and JWT_KEY to NEW random values (openssl rand -hex 24), and BETA_PORT to a free port
```

Make a dump of the live database. This only reads it and does not stop anything:

```bash
docker exec <live-db-container> pg_dump -Fc -U <user> <database> > rgp_prod.dump
```

Load it and start the new version:

```bash
scripts/beta-refresh.sh rgp_prod.dump --cutoff 2026-09-15
```

It starts the beta database, restores the dump into it, runs every migration the live database lacks, runs the data fixes, settles purchase invoices dated before
the cutoff as opening payables, checks that sales, purchases, customers, products and stock match the dump, and only then starts the app. The log is
`beta-refresh.log`. A failed check leaves the app stopped.

`--cutoff` is the date before which purchase invoices are treated as already paid (leave it out and every invoice stays unpaid). It is a business decision: confirm it
with the vendor statements. `--approve "01 03"` also runs the stock fixes that change stock numbers (they are skipped by default).

Open `http://<server>:<BETA_PORT>` and sign in with a live user: the passwords are the live ones. Passwords can be changed freely on the beta.

Point a hostname and HTTPS at `BETA_PORT` with the web server the live system already uses (for example `beta.<your domain>`). The beta holds real customer
data, so give it the same care as the live one (HTTPS, and an allow-list or basic auth if it is reachable from the internet).

## Keeping the beta in line with the live data

Entries made in the beta are not copied to the live system, and entries made in the live system do not appear in the beta. To bring the beta back in line (new
products, customers, stock and bills from the live system), make a fresh dump and run the same command again. **Everything entered in the beta is replaced.**
Do it on a day everyone knows about, for example every Monday morning, and keep a note of anything configured in the beta that should be kept.

Uploaded files (invoice copies, images) are not in the database. To have them in the beta, copy the live uploads folder into the volume once:

```bash
docker cp <live-uploads-folder>/. $(docker compose -p rgp-beta -f docker-compose.beta.yml ps -q api):/usr/src/app/upload/
```

## Updating the beta with a new version of the code

```bash
git pull
docker compose -p rgp-beta -f docker-compose.beta.yml --env-file .env.beta up -d --build api frontend
```

New migrations are applied by the same script (`scripts/beta-refresh.sh` with a dump), or on the running beta with
`PG_PREFIX="docker compose -p rgp-beta -f docker-compose.beta.yml --env-file .env.beta exec -T db" PGDATABASE=rgpbeta scripts/prod-upgrade.sh cutover --yes`
(it takes a backup first).

## Cutting over

1. Agree a short window outside shop hours. Tell users the beta entries will be discarded.
2. Stop the live app (`docker compose stop api frontend` in the live folder). The live data is now final.
3. Make a last dump and run `scripts/beta-refresh.sh <dump> --cutoff <date>`, plus the opening stock count if it is ready (`docs/testing/prod-data-fixes.md`).
4. Check the totals in `beta-refresh.log` (`RESULT: PASS`), sign in, open a sale and a purchase.
5. Move the live address (port or hostname) to the new stack. Keep the old stack and its database stopped but intact for a couple of weeks.

**Rollback:** start the old stack again. Anything entered in the new version after the switch would have to be entered into it by hand, so keep the window short.

## Stopping the beta

```bash
docker compose -p rgp-beta -f docker-compose.beta.yml --env-file .env.beta down        # keeps the data
docker compose -p rgp-beta -f docker-compose.beta.yml --env-file .env.beta down -v     # also deletes the beta database and uploads
```
