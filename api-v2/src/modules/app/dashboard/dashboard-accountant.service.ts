import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { AuditService } from 'src/core/audit/audit.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardFinanceService } from './dashboard-finance.service';
import { DashboardStockService } from './dashboard-stock.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The accountant's pack: one Excel file the owner sends to the accountant, read-only by nature. It holds the money by category by month, the profit
 * summary, the GST position by month, payables by age, the bank accounts and what still has no category. A login for the accountant that can read the
 * dashboard directly is not built.
 */
@Injectable()
export class DashboardAccountantService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly metrics: DashboardMetricsService,
    private readonly finance: DashboardFinanceService,
    private readonly stock: DashboardStockService,
    private readonly audit: AuditService,
  ) {}

  async pack(user: any, q: { from?: string; to?: string }) {
    if (q.from && !MONTH.test(q.from)) throw new BadRequestException('The first month is YYYY-MM.');
    if (q.to && !MONTH.test(q.to)) throw new BadRequestException('The last month is YYYY-MM.');
    // the matrix is owner-checked below: a manager's figures carry no purchases or profit, and this pack must not be a way round that
    const m: any = await this.finance.matrix(user, { from: q.from, to: q.to, view: 'pnl', compare: 'none' });
    if (!m.owner) throw new ForbiddenException('The accountant pack is for the owner.');
    const wb = new ExcelJS.Workbook();
    const bold = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]; };
    const num = '#,##0.00';

    const sum = wb.addWorksheet('Summary');
    sum.columns = [{ header: 'Line', key: 'line', width: 30 }, ...m.months.map((x: string) => ({ header: x, key: x, width: 13 })), { header: 'Total', key: 'total', width: 15 }];
    const addLine = (label: string, row: { cells: number[]; total: number } | null) => {
      if (!row) return;
      sum.addRow({ line: label, ...Object.fromEntries(m.months.map((x: string, i: number) => [x, row.cells[i]])), total: row.total });
    };
    addLine('Sales, less returns (before GST)', m.summary.sales);
    addLine('Purchases (before GST)', m.summary.purchases);
    addLine('Sales less purchases', m.summary.margin);
    addLine('Running cost', m.summary.runningCost);
    addLine('Estimated profit', m.summary.profit);
    sum.eachRow((r, i) => { if (i > 1) r.eachCell((c, col) => { if (col > 1) c.numFmt = num; }); });
    bold(sum);
    sum.addRow([]);
    for (const n of m.confidence.notes) sum.addRow([n]);

    const cat = wb.addWorksheet('Money by category');
    cat.columns = [{ header: 'Class', key: 'cls', width: 26 }, { header: 'Group', key: 'grp', width: 22 }, { header: 'Category', key: 'cat', width: 28 }, ...m.months.map((x: string) => ({ header: x, key: x, width: 13 })), { header: 'Total', key: 'total', width: 15 }, { header: 'No category', key: 'un', width: 12 }];
    for (const s of m.sections) for (const r of s.rows) cat.addRow({ cls: s.label, grp: r.grp, cat: r.category, ...Object.fromEntries(m.months.map((x: string, i: number) => [x, r.cells[i]])), total: r.total, un: r.unclassified ? 'yes' : '' });
    cat.eachRow((r, i) => { if (i > 1) r.eachCell((c, col) => { if (col > 3 && col < 4 + m.months.length + 1) c.numFmt = num; }); });
    bold(cat);

    const sc = await this.stock.gst(user, { month: m.months[0] });      // checks the owner again, and gives the shape
    const gst = wb.addWorksheet('GST by month');
    gst.columns = [{ header: 'Month', key: 'month', width: 10 }, { header: 'Collected on sales', key: 'out', width: 20 }, { header: 'Paid on purchases and costs', key: 'in', width: 26 }, { header: 'Net (to pay if positive)', key: 'net', width: 24 }];
    for (const mo of m.months) { const g: any = await this.stock.gst(user, { month: mo }); gst.addRow({ month: mo, out: g.output, in: g.input, net: g.net }); }
    gst.addRow([]); gst.addRow([sc.notes[0]]);
    gst.eachRow((r, i) => { if (i > 1) r.eachCell((c, col) => { if (col > 1) c.numFmt = num; }); });
    bold(gst);

    const pay: any = await this.metrics.payables(user, null);
    const pw = wb.addWorksheet('Payables by age');
    pw.columns = [{ header: 'Age', key: 'label', width: 24 }, { header: 'Invoices', key: 'count', width: 10 }, { header: 'Owed', key: 'total', width: 16 }];
    for (const b of pay.buckets) pw.addRow({ label: b.label, count: b.count, total: b.total });
    pw.addRow({ label: 'Total', total: pay.total });
    pw.getColumn('total').numFmt = num;
    bold(pw);

    const cash: any = await this.finance.cash(user, {});
    const bw = wb.addWorksheet('Bank accounts');
    bw.columns = [{ header: 'Account', key: 'name', width: 28 }, { header: 'Bank', key: 'bank', width: 20 }, { header: 'Store', key: 'store', width: 18 }, { header: 'Balance', key: 'balance', width: 16 }, { header: 'As of', key: 'as_of', width: 14 }];
    for (const a of cash.accounts) bw.addRow({ name: a.name, bank: a.bank_name, store: a.store || 'Business', balance: a.balance, as_of: a.as_of || 'no statement' });
    bw.getColumn('balance').numFmt = num;
    bw.addRow([]); bw.addRow(['A bank balance is as of the last imported statement line.']);
    bold(bw);

    const un: any = await this.finance.unclassified(user, {});
    const uw = wb.addWorksheet('Needs a category');
    uw.columns = [{ header: 'Expense category', key: 'key', width: 30 }, { header: 'Entries (12 months)', key: 'entries', width: 20 }, { header: 'Amount', key: 'amount', width: 16 }];
    for (const e of un.expenses) uw.addRow(e);
    uw.addRow([]); uw.addRow([`${un.products.count} products with sales have no product category (${Math.round(un.products.amount)} in the last year).`]);
    uw.getColumn('amount').numFmt = num;
    bold(uw);

    await this.audit.record({ userId: user.id, action: 'finance.accountant_pack', entityType: 'finance_pack', entityId: 0, summary: `Accountant pack exported for ${m.from} to ${m.to}`, details: { from: m.from, to: m.to } });
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `accountant-pack-${m.from}-to-${m.to}.xlsx`, contentType: XLSX };
  }
}
