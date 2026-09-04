import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { PurchaseInvoiceService } from "../purchases/purchase-invoice.service";
import { PurchaseService } from "../purchases/purchase.service";

@Injectable()
export class DashboardService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly purchaseService: PurchaseService,
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
  ) {}

  async summary(query: any) {
    const storeid = this.toNumber(query?.storeid);
    const [
      salesTrend, purchaseTrend, cashTrend,
      salesToday, salesMonth, purchaseMonth,
      openShifts, cashSnapshot, pendingApprovals,
      outstandingInvoices, lowStock, salesReturns,
      cashMovement, paymentSplit, approvalBreakdown,
    ] = await Promise.all([
      this.getSalesTrend(storeid),
      this.getPurchaseTrend(),
      this.getCashTrend(storeid),
      this.getSalesAggregate(storeid, "today"),
      this.getSalesAggregate(storeid, "month"),
      this.getPurchaseAggregate("month"),
      this.getOpenShifts(storeid),
      this.getCashSnapshot(storeid),
      this.getPendingApprovals(),
      this.getOutstandingInvoices(),
      this.getLowStockSuggestions(),
      this.getSalesReturnsMonth(storeid),
      this.getCashMovementMonth(storeid),
      this.getSalesPaymentSplit(storeid),
      this.getPurchaseApprovalBreakdown(),
    ]);

    return {
      storeid,
      generatedat: new Date().toISOString(),
      kpis: {
        sales_today: salesToday.total,
        sales_today_orders: salesToday.orders,
        sales_month: salesMonth.total,
        sales_month_orders: salesMonth.orders,
        purchase_month: purchaseMonth.total,
        purchase_month_invoices: purchaseMonth.invoices,
        open_shifts: openShifts.length,
        cash_balance: cashSnapshot.cashbalance,
        deposit_threshold: cashSnapshot.depositthreshold,
        deposit_due: cashSnapshot.depositdue,
        cash_expenses_month: cashMovement.expenses,
        bank_deposits_month: cashMovement.deposits,
        overdue_invoices: outstandingInvoices.filter((invoice: any) => invoice.is_overdue).length,
        outstanding_invoices: outstandingInvoices.length,
        pending_purchase_approvals: pendingApprovals.length,
        low_stock_items: lowStock.length,
        sales_returns_month: salesReturns.qty,
      },
      salestrend: salesTrend,
      purchasetrend: purchaseTrend,
      cashtrend: cashTrend,
      paymentsplit: paymentSplit,
      approvalbreakdown: approvalBreakdown,
      openShifts,
      pendingapprovals: pendingApprovals,
      outstandinginvoices: outstandingInvoices.slice(0, 5),
      lowstock: lowStock.slice(0, 5),
      salesreturns: salesReturns,
    };
  }

  private async getSalesPaymentSplit(storeid: number | null) {
    const row = await this.manager.query(`
      select
        coalesce(sum(s.cash_amount), 0) as cash,
        coalesce(sum(s.digi_amount), 0) as digital
      from sale s
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true
        and s.archive = false
        and s.bill_date >= date_trunc('month', current_date)
        and ($1::int is null or sh.store_id = $1::int)
    `, [storeid]);
    return [
      { name: 'Cash', value: +row?.[0]?.cash || 0 },
      { name: 'Digital', value: +row?.[0]?.digital || 0 },
    ];
  }

  private async getPurchaseApprovalBreakdown() {
    const rows = await this.manager.query(`
      select
        coalesce(approval_status, 'Pending') as status,
        count(*)::int as count
      from purchase_order
      where active = true and archive = false
        and created_on >= date_trunc('month', current_date)
      group by approval_status
    `);
    const map: Record<string, number> = { Pending: 0, Approved: 0, Rejected: 0 };
    rows.forEach((r: any) => { map[r.status] = +r.count || 0; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }

  private async getSalesAggregate(storeid: number | null, bucket: "today" | "month") {
    const periodClause = bucket === "today"
      ? "s.bill_date >= current_date and s.bill_date < current_date + interval '1 day'"
      : "s.bill_date >= date_trunc('month', current_date)";
    const row = await this.manager.query(`
      select
        coalesce(sum(s.total), 0) as total,
        count(*)::int as orders
      from sale s
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true
        and s.archive = false
        and ${periodClause}
        and ($1::int is null or sh.store_id = $1::int)
    `, [storeid]);
    return {
      total: +row?.[0]?.total || 0,
      orders: +row?.[0]?.orders || 0,
    };
  }

  private async getPurchaseAggregate(bucket: "today" | "month") {
    const periodClause = bucket === "today"
      ? "pi.invoice_date >= current_date and pi.invoice_date < current_date + interval '1 day'"
      : "pi.invoice_date >= date_trunc('month', current_date)";
    const row = await this.manager.query(`
      select
        coalesce(sum(pi.total), 0) as total,
        count(*)::int as invoices
      from purchase_invoice pi
      where pi.active = true
        and pi.archive = false
        and ${periodClause}
    `);
    return {
      total: +row?.[0]?.total || 0,
      invoices: +row?.[0]?.invoices || 0,
    };
  }

  private async getSalesTrend(storeid: number | null) {
    const rows = await this.manager.query(`
      select
        to_char(date_trunc('day', s.bill_date), 'yyyy-mm-dd') as period,
        coalesce(sum(s.total), 0) as total,
        coalesce(sum(s.cash_amount), 0) as cash,
        coalesce(sum(s.digi_amount), 0) as digital,
        count(*)::int as orders
      from sale s
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true
        and s.archive = false
        and s.bill_date >= current_date - interval '13 days'
        and ($1::int is null or sh.store_id = $1::int)
      group by 1
      order by 1
    `, [storeid]);
    return rows.map((row: any) => ({
      name: row.period,
      value: +row.total || 0,
      cash: +row.cash || 0,
      digital: +row.digital || 0,
      orders: +row.orders || 0,
    }));
  }

  private async getPurchaseTrend() {
    const rows = await this.manager.query(`
      select
        to_char(date_trunc('day', pi.invoice_date), 'yyyy-mm-dd') as period,
        coalesce(sum(pi.total), 0) as total,
        count(*)::int as invoices
      from purchase_invoice pi
      where pi.active = true
        and pi.archive = false
        and pi.invoice_date >= current_date - interval '13 days'
      group by 1
      order by 1
    `);
    return rows.map((row: any) => ({
      name: row.period,
      value: +row.total || 0,
      invoices: +row.invoices || 0,
    }));
  }

  private async getCashTrend(storeid: number | null) {
    const rows = await this.manager.query(`
      select
        to_char(ledger.trans_date, 'yyyy-mm-dd') as period,
        coalesce(sum(ledger.deposit), 0) as deposit,
        coalesce(sum(ledger.withdraw), 0) as withdraw
      from store_cash_accounts ledger
      where ledger.trans_date >= current_date - interval '13 days'
        and ($1::int is null or ledger.store_id = $1::int)
      group by 1
      order by 1
    `, [storeid]);
    return rows.map((row: any) => ({
      name: row.period,
      series: [
        { name: "Deposit", value: +row.deposit || 0 },
        { name: "Withdraw", value: +row.withdraw || 0 },
      ],
    }));
  }

  private async getOpenShifts(storeid: number | null) {
    return this.manager.query(`
      select
        s.id,
        s.shift_date as shiftdate,
        s.name,
        s.start_time as starttime,
        s.end_time as endtime,
        s.status,
        s.opening_cash as openingcash,
        s.expected_cash as expectedcash,
        s.counted_cash as countedcash,
        s.variance,
        s.deposit_threshold as depositthreshold,
        st.location as store_location,
        u.full_name as assigned_user
      from store_shifts s
      left join stores st on st.id = s.store_id
      left join app_user u on u.id = s.assigned_user_id
      where s.status = 'OPEN'
        and ($1::int is null or s.store_id = $1::int)
      order by s.shift_date desc, s.id desc
      limit 5
    `, [storeid]);
  }

  private async getCashSnapshot(storeid: number | null) {
    const row = await this.manager.query(`
      select
        coalesce(sum(ledger.deposit), 0) as deposit,
        coalesce(sum(ledger.withdraw), 0) as withdraw
      from store_cash_accounts ledger
      where ($1::int is null or ledger.store_id = $1::int)
    `, [storeid]);

    let depositthreshold = 0;
    if (storeid) {
      const store = await this.manager.query(`
        select deposit_threshold as depositthreshold
        from stores
        where id = $1
        limit 1
      `, [storeid]);
      depositthreshold = +store?.[0]?.depositthreshold || 0;
    }

    const cashbalance = (+row?.[0]?.deposit || 0) - (+row?.[0]?.withdraw || 0);
    const depositdue = depositthreshold > 0 ? cashbalance >= depositthreshold : false;

    return {
      cashbalance,
      depositthreshold,
      depositdue,
      depositexcess: depositdue ? cashbalance - depositthreshold : 0,
    };
  }

  private async getPendingApprovals() {
    const orders = await this.purchaseService.findAllOrders({ approvalstatus: "Pending" });
    return orders.slice(0, 5).map((order: any) => ({
      id: order.id,
      vendorname: order.vendor?.name || "",
      status: order.status,
      approvalstatus: order.approvalstatus,
      approvalreason: order.approvalreason,
      createdon: order.createdon,
    }));
  }

  private async getOutstandingInvoices() {
    const invoices = await this.purchaseInvoiceService.findOutstanding({});
    return invoices
      .filter((invoice: any) => +invoice.balance_amount > 0)
      .sort((a: any, b: any) => {
        const ad = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
        const bd = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
        return bd - ad;
      });
  }

  private async getLowStockSuggestions() {
    const items = await this.purchaseService.findSuggestions({ days: 30, targetdays: 21, includezero: false });
    return items
      .filter((item: any) => +item.final_qty > 0)
      .slice(0, 5)
      .map((item: any) => ({
        product_id: item.product_id,
        title: item.title,
        vendor_name: item.vendor_name,
        available_stock: item.available_stock,
        trend_qty: item.trend_qty,
        adhoc_qty: item.adhoc_qty,
        final_qty: item.final_qty,
        reason_summary: item.reason_summary,
      }));
  }

  private async getSalesReturnsMonth(storeid: number | null) {
    const rows = await this.manager.query(`
      select
        coalesce(count(sri.id), 0) as returns,
        coalesce(sum(sri.qty), 0) as qty
      from sale_return_item sri
      inner join sale_item si on si.id = sri.sale_item_id
      inner join sale s on s.id = si.sale_id
      left join store_shifts sh on sh.id = s.shift_id
      where sri.created_on >= date_trunc('month', current_date)
        and ($1::int is null or sh.store_id = $1::int)
    `, [storeid]);
    return {
      returns: +rows?.[0]?.returns || 0,
      qty: +rows?.[0]?.qty || 0,
    };
  }

  private async getCashMovementMonth(storeid: number | null) {
    const rows = await this.manager.query(`
      select
        coalesce(sum(case when ledger.category = 'EXPENSE' then ledger.withdraw else 0 end), 0) as expenses,
        coalesce(sum(case when ledger.category = 'BANK_DEPOSIT' then ledger.withdraw else 0 end), 0) as deposits
      from store_cash_accounts ledger
      where ledger.trans_date >= date_trunc('month', current_date)
        and ($1::int is null or ledger.store_id = $1::int)
    `, [storeid]);
    return {
      expenses: +rows?.[0]?.expenses || 0,
      deposits: +rows?.[0]?.deposits || 0,
    };
  }

  async trends(query: any) {
    const storeid = this.toNumber(query?.storeid);
    const [customersPerDay, topCustomers, topProductsByQty, topProductsByRevenue] = await Promise.all([
      this.getCustomersServedPerDay(storeid),
      this.getTopCustomers(storeid),
      this.getTopProductsByQty(storeid),
      this.getTopProductsByRevenue(storeid),
    ]);
    return { customersPerDay, topCustomers, topProductsByQty, topProductsByRevenue };
  }

  private async getCustomersServedPerDay(storeid: number | null) {
    const rows = await this.manager.query(`
      select
        to_char(date_trunc('day', s.bill_date), 'yyyy-mm-dd') as name,
        count(distinct s.customer_id)::int as value
      from sale s
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true and s.archive = false
        and s.bill_date >= current_date - interval '13 days'
        and s.customer_id is not null
        and ($1::int is null or sh.store_id = $1::int)
      group by 1
      order by 1
    `, [storeid]);
    return rows.map((r: any) => ({ name: String(r.name).slice(5), value: +r.value || 0 }));
  }

  private async getTopCustomers(storeid: number | null) {
    const rows = await this.manager.query(`
      select
        coalesce(c.name, 'Walk-in') as name,
        coalesce(sum(s.total), 0) as value
      from sale s
      left join customer c on c.id = s.customer_id
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true and s.archive = false
        and s.bill_date >= date_trunc('month', current_date)
        and ($1::int is null or sh.store_id = $1::int)
      group by s.customer_id, c.name
      order by value desc
      limit 8
    `, [storeid]);
    return rows.map((r: any) => ({ name: r.name, value: +r.value || 0 }));
  }

  private async getTopProductsByQty(storeid: number | null) {
    const rows = await this.manager.query(`
      select
        p.title as name,
        coalesce(sum(si.qty), 0) as value
      from sale_item si
      inner join product p on p.id = si.product_id
      inner join sale s on s.id = si.sale_id
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true and s.archive = false
        and s.bill_date >= date_trunc('month', current_date)
        and ($1::int is null or sh.store_id = $1::int)
      group by p.id, p.title
      order by value desc
      limit 8
    `, [storeid]);
    return rows.map((r: any) => ({ name: r.name, value: +r.value || 0 }));
  }

  private async getTopProductsByRevenue(storeid: number | null) {
    const rows = await this.manager.query(`
      select
        p.title as name,
        coalesce(sum(si.total), 0) as value
      from sale_item si
      inner join product p on p.id = si.product_id
      inner join sale s on s.id = si.sale_id
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true and s.archive = false
        and s.bill_date >= date_trunc('month', current_date)
        and ($1::int is null or sh.store_id = $1::int)
      group by p.id, p.title
      order by value desc
      limit 8
    `, [storeid]);
    return rows.map((r: any) => ({ name: r.name, value: +r.value || 0 }));
  }

  async adminSummary(roleid?: number) {
    // Cross-business rollup - only roles that legitimately see across stores.
    const allowed = ['Site Admin', 'Business Head'];
    const roleRow = await this.manager.query(`SELECT name FROM app_role WHERE id = $1`, [roleid || 0]);
    if (!allowed.includes(roleRow?.[0]?.name)) {
      throw new ForbiddenException('Not authorized to view the admin summary.');
    }
    const [bizRows, storeRows, userRows, roleRows, byRole, byBiz] = await Promise.all([
      this.manager.query(`SELECT count(*)::int AS count FROM business WHERE active = true AND archive = false`),
      this.manager.query(`SELECT count(*)::int AS count FROM stores WHERE active = true AND archive = false`),
      this.manager.query(`SELECT count(*)::int AS count FROM app_user WHERE active = true AND archive = false`),
      this.manager.query(`SELECT count(*)::int AS count FROM app_role WHERE active = true AND archive = false AND locked = false`),
      this.manager.query(`
        SELECT r.name, count(u.id)::int AS value
        FROM app_role r
        LEFT JOIN app_user u ON u.role_id = r.id AND u.active = true AND u.archive = false
        WHERE r.active = true AND r.archive = false AND r.locked = false
        GROUP BY r.id, r.name
        ORDER BY value DESC
      `),
      this.manager.query(`
        SELECT b.name, count(s.id)::int AS value
        FROM business b
        LEFT JOIN stores s ON s.business_id = b.id AND s.active = true AND s.archive = false
        WHERE b.active = true AND b.archive = false
        GROUP BY b.id, b.name
        ORDER BY value DESC
      `),
    ]);
    return {
      businesses: +bizRows?.[0]?.count || 0,
      stores: +storeRows?.[0]?.count || 0,
      users: +userRows?.[0]?.count || 0,
      roles: +roleRows?.[0]?.count || 0,
      usersByRole: byRole.map((r: any) => ({ name: r.name, value: +r.value || 0 })),
      storesByBusiness: byBiz.map((b: any) => ({ name: b.name, value: +b.value || 0 })),
    };
  }

  private toNumber(value: any) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
