import { EntityManager } from 'typeorm';

/**
 * How much cash a store (or the stores in view) holds, in one definition used by the Store > Cash card and the dashboard's "Cash and shifts":
 *   - a store with a vault: the cash in its drawers + the cash in the vault + cash dropped into the vault that still waits for a second person to confirm it;
 *   - a store without a vault: its cash book (every deposit less every withdrawal).
 * The cash book of a store with a vault cannot stand for its cash: cash dropped into the vault leaves it at once, and banking from the vault takes it out a second
 * time, while the vault's own opening cash and the floats never entered it.
 * Drawers: the expected cash of the open shifts; with no shift open, what the last closed shift left in the drawer (its count less what it put in the vault).
 */
export interface CashPosition {
  /** everything: drawers + vault + waiting of the vault stores, plus the cash book of the others */
  total: number;
  /** the vault stores only */
  drawers: number;
  vault: number;
  /** dropped into a vault and waiting for a second person to confirm: counted in the total, not yet in the vault's balance */
  waiting: number;
  /** the cash books of the stores without a vault */
  otherStores: number;
  vaultStores: number;
  /** every store's own cash book, whatever it holds a vault or not (what the ledger adds up to) */
  cashBook: number;
  stores: Array<{ storeid: number; vault: boolean; total: number; drawers: number; vaultbalance: number; waiting: number; cashbook: number }>;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function cashPosition(manager: EntityManager, stores: number[] | null): Promise<CashPosition> {
  const rows = await manager.query(
    `select s.id, s.vault_enabled as vault,
            coalesce((select sum(l.deposit - l.withdraw) from store_cash_accounts l where l.store_id = s.id), 0)::float as ledger,
            coalesce((select sum(case when m.direction = 'IN' then m.amount else -m.amount end) from store_vault_movements m where m.store_id = s.id and m.status = 'CONFIRMED'), 0)::float as vault_balance,
            coalesce((select sum(m.amount) from store_vault_movements m where m.store_id = s.id and m.status = 'PENDING' and m.direction = 'IN'), 0)::float as waiting,
            (select count(*) from store_shifts sh where sh.store_id = s.id and sh.status = 'OPEN' and not sh.archive)::int as open_shifts,
            coalesce((select sum(sh.expected_cash) from store_shifts sh where sh.store_id = s.id and sh.status = 'OPEN' and not sh.archive), 0)::float as open_cash,
            coalesce((select greatest(0, coalesce(sh.counted_cash, 0) - coalesce((select sum(m.amount) from store_vault_movements m where m.shift_id = sh.id and m.move_type = 'DROP_IN' and m.status <> 'REJECTED'), 0))
                        from store_shifts sh where sh.store_id = s.id and sh.status = 'CLOSED' and not sh.archive order by sh.id desc limit 1), 0)::float as kept
       from stores s where s.active and not s.archive and ($1::int[] is null or s.id = any($1::int[]))`, [stores]);
  const out: CashPosition = { total: 0, drawers: 0, vault: 0, waiting: 0, otherStores: 0, vaultStores: 0, cashBook: 0, stores: [] };
  for (const r of rows) {
    const drawers = r.open_shifts > 0 ? r.open_cash : r.kept;
    if (r.vault) {
      const total = drawers + r.vault_balance + r.waiting;
      out.vaultStores += 1; out.drawers += drawers; out.vault += r.vault_balance; out.waiting += r.waiting; out.total += total;
      out.stores.push({ storeid: +r.id, vault: true, total: r2(total), drawers: r2(drawers), vaultbalance: r2(r.vault_balance), waiting: r2(r.waiting), cashbook: r2(r.ledger) });
    } else {
      out.otherStores += r.ledger; out.total += r.ledger;
      out.stores.push({ storeid: +r.id, vault: false, total: r2(r.ledger), drawers: 0, vaultbalance: 0, waiting: 0, cashbook: r2(r.ledger) });
    }
    out.cashBook += r.ledger;
  }
  for (const k of ['total', 'drawers', 'vault', 'waiting', 'otherStores', 'cashBook'] as const) (out as any)[k] = r2((out as any)[k]);
  return out;
}
