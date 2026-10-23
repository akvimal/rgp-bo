import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { DEFAULT_PLANS } from './plans';

const SCHEMA = `
create table if not exists plan (
  key         text primary key,
  label       text not null,
  modules     jsonb not null,
  max_stores  integer not null,
  max_users   integer not null,
  price_month numeric,
  sort        integer not null default 0
);
create table if not exists tenant (
  id          serial primary key,
  slug        text not null unique,
  name        text not null,
  plan        text not null references plan(key),
  status      text not null default 'trial' check (status in ('trial', 'active', 'suspended', 'closed')),
  trial_ends  date,
  grants      jsonb not null default '{}'::jsonb,
  max_stores  integer,
  max_users   integer,
  db_name     text not null,
  web_port    integer not null unique,
  secret      text not null,
  db_password text not null default '',
  owner_email text,
  notes       text,
  usage       jsonb,
  app_version text,
  last_seen   timestamptz,
  created_on  timestamptz not null default now(),
  updated_on  timestamptz not null default now()
);
alter table plan add column if not exists max_documents integer;
alter table plan add column if not exists max_scans integer;
alter table tenant add column if not exists max_documents integer;
alter table tenant add column if not exists max_scans integer;
alter table tenant add column if not exists is_demo boolean not null default false;
alter table tenant add column if not exists demo_password text;
alter table tenant add column if not exists ai_mode text not null default 'platform';
alter table tenant add column if not exists ai_provider text;
alter table tenant add column if not exists ai_key_enc text;
alter table tenant add column if not exists ai_key_hint text;
alter table tenant add column if not exists ai_model text;
alter table tenant add column if not exists ai_allowed text;
create table if not exists tenant_event (
  id        serial primary key,
  tenant_id integer references tenant(id) on delete cascade,
  at        timestamptz not null default now(),
  action    text not null,
  detail    jsonb
);
`;

/** The control plane's own database: tenants, plans and what happened to them. */
@Injectable()
export class Db implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

  async onModuleInit() {
    await this.pool.query(SCHEMA);
    // customers' database roles must not be able to open the control plane's own database
    await this.pool.query(`REVOKE CONNECT ON DATABASE controlplane FROM PUBLIC`).catch(() => undefined);
    const [n] = (await this.pool.query('select count(*)::int as n from plan')).rows;
    if (!n.n) {
      for (const p of DEFAULT_PLANS) {
        await this.pool.query(`insert into plan (key, label, modules, max_stores, max_users, price_month, sort) values ($1,$2,$3,$4,$5,$6,$7)`,
          [p.key, p.label, JSON.stringify(p.modules), p.max_stores, p.max_users, p.price_month, p.sort]);
      }
    }
  }

  async onModuleDestroy() { await this.pool.end(); }

  async query<T = any>(sql: string, args: any[] = []): Promise<T[]> {
    return (await this.pool.query(sql, args)).rows as T[];
  }
}
