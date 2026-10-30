/**
 * The grouped menu (DASHBOARD_AND_MENU_DESIGN 7.2): eight groups by the job the person is doing, a group with nothing the role may open is absent,
 * Setup (the settings submenu) follows below. Entries keep the test ids of the long-standing menu. Pure of Angular so it can be unit tested.
 */
export interface MenuItem { id: string; label: string; route: string; icon: string; show: () => boolean; }
export interface MenuGroup { key: string; label: string; items: MenuItem[]; }
export interface MenuAccess { has: (...keys: string[]) => boolean; canOpen: (url: string) => boolean; pack?: (name: string) => boolean; }

export function buildMenu(a: MenuAccess): MenuGroup[] {
  const item = (id: string, label: string, route: string, icon: string, show: () => boolean): MenuItem => ({ id, label, route: '/secure/' + route, icon, show });
  const any = (...keys: string[]) => () => a.has(...keys);
  return [
    { key: 'home', label: 'Home', items: [
      item('nav-dashboard', 'Dashboard', 'dashboard', 'bi-speedometer2', () => a.canOpen('/secure/dashboard')),
      item('nav-shift', 'My shift', 'shift', 'bi-cash-stack', any('shiftdesk.view')),
      item('nav-reports', 'Reports', 'reports', 'bi-graph-up', any('reports')),
    ] },
    { key: 'sell', label: 'Sell', items: [
      item('nav-sales', 'Sales and billing', 'sales', 'bi-cash-coin', any('sales')),
      item('nav-customers', 'Customers', 'customers/cust/list', 'bi-people', any('customers.read')),
      item('nav-refills', 'Refills', 'quality/refills', 'bi-telephone-outbound', () => a.has('refills.view') && !a.has('grievances.view')),
      item('nav-inquiries', 'Requests and inquiries', 'inquiries', 'bi-chat-left-text', any('inquiries.view')),
    ] },
    { key: 'stock', label: 'Inventory', items: [
      item('nav-products', 'Products and prices', 'products', 'bi-boxes', any('products')),
      item('nav-store', 'Stock', 'store', 'bi-box-seam', any('store.read')),
      item('nav-stock-audits', 'Stock audits', 'stock-audits', 'bi-clipboard-data', any('stockaudit.view')),
      item('nav-outage', 'Outage kit', 'outage', 'bi-lightning-charge', any('outage.view')),
      item('nav-schedule-register', 'Drug register', 'schedule-register', 'bi-capsule', any('scheduleregister.view')),
    ] },
    { key: 'buy', label: 'Purchasing', items: [
      item('nav-purchases', 'Purchase', 'purchases', 'bi-bag-check', any('purchases.add')),
      item('nav-purchase-requests', 'Purchase requests', 'purchases/my-requests', 'bi-bag-plus', () => a.has('purchases.request') && !a.has('purchases.add')),
      item('nav-vendor-issues', 'Vendor issues', 'vendor-issues', 'bi-arrow-return-left', any('vendorissues.view')),
    ] },
    { key: 'accounts', label: 'Accounts', items: [
      item('nav-expenses', 'Expenses', 'expenses', 'bi-wallet2', any('expenses.view')),
      item('nav-digital-payments', 'Digital payments', 'digital-payments', 'bi-qr-code-scan', any('paymentrecon.view')),
      item('nav-gst-filing', 'GST', 'gst-filing', 'bi-receipt', any('gstfiling.view')),
      item('nav-finance', 'Finance', 'finance', 'bi-bank', any('finance.view')),
    ] },
    { key: 'people', label: 'People', items: [
      item('nav-my-hr', 'My HR', 'my-hr', 'bi-person-badge', any('myhr.view')),
      item('nav-kpi-mine', 'My KPI', 'kpi/mine', 'bi-graph-up-arrow', any('mykpi.view')),
      item('nav-hr', 'Staff and HR', 'hr', 'bi-people', any('hr.view')),
      item('nav-leave-approvals', 'Leave requests', 'leave-approvals', 'bi-calendar2-check', any('leaveapprove.decide')),
      item('nav-kpi-rate', 'Rate staff', 'kpi/rate', 'bi-clipboard-check', any('kpirate.rate')),
    ] },
    { key: 'learn', label: 'Learn', items: [
      item('nav-pharmacy-guide', 'Pharmacy guide', 'pharmacy-guide', 'bi-mortarboard', () => !!a.pack && a.pack('pharmacy')),
    ] },
    { key: 'oversight', label: 'Oversight', items: [
      item('nav-compliance', 'Compliance', 'compliance', 'bi-check2-square', any('compliance.view')),
      item('nav-review', 'Weekly review', 'review', 'bi-journal-check', any('review.view')),
      item('nav-quality', 'Staff and quality', 'quality', 'bi-shield-check', any('grievances.view')),
    ] },
  ];
}
