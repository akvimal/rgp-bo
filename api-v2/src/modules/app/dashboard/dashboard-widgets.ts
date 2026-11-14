/**
 * The widget contract (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 1): every dashboard card is declared once here with what it is, where its data
 * comes from, where a figure drills to, what it says when empty, and which views hold it. The page renders only what the server's list returns, so a card a
 * role may not see is absent. Pure: relative imports only. Data gates (no cost or profit for a manager, no customer names) stay in the data queries.
 */
import { DashView } from './dashboard-view';

export interface WidgetDef {
  key: string;
  title: string;
  /** one plain sentence: what the figures are and what they leave out */
  definition: string;
  /** the endpoint the card reads, for people reading the code and for the API docs */
  source: string;
  drill?: string;
  empty: string;
  /** the views that hold it */
  views: DashView[];
  pack?: string;
  module?: string;
}

const OM: DashView[] = ['owner', 'manager'];
const O: DashView[] = ['owner'];

/** the cards added by the finance and health work; the older cards keep their keys in `dashboard-view.ts` */
export const WIDGET_DEFS: WidgetDef[] = [
  { key: 'health', title: 'Health', definition: 'Open findings by severity, the areas they sit in and what to fix first. The status is the worst open finding, not an average.', source: '/dashboard/findings', drill: '/secure/compliance', empty: 'Nothing is open. Every check is clear.', views: OM },
  { key: 'patterns', title: 'When sales happen', definition: 'Average sales per trading day by hour, weekday, day of month and month of year. Bars with few days behind them are grey.', source: '/dashboard/metrics/patterns', empty: 'There are not enough bills yet to show a pattern.', views: OM },
  { key: 'money-matrix', title: 'Money by category', definition: 'Sales, returns, purchases and costs by category and month, before GST, by bill or invoice date. A manager sees no purchases and no profit.', source: '/dashboard/finance/matrix', drill: '/secure/financials', empty: 'No sales, purchases or expenses in these months.', views: OM },
  { key: 'stock-value', title: 'Stock on the shelf', definition: 'Stock at purchase rate before GST, by expiry, category and store, with the value that has not sold in 90 days.', source: '/dashboard/stock/value', drill: '/secure/store/stock', empty: 'No stock on the shelf.', views: OM },
  { key: 'gst-position', title: 'GST this month, estimated', definition: 'Tax collected on sales less tax paid on purchases and costs. It is an estimate, not the return.', source: '/dashboard/finance/gst', drill: '/secure/gst-filing', empty: 'No GST figures for this month yet.', views: O },
  { key: 'cost-ratios', title: 'Costs as a share of sales', definition: 'Each cost group as a share of sales over 12 months, against its usual band.', source: '/dashboard/finance/trend', empty: 'No costs recorded in these months.', views: OM },
  { key: 'cash-position', title: 'Cash by place', definition: 'Cash in the drawers and the vault, and the last imported balance of each bank account.', source: '/dashboard/finance/cash', drill: '/secure/finance', empty: 'No cash figures yet.', views: OM },
];

export const widgetDef = (key: string): WidgetDef | undefined => WIDGET_DEFS.find((w) => w.key === key);

/** the new cards a view holds, in page order */
export const financeWidgetsFor = (view: DashView): string[] => WIDGET_DEFS.filter((w) => w.views.includes(view)).map((w) => w.key);

/** the cards of the Financial dashboard page, in order, for a view (the page is for owners and managers) */
export const FINANCE_PAGE_ORDER = ['money-matrix', 'cost-ratios', 'cash-position', 'stock-value', 'gst-position'];
export const financePageFor = (view: DashView): string[] => FINANCE_PAGE_ORDER.filter((k) => widgetDef(k)?.views.includes(view));

/** the definitions of the given widget keys, in their order; a key with no definition (an older card) is left out */
export const registryFor = (keys: string[]): WidgetDef[] => keys.map((k) => widgetDef(k)).filter((d): d is WidgetDef => !!d);
