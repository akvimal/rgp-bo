import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Db } from './db';
import { Entitlements, TenantStatus, documentLimits, effectiveStatus, sign } from './entitlements';
import { checkGrants, effectiveModules } from './plans';
import { SLUG, createDemoDatabase, createTenantDatabase, dbNameFor, dropTenantDatabase, migrateTenantDatabase, randomPassword, randomSecret, resetDemoDatabase } from './provision';
import { captureTemplate, templateInfo } from './template';

const FIRST_PORT = Number(process.env.TENANT_FIRST_PORT || 8201);
/** a demo whose trial ended is closed after this many more days; deleting its data is a separate, explicit step */
const DEMO_GRACE_DAYS = Number(process.env.DEMO_GRACE_DAYS || 30);
const STATUSES: TenantStatus[] = ['trial', 'active', 'suspended', 'closed'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Never send the secrets of a tenant to the admin screen's list. */
const publicView = (t: any) => {
  const { secret, db_password, ...rest } = t;
  return rest;
};

@Injectable()
export class TenantsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Tenants');
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly db: Db) {}

  onModuleInit() {
    this.closeExpiredDemos().catch(() => undefined);
    this.timer = setInterval(() => this.closeExpiredDemos().catch(() => undefined), 6 * 3600 * 1000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private get adminUrl() { return process.env.PG_ADMIN_URL as string; }
  private get sqlDir() { return process.env.SQL_DIR || '/sql'; }

  // ------------------------------------------------------------------ plans
  plans() { return this.db.query(`select key, label, modules, max_stores, max_users, max_documents, max_scans, price_month::float as price_month, sort from plan order by sort, key`); }

  async savePlan(key: string, b: any) {
    const [p] = await this.db.query(`select * from plan where key = $1`, [key]);
    if (!p) throw new NotFoundException('Plan not found.');
    const num = (v: any, name: string, dflt: number) => {
      if (v === undefined) return dflt;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 100000) throw new BadRequestException(`${name} must be a whole number of at least 1.`);
      return n;
    };
    const price = b.price_month === undefined ? p.price_month : (b.price_month === null || b.price_month === '' ? null : Number(b.price_month));
    if (price !== null && !(price >= 0)) throw new BadRequestException('The price must be zero or more.');
    let modules = p.modules;
    if (b.modules !== undefined) {
      const g = checkGrants(b.modules);
      if (g.error) throw new BadRequestException(g.error);
      modules = { ...p.modules, ...g.value };
    }
    // documents and scans: empty = no limit on this plan (trials and demos are capped separately)
    const allow = (v: any, cur: number | null) => {
      if (v === undefined) return cur;
      if (v === null || v === '') return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) throw new BadRequestException('Documents and scans must be whole numbers, or empty for no limit.');
      return n;
    };
    await this.db.query(`update plan set label = $2, max_stores = $3, max_users = $4, price_month = $5, modules = $6, max_documents = $7, max_scans = $8 where key = $1`,
      [key, String(b.label ?? p.label).slice(0, 60), num(b.max_stores, 'Stores', p.max_stores), num(b.max_users, 'Users', p.max_users), price, JSON.stringify(modules), allow(b.max_documents, p.max_documents), allow(b.max_scans, p.max_scans)]);
    return (await this.plans()).find((x: any) => x.key === key);
  }

  // ------------------------------------------------------------------ tenants
  async list() {
    const rows = await this.db.query(`select t.*, p.label as plan_label from tenant t join plan p on p.key = t.plan order by t.created_on desc`);
    return rows.map((t: any) => ({ ...publicView(t), effective: effectiveStatus(t.status, t.trial_ends ? String(t.trial_ends).slice(0, 10) : null) }));
  }

  private async load(slug: string) {
    const [t] = await this.db.query(`select t.*, p.label as plan_label, p.modules as plan_modules, p.max_stores as plan_stores, p.max_users as plan_users,
                                            p.max_documents as plan_documents, p.max_scans as plan_scans
                                       from tenant t join plan p on p.key = t.plan where t.slug = $1`, [slug]);
    if (!t) throw new NotFoundException('Tenant not found.');
    return t;
  }

  async get(slug: string) {
    const t = await this.load(slug);
    return { ...publicView(t), entitlements: this.entitlementsOf(t), events: await this.db.query(`select at, action, detail from tenant_event where tenant_id = $1 order by id desc limit 30`, [t.id]) };
  }

  entitlementsOf(t: any): Entitlements {
    const trialEnds = t.trial_ends ? String(t.trial_ends instanceof Date ? t.trial_ends.toISOString() : t.trial_ends).slice(0, 10) : null;
    const eff = effectiveStatus(t.status, trialEnds);
    return {
      slug: t.slug, plan: t.plan, planLabel: t.plan_label, status: eff.status, reason: eff.reason, trialEnds, demo: !!t.is_demo,
      modules: effectiveModules(t.plan_modules, t.grants),
      limits: {
        stores: t.max_stores ?? t.plan_stores, users: t.max_users ?? t.plan_users,
        ...documentLimits({ is_demo: t.is_demo, status: eff.status === 'suspended' ? t.status : eff.status, max_documents: t.max_documents, max_scans: t.max_scans }, { max_documents: t.plan_documents, max_scans: t.plan_scans }),
      },
    };
  }

  private async event(tenantId: number, action: string, detail: any = {}) {
    await this.db.query(`insert into tenant_event (tenant_id, action, detail) values ($1,$2,$3)`, [tenantId, action, JSON.stringify(detail)]);
  }

  /**
   * Creates a customer: their own database and database login, the schema, a first business with one store and the owner's login.
   * Returns the owner's password once. Starting the customer's containers is a separate step (scripts/tenant-up.sh).
   */
  async provision(b: any) {
    const slug = String(b?.slug || '').trim().toLowerCase();
    if (!SLUG.test(slug)) throw new BadRequestException('The tenant name must be 3 to 30 characters: lower-case letters, digits and hyphens, starting with a letter.');
    const name = String(b?.name || '').trim();
    if (name.length < 2 || name.length > 40) throw new BadRequestException('Give the business a name of 2 to 40 characters.');
    const ownerEmail = String(b?.ownerEmail || '').trim().toLowerCase();
    if (!EMAIL.test(ownerEmail) || ownerEmail.length > 40) throw new BadRequestException('Enter the owner\'s email (at most 40 characters).');
    const ownerName = String(b?.ownerName || '').trim() || name;
    const [plan] = await this.db.query(`select key from plan where key = $1`, [b?.plan || 'shop']);
    if (!plan) throw new BadRequestException('Choose an existing plan.');
    const [dupe] = await this.db.query(`select 1 from tenant where slug = $1`, [slug]);
    if (dupe) throw new ConflictException('That tenant name is taken.');

    const trialDays = b?.trialDays === undefined ? 14 : Number(b.trialDays);
    if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) throw new BadRequestException('Trial days must be 0 to 365.');
    const ownerPassword = b?.ownerPassword ? String(b.ownerPassword) : randomPassword();
    if (ownerPassword.length < 8) throw new BadRequestException('The owner\'s password must be at least 8 characters.');
    const [mx] = await this.db.query(`select coalesce(max(web_port), $1 - 1)::int as p from tenant`, [FIRST_PORT]);
    const port = mx.p + 1;

    const demo = !!b?.demo;
    if (demo && trialDays < 1) throw new BadRequestException('A demo needs a trial of at least 1 day: it is closed when the trial ends.');
    let made: { dbName: string; rolePassword: string };
    let demoUsers: Array<{ email: string; role: string }> | null = null;
    if (demo) {
      const d = await createDemoDatabase(this.adminUrl, { slug, name, ownerName, ownerEmail, password: ownerPassword }, (m) => this.log.log(`${slug}: ${m}`));
      made = d; demoUsers = d.users;
    } else {
      made = await createTenantDatabase(this.adminUrl, this.sqlDir, {
        slug, name, ownerName, ownerEmail, ownerPassword,
        ownerRole: b?.preset === 'solo' ? 'Owner-operator' : 'Business Head',
      }, (m) => this.log.log(`${slug}: ${m}`));
    }

    const secret = randomSecret(24);
    const trialEnds = trialDays ? new Date(Date.now() + trialDays * 86400000).toISOString().slice(0, 10) : null;
    const [row] = await this.db.query(
      `insert into tenant (slug, name, plan, status, trial_ends, db_name, web_port, secret, db_password, owner_email, is_demo, demo_password) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [slug, name, plan.key, trialDays ? 'trial' : 'active', trialEnds, made.dbName, port, secret, made.rolePassword, ownerEmail, demo, demo ? ownerPassword : null]);
    await this.event(row.id, demo ? 'demo created' : 'provisioned', { plan: plan.key, port, ownerEmail });
    return {
      tenant: await this.get(slug),
      login: { email: ownerEmail, password: ownerPassword, role: demo ? (demoUsers?.find((u) => u.email === ownerEmail)?.role || 'Business Head') : (b?.preset === 'solo' ? 'Owner-operator' : 'Business Head') },
      ...(demo ? { users: demoUsers, note: 'Every sample login uses the same password.' } : {}),
      next: `Start the customer's app: scripts/tenant-up.sh ${slug}   (then open http://localhost:${port})`,
    };
  }

  /** What the tenant's compose project needs: written to a .env file by scripts/tenant-up.sh. */
  async envFor(slug: string): Promise<string> {
    const t = await this.load(slug);
    if (t.status === 'closed') throw new ForbiddenException('This tenant is closed.');
    const host = process.env.PLATFORM_DB_HOST || 'platform-db';
    return [
      `TENANT_SLUG=${t.slug}`,
      `TENANT_PORT=${t.web_port}`,
      `TENANT_SECRET=${t.secret}`,
      `DATABASE_URL=postgresql://${encodeURIComponent(t.db_name)}:${encodeURIComponent(t.db_password)}@${host}:5432/${t.db_name}`,
      `CONTROL_PLANE_URL=${process.env.CONTROL_PLANE_INTERNAL_URL || 'http://control-plane:4000'}`,
      // fixed for the tenant, so restarting its containers does not sign everyone out
      ...(t.is_demo ? ['FILEUPLOAD_SIZE_LIMIT=2097152'] : []),
      `JWT_KEY=${createHmac('sha256', t.secret).update('login-token-key').digest('hex')}`,
      '',
    ].join('\n');
  }

  async update(slug: string, b: any) {
    const t = await this.load(slug);
    const sets: string[] = [], args: any[] = [t.id];
    const set = (col: string, v: any) => { args.push(v); sets.push(`${col} = $${args.length}`); };
    if (b.plan !== undefined) {
      const [p] = await this.db.query(`select key from plan where key = $1`, [b.plan]);
      if (!p) throw new BadRequestException('Choose an existing plan.');
      set('plan', b.plan);
    }
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) throw new BadRequestException(`Status must be one of ${STATUSES.join(', ')}.`);
      set('status', b.status);
    }
    if (b.trial_ends !== undefined) {
      if (b.trial_ends !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.trial_ends))) throw new BadRequestException('Trial end must be a date (YYYY-MM-DD).');
      set('trial_ends', b.trial_ends);
    }
    for (const col of ['max_stores', 'max_users', 'max_documents', 'max_scans']) {
      if (b[col] === undefined) continue;
      const n = b[col] === null || b[col] === '' ? null : Number(b[col]);
      const min = col === 'max_stores' || col === 'max_users' ? 1 : 0;
      if (n !== null && (!Number.isInteger(n) || n < min)) throw new BadRequestException(`${col.replace('max_', '')} must be a whole number of at least ${min}, or empty for the plan's allowance.`);
      set(col, n);
    }
    if (b.grants !== undefined) {
      const g = checkGrants(b.grants);
      if (g.error) throw new BadRequestException(g.error);
      set('grants', JSON.stringify(g.value));
    }
    if (b.notes !== undefined) set('notes', b.notes ? String(b.notes).slice(0, 500) : null);
    if (!sets.length) throw new BadRequestException('Nothing to change.');
    await this.db.query(`update tenant set ${sets.join(', ')}, updated_on = now() where id = $1`, args);
    await this.event(t.id, 'updated', b);
    return this.get(slug);
  }

  setStatus(slug: string, status: TenantStatus) { return this.update(slug, { status }); }

  /** Deletes the customer's database for good. Only a closed tenant, and only when the name is typed again. */
  async destroy(slug: string, confirm: string) {
    const t = await this.load(slug);
    if (t.status !== 'closed') throw new BadRequestException('Close the tenant first (status closed), then delete it.');
    if (confirm !== slug) throw new BadRequestException('Type the tenant name to confirm.');
    await dropTenantDatabase(this.adminUrl, slug);
    await this.db.query(`delete from tenant where id = $1`, [t.id]);
    return { deleted: slug, database: dbNameFor(slug) };
  }

  /** Applies the schema files a customer's database is missing (run before its app is started on a new release). */
  async migrate(slug: string, baseline?: string) {
    const t = await this.load(slug);
    if (t.status === 'closed') throw new ForbiddenException('This tenant is closed.');
    const u = new URL(this.adminUrl);
    u.username = t.db_name; u.password = t.db_password; u.pathname = `/${t.db_name}`;
    const r = await migrateTenantDatabase(u.toString(), this.sqlDir, baseline, (m) => this.log.log(`${slug}: ${m}`));
    if (r.applied.length) await this.event(t.id, 'schema updated', { applied: r.applied });
    return r;
  }

  // ------------------------------------------------------------------ demos
  templateStatus() { return templateInfo(); }

  /** Saves a customer's database as the demo template (built by scripts/demo-template-build.sh on a throwaway tenant). */
  async captureTemplate(slug: string) {
    const t = await this.load(slug);
    await captureTemplate(this.adminUrl, t.db_name);
    await this.event(t.id, 'demo template captured', {});
    return templateInfo();
  }

  /** A demo back to the template: sample data and logins as new, same address and keys. */
  async resetDemo(slug: string) {
    const t = await this.load(slug);
    if (!t.is_demo) throw new BadRequestException('Only a demo account can be reset.');
    if (t.status === 'closed') throw new BadRequestException('This demo is closed. Extend it first.');
    const users = await resetDemoDatabase(this.adminUrl, t.db_name, t.db_password,
      { slug, name: t.name, ownerName: t.name, ownerEmail: t.owner_email, password: t.demo_password || randomPassword() }, (m) => this.log.log(`${slug}: ${m}`));
    await this.event(t.id, 'demo reset', {});
    return { users, password: t.demo_password };
  }

  /** More trial days from today (or from the current end, when that is later). A closed demo is opened again. */
  async extend(slug: string, days: number) {
    const t = await this.load(slug);
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 365) throw new BadRequestException('Add 1 to 365 days.');
    const today = new Date().toISOString().slice(0, 10);
    const cur = t.trial_ends ? String(t.trial_ends instanceof Date ? t.trial_ends.toISOString() : t.trial_ends).slice(0, 10) : today;
    const from = cur > today ? cur : today;
    const to = new Date(new Date(from + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
    await this.db.query(`update tenant set trial_ends = $2, status = case when status = 'closed' then 'trial' else status end, updated_on = now() where id = $1`, [t.id, to]);
    await this.event(t.id, 'trial extended', { days: n, to });
    return this.get(slug);
  }

  /** Demos whose trial ended more than the grace period ago are closed (their app stops; the data stays until someone deletes it). */
  async closeExpiredDemos() {
    const rows = await this.db.query(
      `update tenant set status = 'closed', updated_on = now() where is_demo and status in ('trial', 'active', 'suspended')
          and trial_ends is not null and trial_ends < current_date - $1::int returning id, slug`, [DEMO_GRACE_DAYS]);
    for (const r of rows) { await this.event(r.id, 'demo closed after its trial', { graceDays: DEMO_GRACE_DAYS }); this.log.log(`demo ${r.slug} closed (trial ended more than ${DEMO_GRACE_DAYS} days ago)`); }
    return rows.map((r: any) => r.slug);
  }

  /** Deletes every closed demo's database and record. Irreversible, so the word DELETE has to be sent. */
  async purgeClosedDemos(confirm: string) {
    if (confirm !== 'DELETE') throw new BadRequestException('Send confirm=DELETE.');
    const rows = await this.db.query(`select id, slug from tenant where is_demo and status = 'closed'`);
    for (const r of rows) {
      await dropTenantDatabase(this.adminUrl, r.slug);
      await this.db.query(`delete from tenant where id = $1`, [r.id]);
    }
    return { deleted: rows.map((r: any) => r.slug) };
  }

  // ------------------------------------------------------------------ what the tenant's app asks
  /** The tenant's app reports how much it uses and gets its current, signed entitlements back. */
  async heartbeat(slug: string, key: string | undefined, usage: any, version: string | undefined) {
    const t = await this.load(slug).catch(() => null);
    if (!t || !key || !safeEqual(key, t.secret)) throw new UnauthorizedException();
    const clean: any = {};
    for (const k of ['stores', 'users', 'bills_month', 'documents', 'scans_month']) if (Number.isFinite(Number(usage?.[k]))) clean[k] = Number(usage[k]);
    await this.db.query(`update tenant set usage = $2, app_version = $3, last_seen = now() where id = $1`, [t.id, JSON.stringify(clean), version ? String(version).slice(0, 40) : null]);
    return { token: sign(this.entitlementsOf(t), t.secret) };
  }
}
