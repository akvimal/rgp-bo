/**
 * Bill number cycle — BNO-1..2
 * The bill number restarts every January (default) or every April by the setting bill_no_cycle; switching never repeats a number already issued.
 * Run inside one database transaction that is rolled back, asking the function for particular days, so the real counters are untouched.
 */
import { test, expect } from '../fixtures/index.js';
import { db } from '../seed/db.js';

async function inTransaction(fn: (q: (sql: string, args?: any[]) => Promise<any[]>) => Promise<void>) {
  const client = await db().connect();
  try {
    await client.query('begin');
    await fn(async (sql, args = []) => (await client.query(sql, args)).rows);
  } finally {
    await client.query('rollback');
    client.release();
  }
}

const no = async (q: any, day?: string) => (await q(day ? 'select generate_bill_number($1::date) as n' : 'select generate_bill_number() as n', day ? [day] : []))[0].n as number;
const cycle = (q: any, value: string) => q(`update app_setting set setting_value = $1 where setting_key = 'bill_no_cycle'`, [value]);

test.describe('Bill number cycle @p1', () => {
  test('BNO-1 January restarts the number every 1 January, April every 1 April @happy', async () => {
    await inTransaction(async (q) => {
      expect((await q(`select setting_value from app_setting where setting_key = 'bill_no_cycle'`))[0]?.setting_value).toBe('JAN');

      // January: a new calendar year starts at 1 and counts on; March and April make no difference
      expect(await no(q, '2090-01-05')).toBe(1);
      expect(await no(q, '2090-03-31')).toBe(2);
      expect(await no(q, '2090-04-01')).toBe(3);
      expect(await no(q, '2091-01-01')).toBe(1);

      // April: the financial year starts on 1 April; January to March belong to the year before
      await cycle(q, 'APR');
      expect(await no(q, '2092-04-01')).toBe(1);
      expect(await no(q, '2092-12-31')).toBe(2);
      expect(await no(q, '2093-01-15')).toBe(3);
      expect(await no(q, '2093-03-31')).toBe(4);
      expect(await no(q, '2093-04-01')).toBe(1);

      // a spelled-out value counts as April; anything unknown falls back to January
      await cycle(q, 'April');
      expect(await no(q, '2093-04-02')).toBe(2);
      await cycle(q, 'banana');
      expect(await no(q, '2094-01-02')).toBe(1);
    });
  });

  test('BNO-2 switching from January to April carries the number on instead of repeating one, and switching back does the same @edge', async () => {
    await inTransaction(async (q) => {
      const today = (await q(`select to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as d`))[0].d as string;
      const year = Number(today.slice(0, 4));
      const aprilStart = `${today.slice(5, 7) < '04' ? year - 1 : year}-04-01`;
      const janStart = `${year}-01-01`;
      const issuedSince = async (from: string) => Number((await q(`select coalesce(max(bill_no), 0) as n from sale where bill_date >= $1::date`, [from]))[0].n);

      // January: the next number is one more than the counter, and at least one more than any bill of the year
      const first = await no(q, today);
      expect(first).toBeGreaterThan(await issuedSince(janStart));

      // switched to April partway through the year: the new counter carries on from the numbers issued since 1 April; it does not start at 1
      await cycle(q, 'APR');
      const afterSwitch = await no(q, today);
      expect(afterSwitch).toBeGreaterThan(await issuedSince(aprilStart));
      expect(afterSwitch).toBeGreaterThan(first - 1);
      expect(await no(q, today)).toBe(afterSwitch + 1);

      // and back: the January counter was left behind meanwhile, so it catches up with the year's bills and never gives a number twice
      await cycle(q, 'JAN');
      const back = await no(q, today);
      expect(back).toBeGreaterThan(first);
      expect(back).toBeGreaterThan(await issuedSince(janStart));
      expect(await no(q, today)).toBe(back + 1);
    });
  });
});
