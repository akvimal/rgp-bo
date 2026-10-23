import { BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';

export const TEMPLATE_PATH = process.env.DEMO_TEMPLATE_PATH || '/data/demo-template.dump';

/** Runs a Postgres client tool (pg_dump / pg_restore) against a connection URL; the password travels in the environment, not the arguments. */
function run(tool: string, url: URL, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(tool, ['-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username), ...args], {
      env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    });
    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('error', (e) => reject(new Error(`${tool} could not start: ${e.message}`)));
    p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`${tool} failed (${code}): ${err.slice(-400)}`))));
  });
}

const withDb = (adminUrl: string, db: string) => { const u = new URL(adminUrl); u.pathname = `/${db}`; return u; };

/** Saves one customer's whole database as the demo template (what every new demo starts from). */
export async function captureTemplate(adminUrl: string, db: string): Promise<void> {
  await run('pg_dump', withDb(adminUrl, db), ['-Fc', '--no-owner', '--no-privileges', '-d', db, '-f', TEMPLATE_PATH]);
}

/** Loads the template into an empty database, as the database's own login so that login owns everything. */
export async function restoreTemplate(roleUrl: string): Promise<void> {
  const u = new URL(roleUrl);
  const db = u.pathname.slice(1);
  if (!existsSync(TEMPLATE_PATH)) throw new BadRequestException('There is no demo template yet. Build one with scripts/demo-template-build.sh.');
  await run('pg_restore', u, ['--no-owner', '--no-privileges', '-d', db, TEMPLATE_PATH]).catch((e) => {
    // pg_restore exits non-zero for harmless warnings (extensions, comments); only a real failure leaves no tables
    if (!/error:/i.test(String(e.message))) return;
    throw e;
  });
}

export function templateInfo() {
  if (!existsSync(TEMPLATE_PATH)) return { exists: false };
  const s = statSync(TEMPLATE_PATH);
  return { exists: true, bytes: s.size, builtOn: s.mtime.toISOString() };
}
