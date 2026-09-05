/**
 * Direct DB access for the handful of things the API structurally cannot do
 * during seeding (e.g. assigning a non-standard role to a user - the API's
 * user endpoints only allow the four built-in roles). Kept deliberately small.
 */
import 'dotenv/config';
import pg from 'pg';

const url = process.env.QA_DB_URL || 'postgresql://rgpapp:r9pAdmin7@localhost:5432/rgpdb';

let pool: pg.Pool | null = null;
export function db(): pg.Pool {
  if (!pool) pool = new pg.Pool({ connectionString: url, max: 4 });
  return pool;
}

export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await db().query(text, params);
  return res.rows as T[];
}

export async function closeDb() {
  if (pool) { await pool.end(); pool = null; }
}

/** apply qa/seed/sql/*.sql files by name */
export async function runSqlFile(absPath: string) {
  const { readFileSync } = await import('node:fs');
  await db().query(readFileSync(absPath, 'utf8'));
}
