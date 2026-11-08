import { Pool } from 'pg';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PunchService } from './hr-punch.service';

/**
 * The photo clean-up of the attendance punch against a real PostgreSQL. Runs only when PUNCH_TEST_DB_URL names a scratch database with
 * sql/migrations/170_attendance_punch.sql applied. It writes (and removes) a test employee, punches and two small files under the upload folder.
 */
const url = process.env.PUNCH_TEST_DB_URL;
const maybe = url ? describe : describe.skip;

maybe('PunchService photo clean-up against PostgreSQL', () => {
  let pool: Pool;
  let svc: PunchService;
  let emp: number;
  const q = (sql: string, params?: any[]) => pool.query(sql, params).then((r) => r.rows);
  const dir = join(process.env.FILEUPLOAD_LOCATION || './upload', 'attendance', 'it-test');
  const oldFile = join(dir, 'old.jpg');
  const newFile = join(dir, 'new.jpg');

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    svc = new PunchService({ query: q } as any, {} as any);
    mkdirSync(dir, { recursive: true });
    writeFileSync(oldFile, 'x'); writeFileSync(newFile, 'x');
    [{ id: emp }] = await q(`insert into hr_employee (emp_code, full_name, join_date) values ('PUNCHIT', 'Punch IT', '2026-01-01') returning id`);
    await q(`insert into hr_punch (employee_id, kind, punched_at, att_date, photo_path) values ($1, 'IN', now() - interval '61 days', current_date - 61, $2), ($1, 'IN', now() - interval '5 days', current_date - 5, $3)`, [emp, oldFile, newFile]);
  });
  afterAll(async () => {
    await q(`delete from hr_punch where employee_id = $1`, [emp]);
    await q(`delete from hr_employee where id = $1`, [emp]);
    await pool.end();
  });

  it('removes photos older than the retention days (60 by default) and keeps the punch and newer photos', async () => {
    const n = await svc.purgePhotos();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(existsSync(oldFile)).toBe(false);
    expect(existsSync(newFile)).toBe(true);
    const rows = await q(`select photo_path from hr_punch where employee_id = $1 order by punched_at`, [emp]);
    expect(rows).toHaveLength(2);
    expect(rows[0].photo_path).toBeNull();
    expect(rows[1].photo_path).toBe(newFile);
  });
});
