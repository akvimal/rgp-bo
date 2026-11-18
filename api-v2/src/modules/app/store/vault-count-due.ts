import { EntityManager } from 'typeorm';
import { hasVariance, REASON_MAX, REASON_MIN } from './shift-variance';

/**
 * The vault count owed after a day's last shift closes. When a store with a vault ends its day (a shift closed as END_OF_DAY, and no other shift of
 * that date still open), the vault is counted afterwards, by a manager or by the person who closed the day. Until then it is owed: the compliance
 * register lists it, and the next shift cannot open without it being done or a reason given.
 */

/** how many days back an uncounted close is still owed (a deploy does not list months of history) */
export const COUNT_WINDOW_DAYS = 2;

export interface OwedVaultDay { store_id: number; day: string; last_shift_id: number }

/** the last shift of the store closed as an end of day, as a count records it */
export async function lastEndOfDayShift(m: EntityManager, storeId: number): Promise<number | null> {
  const [r] = await m.query(`select max(id) as id from store_shifts where store_id = $1 and status = 'CLOSED' and close_type = 'END_OF_DAY' and not archive`, [storeId]);
  return r?.id ?? null;
}

/**
 * The days (per store) whose last end-of-day close has no vault count after it. `today` is the shop's day (YYYY-MM-DD). The close is compared with the
 * counts by order, not by clock: a count records the last end-of-day shift that had closed when it was made (after_shift_id), so a count taken before the
 * day's last close does not settle it, and no time zone comes into it.
 */
export async function owedVaultDays(m: EntityManager, storeIds: number[], today: string): Promise<OwedVaultDay[]> {
  if (!storeIds.length) return [];
  return m.query(
    `select sh.store_id, to_char(sh.shift_date, 'YYYY-MM-DD') as day, max(sh.id) as last_shift_id
       from store_shifts sh join stores st on st.id = sh.store_id
      where sh.store_id = any($1::int[]) and st.vault_enabled and not sh.archive
        and sh.status = 'CLOSED' and sh.close_type = 'END_OF_DAY'
        and sh.shift_date between ($2::date - ${COUNT_WINDOW_DAYS}) and $2::date
      group by sh.store_id, sh.shift_date
     having not exists (select 1 from store_shifts o where o.store_id = sh.store_id and o.shift_date = sh.shift_date and o.status = 'OPEN' and not o.archive)
        and not exists (select 1 from store_vault_counts c where c.store_id = sh.store_id and c.after_shift_id >= max(sh.id))
      order by sh.shift_date desc`, [storeIds, today]);
}

/** the reason typed for a difference, cleaned */
export const cleanReason = (v: any): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, REASON_MAX);

/**
 * The reason a vault count needs: none when it matches the books, else a few words. Returns the reason to keep (null when there is no difference) and
 * a problem in plain words when it is missing.
 */
export function countReason(variance: number, given: any): { reason: string | null; problem: string | null } {
  if (!hasVariance(variance)) return { reason: null, problem: null };
  const reason = cleanReason(given);
  if (reason.length < REASON_MIN) {
    const amount = Math.abs(Math.round(variance * 100) / 100);
    return { reason: null, problem: `The vault count is Rs ${amount} ${variance < 0 ? 'short of' : 'over'} the books. Say why.` };
  }
  return { reason, problem: null };
}
