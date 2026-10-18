import { Injectable } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { PurchaseInvoiceService } from "../purchases/purchase-invoice.service";
import { PurchaseService } from "../purchases/purchase.service";

export interface StoreDigest {
  storeid: number;
  location: string;
  sales: number;
  bills: number;
  prevsales: number;
  returns: number;
  topproducts: { name: string; qty: number }[];
  closedshifts: number;
  openshifts: number;
}

export interface ConsolidatedDigest {
  stores: StoreDigest[];
  purchases: number;
  purchaseinvoices: number;
  pendingapprovals: number;
  overdueinvoices: number;
}

// sale.bill_date is a timestamp-without-tz holding UTC wall-clock (matches created_on), so the business
// day is cut at IST midnight rather than the DB session's.
const TZ = "Asia/Kolkata";

/**
 * Digest numbers for one calendar day. Deliberately limited to sales / purchase / operations -
 * no margin and no cash figures (balance, expenses, deposits, variance, cash-vs-digital split).
 */
@Injectable()
export class DailyDigestBuilder {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly purchaseService: PurchaseService,
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
  ) {}

  async forStore(storeid: number, location: string, date: string): Promise<StoreDigest> {
    const [sales, prev, returns, top, shifts] = await Promise.all([
      this.salesOn(storeid, date, 0),
      this.salesOn(storeid, date, -1),
      this.returnsOn(storeid, date),
      this.topProducts(storeid, date),
      this.shifts(storeid, date),
    ]);
    return {
      storeid,
      location,
      sales: sales.total,
      bills: sales.bills,
      prevsales: prev.total,
      returns,
      topproducts: top,
      closedshifts: shifts.closed,
      openshifts: shifts.open,
    };
  }

  async consolidated(stores: StoreDigest[], date: string): Promise<ConsolidatedDigest> {
    const [purchase, orders, invoices] = await Promise.all([
      this.manager.query(`
        select coalesce(sum(pi.total), 0) as total, count(*)::int as invoices
        from purchase_invoice pi
        where pi.active = true and pi.archive = false
          and pi.invoice_date >= $1::date and pi.invoice_date < $1::date + 1
      `, [date]),
      this.purchaseService.findAllOrders({ approvalstatus: "Pending" }),
      this.purchaseInvoiceService.findOutstanding({}),
    ]);
    return {
      stores,
      purchases: +purchase?.[0]?.total || 0,
      purchaseinvoices: +purchase?.[0]?.invoices || 0,
      pendingapprovals: orders.length,
      overdueinvoices: invoices.filter((i: any) => +i.balance_amount > 0 && i.is_overdue).length,
    };
  }

  /** Sales for `date + offsetDays`. */
  private async salesOn(storeid: number, date: string, offsetDays: number) {
    const rows = await this.manager.query(`
      select coalesce(sum(s.total), 0) as total, count(*)::int as bills
      from sale s
      inner join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE' and s.active = true and s.archive = false
        and (s.bill_date at time zone 'UTC') >= (($2::date + $3::int)::timestamp at time zone '${TZ}')
        and (s.bill_date at time zone 'UTC') <  (($2::date + $3::int + 1)::timestamp at time zone '${TZ}')
        and sh.store_id = $1::int
    `, [storeid, date, offsetDays]);
    return { total: +rows?.[0]?.total || 0, bills: +rows?.[0]?.bills || 0 };
  }

  private async returnsOn(storeid: number, date: string): Promise<number> {
    const rows = await this.manager.query(`
      select coalesce(sum(sri.qty), 0) as qty
      from sale_return_item sri
      inner join sale_item si on si.id = sri.sale_item_id
      inner join sale s on s.id = si.sale_id
      inner join store_shifts sh on sh.id = s.shift_id
      where sri.created_on >= ($2::date::timestamp at time zone '${TZ}')
        and sri.created_on <  (($2::date + 1)::timestamp at time zone '${TZ}')
        and sh.store_id = $1::int
    `, [storeid, date]);
    return +rows?.[0]?.qty || 0;
  }

  private async topProducts(storeid: number, date: string) {
    const rows = await this.manager.query(`
      select p.title as name, coalesce(sum(si.qty), 0) as qty
      from sale_item si
      inner join product p on p.id = si.product_id
      inner join sale s on s.id = si.sale_id
      inner join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE' and s.active = true and s.archive = false
        and (s.bill_date at time zone 'UTC') >= ($2::date::timestamp at time zone '${TZ}')
        and (s.bill_date at time zone 'UTC') <  (($2::date + 1)::timestamp at time zone '${TZ}')
        and sh.store_id = $1::int
      group by p.id, p.title
      order by qty desc
      limit 3
    `, [storeid, date]);
    return rows.map((r: any) => ({ name: r.name, qty: +r.qty || 0 }));
  }

  /** Closed = this date's shifts that are no longer open; open = any shift still OPEN (an end-of-day anomaly). */
  private async shifts(storeid: number, date: string) {
    const rows = await this.manager.query(`
      select
        count(*) filter (where status <> 'OPEN' and shift_date = $2::date)::int as closed,
        count(*) filter (where status = 'OPEN' and shift_date <= $2::date)::int as open
      from store_shifts
      where store_id = $1::int
    `, [storeid, date]);
    return { closed: +rows?.[0]?.closed || 0, open: +rows?.[0]?.open || 0 };
  }
}
