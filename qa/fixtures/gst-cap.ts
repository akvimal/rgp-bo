import { execFileSync } from 'child_process';

const NOTE = 'GST 2.0: no line is billed above this rate (from the old setting pricing/sale_gst_cap_pct)';
const psql = (q: string) => execFileSync('docker', ['exec', 'rgp-db-dev', 'psql', '-U', 'rgpapp', '-d', 'rgpdb', '-At', '-c', q], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();

/**
 * The till bills the purchase GST unless a dated change says otherwise. Specs about the GST 2.0 cap (every product at most 5% from 22 Sep 2025) put that
 * one seeded change in force for themselves (setSeededCap(true)) and take it out again (false), which is how a business runs by default.
 */
export function setSeededCap(on: boolean) {
  if (on) {
    psql(`update gst_rate_change set cancelled_on = null where scope_type = 'all' and mode = 'cap' and note = '${NOTE}'`);
    psql(`insert into gst_rate_change (scope_type, scope_value, mode, rate, effective_from, price_policy, note)
          select 'all', '', 'cap', 5, date '2025-09-22', 'pass_saving', '${NOTE}' where not exists (select 1 from gst_rate_change where scope_type = 'all' and mode = 'cap' and note = '${NOTE}')`);
  } else {
    psql(`update gst_rate_change set cancelled_on = now() where scope_type = 'all' and mode = 'cap' and note = '${NOTE}' and cancelled_on is null`);
  }
}
