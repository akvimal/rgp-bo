import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';

export const SLUG = /^[a-z][a-z0-9-]{2,29}$/;

export const dbNameFor = (slug: string) => `rgp_${slug.replace(/-/g, '_')}`;
export const roleNameFor = (slug: string) => `rgp_${slug.replace(/-/g, '_')}`;

export const randomSecret = (bytes = 24) => randomBytes(bytes).toString('hex');
export const randomPassword = () => randomBytes(9).toString('base64').replace(/[+/=]/g, 'x');

/**
 * The files a new database is built from, in order: the base schema, then every numbered migration from 008 on (the same
 * set the QA stack applies). New migrations are picked up as they are added; rollbacks and the 001-007 index files are not run.
 */
export function schemaFiles(sqlDir: string): string[] {
  const ddl = ['001_sequences', '002_tables', '003_views', '004_functions', '005_seed'].map((f) => join(sqlDir, 'ddl', `${f}.sql`));
  const dir = join(sqlDir, 'migrations');
  const migrations = existsSync(dir)
    ? readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f) && !/rollback/i.test(f) && f.slice(0, 3) >= '008').sort().map((f) => join(dir, f))
    : [];
  return [...ddl, ...migrations];
}

const baseName = (f: string) => f.split(/[\\/]/).slice(-1)[0];

/** A record in the customer's own database of which schema files it has had, so a new release can add only what is missing. */
async function recordMigrations(t: Client, files: string[]): Promise<void> {
  await t.query(`create table if not exists schema_migration (file text primary key, applied_on timestamptz not null default now())`);
  for (const f of files) await t.query(`insert into schema_migration (file) values ($1) on conflict do nothing`, [baseName(f)]);
}

/**
 * Brings a customer's database up to the schema files in the repository: applies the ones it has not had, in order, each in its
 * own transaction, and records them. A customer built before this record existed has none: say which file number it was
 * built from with `baselineBefore` (for example "081" means 081 and later are missing) and everything before it is recorded as applied.
 */
export async function migrateTenantDatabase(roleUrl: string, sqlDir: string, baselineBefore?: string, log: (m: string) => void = () => undefined): Promise<{ applied: string[]; recorded: number }> {
  const files = schemaFiles(sqlDir);
  const t = new Client({ connectionString: roleUrl });
  await t.connect();
  try {
    await t.query(`create table if not exists schema_migration (file text primary key, applied_on timestamptz not null default now())`);
    const [{ n }] = (await t.query(`select count(*)::int as n from schema_migration`)).rows;
    if (n === 0) {
      if (!baselineBefore || !/^\d{3}$/.test(baselineBefore)) {
        throw new BadRequestException('This customer has no record of its schema files. Say which migration number it was built before, for example {"baseline":"081"}.');
      }
      for (const f of files) if (baseName(f).slice(0, 3) < baselineBefore) await t.query(`insert into schema_migration (file) values ($1) on conflict do nothing`, [baseName(f)]);
    }
    const have = new Set((await t.query(`select file from schema_migration`)).rows.map((r: any) => r.file));
    const applied: string[] = [];
    for (const f of files) {
      const name = baseName(f);
      if (have.has(name)) continue;
      log(`applying ${name}`);
      await t.query('begin');
      try {
        await t.query(readFileSync(f, 'utf8'));
        await t.query(`insert into schema_migration (file) values ($1)`, [name]);
        await t.query('commit');
      } catch (e: any) {
        await t.query('rollback').catch(() => undefined);
        throw new Error(`${name}: ${e.message}`);
      }
      applied.push(name);
    }
    return { applied, recorded: have.size };
  } finally {
    await t.end();
  }
}

const RESYNC = `
DO $$
DECLARE r RECORD; mx BIGINT; seq TEXT;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    seq := pg_get_serial_sequence('public.' || quote_ident(r.tbl), r.col);
    IF seq IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT COALESCE(MAX(%I),0) FROM public.%I', r.col, r.tbl) INTO mx;
    EXECUTE format('SELECT setval(%L, GREATEST(%s,1), %L)', seq, mx, mx > 0);
  END LOOP;
END $$;`;

