import { REPORT_FAMILY, canDoReports, canOpenReport } from './report-access';
import { REPORT_KEYS } from './insights-data.service';

const perms = (...actions: string[]) => [{ resource: 'reports', policies: actions.map((action) => ({ action })) }];

describe('who may open which report', () => {
  it('gives the owner roles every action, whatever their saved permissions say', () => {
    ['sales', 'purchases', 'stock', 'margin', 'ask', 'export'].forEach((a) => {
      expect(canDoReports('Business Head', [], a as any)).toBe(true);
      expect(canDoReports('Owner-operator', [], a as any)).toBe(true);
    });
  });

  it('gives everyone else only what is granted', () => {
    const p = perms('sales', 'ask');
    expect(canDoReports('Accountant', p, 'sales')).toBe(true);
    expect(canDoReports('Accountant', p, 'margin')).toBe(false);
    expect(canDoReports('Accountant', p, 'export')).toBe(false);
  });

  it('does not let a bare Reports entry (no actions) open anything', () => {
    expect(canDoReports('Accountant', [{ resource: 'reports' }], 'sales')).toBe(false);
  });

  it('needs the Ask the shop action and the report\'s own family', () => {
    expect(canOpenReport('Store Head', perms('sales', 'ask'), 'sales_summary')).toBe(true);
    expect(canOpenReport('Store Head', perms('sales'), 'sales_summary')).toBe(false);             // no Ask tab
    expect(canOpenReport('Store Head', perms('ask'), 'sales_summary')).toBe(false);               // no sales family
    expect(canOpenReport('Store Head', perms('sales', 'ask'), 'purchases_by_vendor')).toBe(false);
    expect(canOpenReport('Store Head', perms('purchases', 'ask'), 'purchases_by_vendor')).toBe(true);
    expect(canOpenReport('Store Head', perms('stock', 'ask'), 'dead_stock')).toBe(true);
  });

  it('keeps profit, thin-margin and customer dues behind margin', () => {
    const p = perms('sales', 'purchases', 'stock', 'ask');
    ['margin_by_product', 'low_margin_products', 'customer_dues'].forEach((k) => expect(canOpenReport('Store Head', p, k)).toBe(false));
    expect(canOpenReport('Store Head', perms('ask', 'margin'), 'margin_by_product')).toBe(true);
  });

  it('puts every Ask the shop report in a family, and an unknown report in none', () => {
    (REPORT_KEYS as readonly string[]).forEach((k) => expect(REPORT_FAMILY[k]).toBeDefined());
    expect(canOpenReport('Business Head', [], 'no_such_report')).toBe(false);
  });
});
