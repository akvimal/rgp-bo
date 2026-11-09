/**
 * The grouped menu (DASHBOARD_AND_MENU_DESIGN 7.2): eight groups by the job the person is doing, a group with nothing the role may open is absent,
 * Setup (the settings submenu) follows below. Entries keep the test ids of the long-standing menu. Pure of Angular so it can be unit tested.
 */
export interface MenuItem { id: string; label: string; route: string; icon: string; show: () => boolean; }
export interface MenuGroup { key: string; label: string; items: MenuItem[]; }
export interface MenuAccess { has: (...keys: string[]) => boolean; canOpen: (url: string) => boolean; pack?: (name: string) => boolean; }

/**
 * The "My ..." pages (My shift, My HR, My KPI) are about the signed-in person, not about the shop's work: they live in the profile menu at the top right
 * (buildMyMenu), not in the sidebar. buildMenu leaves them out; they are still defined here, once, with the same ids and permissions.
 */
export const MY_MENU_IDS = ['nav-shift', 'nav-my-hr', 'nav-kpi-mine'];

/** the signed-in person's own pages, for the profile menu, in this order */
export function buildMyMenu(a: MenuAccess): MenuItem[] {
  const all: MenuItem[] = [];
  allMenuGroups(a).forEach((g) => g.items.forEach((i) => all.push(i)));
  return MY_MENU_IDS.map((id) => all.find((i) => i.id === id)).filter((i): i is MenuItem => !!i);
}

/** the sidebar's groups: every page except the person's own (those are in the profile menu) */
export function buildMenu(a: MenuAccess): MenuGroup[] {
  return allMenuGroups(a).map((g) => ({ ...g, items: g.items.filter((i) => !MY_MENU_IDS.includes(i.id)) }));
}

function allMenuGroups(a: MenuAccess): MenuGroup[] {
  const item = (id: string, label: string, route: string, icon: string, show: () => boolean): MenuItem => ({ id, label, route: '/secure/' + route, icon, show });
  const any = (...keys: string[]) => () => a.has(...keys);
  return [
    { key: 'home', label: 'Home', items: [
      item('nav-dashboard', 'Dashboard', 'dashboard', 'bi-speedometer2', () => a.canOpen('/secure/dashboard')),
      item('nav-shift', 'My shift', 'shift', 'bi-cash-stack', any('shiftdesk.view')),
      item('nav-todos', 'To-dos', 'todos', 'bi-check2-circle', any('todos.view')),
      item('nav-calendar', 'Calendar', 'calendar', 'bi-calendar3', any('calendar.view')),
      item('nav-reports', 'Reports', 'reports', 'bi-graph-up', any('reports')),
    ] },
    { key: 'sell', label: 'Sell', items: [
      item('nav-sales', 'Sales and billing', 'sales', 'bi-cash-coin', any('sales')),
      item('nav-customers', 'Customers', 'customers/cust/list', 'bi-people', any('customers.read')),
      item('nav-refills', 'Refills', 'quality/refills', 'bi-telephone-outbound', () => a.has('refills.view') && !a.has('grievances.view')),
      item('nav-inquiries', 'Requests and inquiries', 'inquiries', 'bi-chat-left-text', any('inquiries.view')),
      item('nav-price-changes', 'Price changes', 'price-changes', 'bi-tag', any('pricechanges.view')),
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
      item('nav-attendance-punch', 'Mark attendance', 'attendance-punch', 'bi-camera-video', any('attendpunch.use')),
      item('nav-attendance-review', 'Attendance review', 'attendance-review', 'bi-camera', any('attendreview.view')),
      item('nav-kpi-rate', 'Rate staff', 'kpi/rate', 'bi-clipboard-check', any('kpirate.rate')),
    ] },
    { key: 'oversight', label: 'Oversight', items: [
      item('nav-compliance', 'Compliance', 'compliance', 'bi-check2-square', any('compliance.view')),
      item('nav-review', 'Weekly review', 'review', 'bi-journal-check', any('review.view')),
      item('nav-quality', 'Staff and quality', 'quality', 'bi-shield-check', any('grievances.view')),
    ] },
    // the guides sit at the very bottom of the sidebar, below Setup: the screen draws this group last
    { key: 'learn', label: 'Learn', items: [
      item('nav-pharmacy-guide', 'Pharmacy guide', 'pharmacy-guide', 'bi-mortarboard', () => !!a.pack && a.pack('pharmacy')),
      item('nav-app-guide', 'App guide', 'app-guide', 'bi-question-circle', () => true),
      item('nav-knowledge', 'Knowledge check', 'knowledge', 'bi-patch-check', () => true),
      item('nav-feedback', 'Help and feedback', 'feedback', 'bi-chat-left-dots', any('feedback.add')),
    ] },
  ];
}

/**
 * The roles that work the counter. They get the grouped menu, laid out in the order of their day, whatever the business has chosen for
 * the other roles; those keep their menu until they are moved over.
 */
export const COUNTER_ROLES = ['Sales Staff', 'Counter'];

export function isCounterRole(roleName: string | null | undefined): boolean {
  return COUNTER_ROLES.includes(String(roleName ?? ''));
}

/** Few headings, the selling work first. The Dashboard stands alone at the top (its group has no heading). */
const COUNTER_LAYOUT: { key: string; label: string; ids: string[] }[] = [
  { key: 'home', label: '', ids: ['nav-dashboard', 'nav-todos', 'nav-calendar'] },
  { key: 'sell', label: 'Sell', ids: ['nav-sales', 'nav-customers', 'nav-refills', 'nav-inquiries', 'nav-price-changes'] },
  { key: 'stock', label: 'Stock and buying', ids: ['nav-store', 'nav-products', 'nav-outage', 'nav-schedule-register', 'nav-stock-audits', 'nav-purchases', 'nav-purchase-requests', 'nav-vendor-issues'] },
  { key: 'accounts', label: 'Money', ids: ['nav-expenses', 'nav-digital-payments', 'nav-gst-filing', 'nav-finance'] },
  { key: 'people', label: 'People', ids: ['nav-hr', 'nav-leave-approvals', 'nav-attendance-punch', 'nav-attendance-review', 'nav-kpi-rate'] },
  { key: 'learn', label: 'Learn', ids: ['nav-pharmacy-guide', 'nav-app-guide', 'nav-knowledge', 'nav-feedback'] },
];

/**
 * The same entries as the grouped menu, arranged for the counter: a role keeps every page its permissions open, so anything this layout
 * does not place (Reports, Compliance and the like) goes to a last group instead of disappearing.
 */
export function buildCounterMenu(a: MenuAccess): MenuGroup[] {
  const all: MenuItem[] = [];
  buildMenu(a).forEach((g) => g.items.forEach((i) => all.push(i)));
  const byId = new Map(all.map((i) => [i.id, i] as [string, MenuItem]));
  const placed = new Set<string>();
  const groups: MenuGroup[] = COUNTER_LAYOUT.map((g) => ({
    key: g.key, label: g.label, items: g.ids.map((id) => byId.get(id)).filter((i): i is MenuItem => !!i),
  }));
  groups.forEach((g) => g.items.forEach((i) => placed.add(i.id)));
  const rest = all.filter((i) => !placed.has(i.id));
  if (rest.length) groups.push({ key: 'more', label: 'More', items: rest });
  return groups;
}