export interface ProvisionInput {
  slug: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  /** solo shops get the Owner-operator login; everyone else a Business Head */
  ownerRole: 'Business Head' | 'Owner-operator';
}

export interface Provisioned { dbName: string; roleName: string; rolePassword: string; businessId: number; userId: number }

/** Builds one tenant's database: a login role that can reach only that database, the schema, its first business, store and owner. */
export async function createTenantDatabase(adminUrl: string, sqlDir: string, p: ProvisionInput, log: (m: string) => void = () => undefined): Promise<Provisioned> {
  if (!SLUG.test(p.slug)) throw new BadRequestException('The tenant name must be 3 to 30 characters: lower-case letters, digits and hyphens, starting with a letter.');
  const dbName = dbNameFor(p.slug);
  const roleName = roleNameFor(p.slug);
  const rolePassword = randomSecret(16);
  const files = schemaFiles(sqlDir);
  for (const f of files) if (!existsSync(f)) throw new BadRequestException(`Schema file missing: ${f}. Is the sql folder mounted?`);

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  let dbMade = false, roleMade = false;
  try {
    const [exists] = (await admin.query(`select 1 from pg_database where datname = $1`, [dbName])).rows;
    if (exists) throw new BadRequestException(`A database for "${p.slug}" already exists.`);
    await admin.query(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${rolePassword}'`);
    roleMade = true;
    await admin.query(`GRANT "${roleName}" TO CURRENT_USER`);
    await admin.query(`CREATE DATABASE "${dbName}" OWNER "${roleName}"`);
    dbMade = true;
    await admin.query(`REVOKE ALL ON DATABASE "${dbName}" FROM PUBLIC`);

    const url = new URL(adminUrl);
    url.username = roleName; url.password = rolePassword; url.pathname = `/${dbName}`;
    const t = new Client({ connectionString: url.toString() });
    await t.connect();
    try {
      for (const f of files) {
        log(`applying ${f.split(/[\\/]/).slice(-1)[0]}`);
        try { await t.query(readFileSync(f, 'utf8')); }
        catch (e: any) { throw new Error(`${f.split(/[\\/]/).slice(-1)[0]}: ${e.message}`); }
      }
      await t.query(RESYNC);
      await recordMigrations(t, files);

      const [biz] = (await t.query(`insert into business (name, active, archive) values ($1, true, false) returning id`, [p.name.slice(0, 40)])).rows;
      await t.query(`insert into stores (location, business_id, deposit_threshold) values ('Main Store', $1, 0)`, [biz.id]);
      const [role] = (await t.query(`select id from app_role where name = $1`, [p.ownerRole])).rows;
      if (!role) throw new Error(`The role ${p.ownerRole} was not created by the migrations.`);
      const hash = bcrypt.hashSync(p.ownerPassword, bcrypt.genSaltSync(10));
      const [u] = (await t.query(
        `insert into app_user (email, full_name, phone, location, password, role_id, business_id, active, archive) values ($1,$2,'','',$3,$4,$5,true,false) returning id`,
        [p.ownerEmail, p.ownerName.slice(0, 40), hash, role.id, biz.id])).rows;
      await t.query(`select setval(pg_get_serial_sequence('public.app_user', 'id'), (select max(id) from app_user))`);
      return { dbName, roleName, rolePassword, businessId: biz.id, userId: u.id };
    } finally {
      await t.end();
    }
  } catch (e) {
    // leave nothing half built behind
    try {
      if (dbMade) await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      if (roleMade) await admin.query(`DROP ROLE IF EXISTS "${roleName}"`);
    } catch { /* best effort */ }
    throw e;
  } finally {
    await admin.end();
  }
}

/** Removes a tenant's database and role (closing a customer for good). */
export async function dropTenantDatabase(adminUrl: string, slug: string): Promise<void> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${dbNameFor(slug)}" WITH (FORCE)`);
    await admin.query(`DROP ROLE IF EXISTS "${roleNameFor(slug)}"`);
  } finally {
    await admin.end();
  }
}

// ---------------------------------------------------------------------------------------------------- demo accounts
import { restoreTemplate } from './template';

export interface DemoInput { slug: string; name: string; ownerName: string; ownerEmail: string; password: string }

