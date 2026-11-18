/**
 * The grouped menu (DASHBOARD_AND_MENU_DESIGN 7.2): eight groups by the job the person is doing, a group with nothing the role may open is absent,
 * Setup (the settings submenu) follows below. Entries keep the test ids of the long-standing menu. Pure of Angular so it can be unit tested.
 */
/**
 * `needs` is the list of permissions the entry opens for (any one of them); it is data, so the permission registry test can check each against the
 * role editor. An entry with another rule (the dashboard follows the route check, a guide follows the business type) has no `needs` and a `show` of its own.
 */
export interface MenuItem { id: string; label: string; route: string; icon: string; needs: string[]; show: () => boolean; }
export interface MenuGroup { key: string; label: string; items: MenuItem[]; }
export interface MenuAccess { has: (...keys: string[]) => boolean; canOpen: (url: string) => boolean; pack?: (name: string) => boolean; }

/**
 * The "My ..." pages (My shift, My HR, My KPI) are about the signed-in person, not about the shop's work: they live in the profile menu at the top right
 * (buildMyMenu), not in the sidebar. buildMenu leaves them out; they are still defined here, once, with the same ids and permissions.
 */
const CASH_SIDE = ['store.shift.open', 'store.shift.close', 'store.adjust'];

export const MY_MENU_IDS =['nav-shift', 'nav-my-hr', 'nav-kpi-mine'];

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
  const item = (id: string, label: string, route: string, icon: string, rule: string[] | (() => boolean)): MenuItem => Array.isArray(rule)
    ? { id, label, route: '/secure/' + route, icon, needs: rule, show: () => a.has(...rule) }
    : { id, label, route: '/secure/' + route, icon, needs: [], show: rule };
  return [
    { key: 'home', label: 'Home', items: [
      item('nav-dashboard', 'Dashboard', 'dashboard', 'bi-speedometer2', () => a.canOpen('/secure/dashboard')),
      item('nav-shift', 'My shift', 'shift', 'bi-cash-stack', ['shiftdesk.view']),
      item('nav-todos', 'To-dos', 'todos', 'bi-check2-circle', ['todos.view']),
      item('nav-checklists', 'Checklists', 'checklists', 'bi-list-check', ['checklists.view']),
      item('nav-calendar', 'Calendar', 'calendar', 'bi-calendar3', ['calendar.view']),
      item('nav-reports', 'Reports', 'reports', 'bi-graph-up', ['reports']),
    ] },
    { key: 'sell', label: 'Sell', items: [
      item('nav-sales', 'Sales and billing', 'sales', 'bi-cash-coin', ['sales']),
      item('nav-customers', 'Customers', 'customers/cust/list', 'bi-people', ['customers.read']),
      item('nav-commitments', 'Customer orders', 'commitments', 'bi-bag-heart', ['customerorders.view', 'customerorders.manage']),
      item('nav-refills', 'Refills', 'quality/refills', 'bi-telephone-outbound', ['refills.view']),
      item('nav-grievances', 'Complaints', 'quality/grievances', 'bi-exclamation-octagon', ['grievances.view']),
      item('nav-inquiries', 'Requests and inquiries', 'inquiries', 'bi-chat-left-text', ['inquiries.view']),
      item('nav-whatsapp', 'WhatsApp', 'whatsapp', 'bi-whatsapp', ['whatsapp.view']),
    ] },
    { key: 'stock', label: 'Inventory', items: [
      item('nav-products', 'Products and prices', 'products', 'bi-boxes', ['products']),
      item('nav-price-changes', 'Price changes', 'price-changes', 'bi-tag', ['pricechanges.view']),
      item('nav-store', 'Stock', 'store', 'bi-box-seam', ['store.read']),
      item('nav-stock-audits', 'Stock audits', 'stock-audits', 'bi-clipboard-data', ['stockaudit.view']),
      item('nav-schedule-register', 'Drug register', 'schedule-register', 'bi-capsule', ['scheduleregister.view']),
    ] },
    // the shop's cash: the drawer shifts, the cash book and the vault. They share a permission group with Stock but are their own pages
    { key: 'cash', label: 'Cash', items: [
      item('nav-shifts', 'Shifts', 'store/shifts', 'bi-clock-history', CASH_SIDE),
      item('nav-cash-book', 'Cash book', 'store/cash', 'bi-cash-stack', CASH_SIDE),
      item('nav-vault', 'Vault', 'store/vault', 'bi-safe', CASH_SIDE),
    ] },
    { key: 'buy', label: 'Purchasing', items: [
      item('nav-purchases', 'Purchase', 'purchases', 'bi-bag-check', ['purchases.add']),
      item('nav-purchase-requests', 'Purchase requests', 'purchases/my-requests', 'bi-bag-plus', ['purchases.request']),
      item('nav-vendor-issues', 'Vendor issues', 'vendor-issues', 'bi-arrow-return-left', ['vendorissues.view']),
    ] },
    { key: 'accounts', label: 'Accounts', items: [
      item('nav-financials', 'Financial dashboard', 'financials', 'bi-graph-up', ['finance.view', 'expenses.approve']),
      item('nav-expenses', 'Expenses', 'expenses', 'bi-wallet2', ['expenses.view']),
      item('nav-digital-payments', 'Digital payments', 'digital-payments', 'bi-qr-code-scan', ['paymentrecon.view']),
      item('nav-gst-filing', 'GST', 'gst-filing', 'bi-receipt', ['gstfiling.view']),
      item('nav-finance', 'Finance', 'finance', 'bi-bank', ['finance.view']),
      item('nav-discrepancies', 'Cash and shifts', 'quality/discrepancies', 'bi-cash-stack', ['discrepancies.view']),
    ] },
    { key: 'people', label: 'People', items: [
      item('nav-my-hr', 'My HR', 'my-hr', 'bi-person-badge', ['myhr.view']),
      item('nav-kpi-mine', 'My KPI', 'kpi/mine', 'bi-graph-up-arrow', ['mykpi.view']),
      item('nav-hr', 'Staff and HR', 'hr', 'bi-people', ['hr.view']),
      item('nav-leave-approvals', 'Leave requests', 'leave-approvals', 'bi-calendar2-check', ['leaveapprove.decide']),
      item('nav-attendance-punch', 'Mark attendance', 'attendance-punch', 'bi-camera-video', ['attendpunch.use']),
      item('nav-attendance-review', 'Attendance review', 'attendance-review', 'bi-camera', ['attendreview.view']),
      item('nav-kpi-rate', 'Rate staff', 'kpi/rate', 'bi-clipboard-check', ['kpirate.rate']),
      item('nav-staff-credit', 'Staff credit', 'quality/staff-credit', 'bi-wallet', ['staffcredit.view']),
      item('nav-staff-sales', 'Staff performance', 'quality/staff-sales', 'bi-person-lines-fill', ['staffsales.view']),
    ] },
    { key: 'oversight', label: 'Oversight', items: [
      item('nav-compliance', 'Compliance', 'compliance', 'bi-check2-square', ['compliance.view']),
      item('nav-review', 'Weekly review', 'review', 'bi-journal-check', ['review.view']),
      item('nav-audit', 'Audit log', 'quality/audit', 'bi-shield-check', ['audit.view']),
    ] },
    // the guides sit at the very bottom of the sidebar, below Setup: the screen draws this group last
    { key: 'learn', label: 'Learn', items: [
      item('nav-pharmacy-guide', 'Pharmacy guide', 'pharmacy-guide', 'bi-mortarboard', () => !!a.pack && a.pack('pharmacy')),
      item('nav-app-guide', 'App guide', 'app-guide', 'bi-question-circle', () => true),
      item('nav-knowledge', 'Knowledge check', 'knowledge', 'bi-patch-check', () => true),
      item('nav-feedback', 'Help and feedback', 'feedback', 'bi-chat-left-dots', ['feedback.add']),
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
  { key: 'home', label: '', ids: ['nav-dashboard', 'nav-todos', 'nav-checklists', 'nav-calendar'] },
  { key: 'sell', label: 'Sell', ids: ['nav-sales', 'nav-customers', 'nav-commitments', 'nav-refills', 'nav-grievances', 'nav-inquiries', 'nav-whatsapp'] },
  { key: 'stock', label: 'Stock and buying', ids: ['nav-store', 'nav-products', 'nav-price-changes', 'nav-schedule-register', 'nav-stock-audits', 'nav-purchases', 'nav-purchase-requests', 'nav-vendor-issues'] },
  { key: 'accounts', label: 'Money', ids: ['nav-expenses', 'nav-digital-payments', 'nav-gst-filing', 'nav-finance', 'nav-discrepancies', 'nav-shifts', 'nav-cash-book', 'nav-vault'] },
  { key: 'people', label: 'People', ids: ['nav-hr', 'nav-leave-approvals', 'nav-attendance-punch', 'nav-attendance-review', 'nav-kpi-rate', 'nav-staff-credit', 'nav-staff-sales'] },
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