/**
 * After the template is loaded: the demo's own business name, an owner who signs in with the demo password, every sample
 * staff login on the same password, and no entitlement left over from the shop the template was built on.
 */
async function personaliseDemo(roleUrl: string, d: DemoInput): Promise<Array<{ email: string; role: string }>> {
  const t = new Client({ connectionString: roleUrl });
  await t.connect();
  try {
    const hash = bcrypt.hashSync(d.password, bcrypt.genSaltSync(10));
    await t.query(`delete from platform_entitlement`).catch(() => undefined);
    await t.query(`update business set name = $1`, [d.name.slice(0, 40)]);
    await t.query(`update app_user set password = $1 where password is not null`, [hash]);
    const [owner] = (await t.query(
      `select u.id from app_user u join app_role r on r.id = u.role_id where r.name in ('Business Head', 'Owner-operator') order by u.id limit 1`)).rows;
    if (!owner) throw new Error('The demo template has no owner login.');
    await t.query(`update app_user set email = $1, full_name = $2 where id = $3`, [d.ownerEmail, d.ownerName.slice(0, 40), owner.id]);
    return (await t.query(`select u.email, r.name as role from app_user u join app_role r on r.id = u.role_id where u.active and not u.archive order by u.id`)).rows;
  } finally {
    await t.end();
  }
}

const roleUrlFor = (adminUrl: string, role: string, password: string, db: string) => {
  const u = new URL(adminUrl); u.username = role; u.password = password; u.pathname = `/${db}`; return u.toString();
};

/** Creates a customer's database from the demo template instead of an empty schema. */
export async function createDemoDatabase(adminUrl: string, d: DemoInput, log: (m: string) => void = () => undefined): Promise<{ dbName: string; roleName: string; rolePassword: string; users: Array<{ email: string; role: string }> }> {
  if (!SLUG.test(d.slug)) throw new BadRequestException('Bad tenant name.');
  const dbName = dbNameFor(d.slug), roleName = roleNameFor(d.slug), rolePassword = randomSecret(16);
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  let dbMade = false, roleMade = false;
  try {
    if ((await admin.query(`select 1 from pg_database where datname = $1`, [dbName])).rows[0]) throw new BadRequestException(`A database for "${d.slug}" already exists.`);
    await admin.query(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${rolePassword}'`); roleMade = true;
    await admin.query(`GRANT "${roleName}" TO CURRENT_USER`);
    await admin.query(`CREATE DATABASE "${dbName}" OWNER "${roleName}"`); dbMade = true;
    await admin.query(`REVOKE ALL ON DATABASE "${dbName}" FROM PUBLIC`);
    const url = roleUrlFor(adminUrl, roleName, rolePassword, dbName);
    log('loading the demo template');
    await restoreTemplate(url);
    const users = await personaliseDemo(url, d);
    return { dbName, roleName, rolePassword, users };
  } catch (e) {
    try {
      if (dbMade) await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      if (roleMade) await admin.query(`DROP ROLE IF EXISTS "${roleName}"`);
    } catch { /* best effort */ }
    throw e;
  } finally {
    await admin.end();
  }
}

/**
 * Puts a demo back to the template: builds a fresh copy next to it, then swaps it in. The customer's database login, port and
 * keys stay the same; the app's open connections are cut and it reconnects to the new copy on its own.
 */
export async function resetDemoDatabase(adminUrl: string, roleName: string, rolePassword: string, d: DemoInput, log: (m: string) => void = () => undefined): Promise<Array<{ email: string; role: string }>> {
  const dbName = dbNameFor(d.slug), scratch = `${dbName}_reset`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${scratch}" OWNER "${roleName}"`);
    await admin.query(`REVOKE ALL ON DATABASE "${scratch}" FROM PUBLIC`);
    const url = roleUrlFor(adminUrl, roleName, rolePassword, scratch);
    log('loading the demo template');
    await restoreTemplate(url);
    const users = await personaliseDemo(url, d);
    await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname in ('${dbName}', '${scratch}') and pid <> pg_backend_pid()`);
    await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    await admin.query(`ALTER DATABASE "${scratch}" RENAME TO "${dbName}"`);
    return users;
  } catch (e) {
    await admin.query(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`).catch(() => undefined);
    throw e;
  } finally {
    await admin.end();
  }
}
