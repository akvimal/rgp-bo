export interface PermissionProperty {
  key: string;
  label: string;
}

export interface PermissionAction {
  key: string;
  label: string;
  hint?: string;
  properties?: PermissionProperty[];
  fixedProperties?: string[];
}

export interface PermissionResource {
  key: string;
  label: string;
  description: string;
  group: string;
  path: string | string[];
  settingsPath?: boolean;
  presenceOnly?: boolean;
  bundle?: boolean;
  bundleLabel?: string;
  pathOptions?: PermissionProperty[];
  actions: PermissionAction[];
}

export const PERMISSION_GROUPS = [
  'Administration',
  'Catalog & Purchasing',
  'Sales & Store Operations',
  'Staff & Quality',
  'Reporting',
];

export const PERMISSION_CATALOG: PermissionResource[] = [
  {
    key: 'businesses',
    label: 'Businesses',
    description: 'Create and manage top-level businesses.',
    group: 'Administration',
    path: '/secure/settings/businesses',
    settingsPath: true,
    bundle: true,
    bundleLabel: 'Can manage businesses',
    actions: [
      { key: 'manage', label: 'Manage' },
      { key: 'read', label: 'Read' },
      { key: 'add', label: 'Add' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'roles',
    label: 'Roles & Permissions',
    description: 'Create, edit, and delete roles and configure what they can do.',
    group: 'Administration',
    path: '/secure/settings/roles',
    settingsPath: true,
    bundle: true,
    bundleLabel: 'Can manage roles',
    actions: [
      { key: 'read', label: 'Read', fixedProperties: ['name', 'permissions'] },
      { key: 'add', label: 'Add', fixedProperties: ['name', 'permissions'] },
      { key: 'edit', label: 'Edit', fixedProperties: ['name', 'permissions'] },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'users',
    label: 'Users',
    description: 'Manage user accounts, roles, and store assignments.',
    group: 'Administration',
    path: '/secure/settings/users',
    settingsPath: true,
    actions: [
      {
        key: 'read', label: 'View users',
        properties: [
          { key: 'fullname', label: 'Full name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'location', label: 'Location' },
        ],
      },
      {
        key: 'add', label: 'Create users',
        properties: [
          { key: 'fullname', label: 'Full name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'location', label: 'Location' },
          { key: 'password', label: 'Password' },
          { key: 'role', label: 'Role' },
          { key: 'storeids', label: 'Store assignment' },
          { key: 'businessid', label: 'Business link' },
        ],
      },
      {
        key: 'edit', label: 'Edit users',
        properties: [
          { key: 'fullname', label: 'Full name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'location', label: 'Location' },
          { key: 'role', label: 'Role' },
          { key: 'storeids', label: 'Store assignment' },
          { key: 'businessid', label: 'Business link' },
        ],
      },
      { key: 'delete', label: 'Remove users' },
    ],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Configure Telegram digests: per-store chats, send time, preview and send now.',
    group: 'Administration',
    path: '/secure/settings/notifications',
    settingsPath: true,
    bundle: true,
    bundleLabel: 'Can manage notifications',
    actions: [
      { key: 'manage', label: 'Manage' },
    ],
  },
  {
    key: 'alerts',
    label: 'Alerts',
    description: 'Set up which alerts the shop gets (deposits, licences, shifts, approvals), who sees them and how loudly.',
    group: 'Administration',
    path: '/secure/settings/alerts',
    settingsPath: true,
    bundle: true,
    bundleLabel: 'Can manage alerts',
    actions: [
      { key: 'manage', label: 'Manage' },
    ],
  },
  {
    key: 'grievances',
    label: 'Grievances',
    description: 'Log and follow up customer complaints: assign, resolve within the due date, keep a timeline.',
    group: 'Staff & Quality',
    path: '/secure/quality/grievances',
    bundle: true,
    bundleLabel: 'Can handle grievances',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'add', label: 'Log and add notes' },
      { key: 'manage', label: 'Assign, resolve and reopen' },
    ],
  },
  {
    key: 'refills',
    label: 'Refill Follow-up',
    description: 'Customers due a refill: log the contact and the outcome.',
    group: 'Staff & Quality',
    path: '/secure/quality/refills',
    bundle: true,
    bundleLabel: 'Can follow up refills',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'manage', label: 'Log contacts' },
    ],
  },
  {
    key: 'businessprofile',
    label: 'Business Details',
    description: 'Name, legal name, GSTIN, state, address and pincode of the business.',
    group: 'Administration',
    path: '/secure/settings/business-profile',
    settingsPath: true,
    bundle: true,
    bundleLabel: 'Can edit business details',
    actions: [
      { key: 'manage', label: 'Manage' },
    ],
  },
  {
    key: 'expenses',
    label: 'Expenses',
    description: 'Business- and store-level expenses with approval, recurring entries and a report.',
    group: 'Staff & Quality',
    path: '/secure/expenses',
    actions: [
      { key: 'view', label: 'View (own, or their store)' },
      { key: 'add', label: 'Raise expenses' },
      { key: 'approve', label: 'Approve within their limit; see the report' },
      { key: 'manage', label: 'Set the limit, categories and recurring entries' },
    ],
  },
  {
    key: 'paymentrecon',
    label: 'Digital payments',
    description: 'Check QR and card machine payments against the Paytm statement, bill by bill.',
    group: 'Staff & Quality',
    path: '/secure/digital-payments',
    actions: [
      { key: 'view', label: 'View (all bills, or their store)' },
      { key: 'verify', label: 'Mark payments verified, different or missing' },
    ],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Send bill copies to customers on WhatsApp, from the number of each store, and see what was sent.',
    group: 'Sales & Store Operations',
    path: '/secure/whatsapp',
    actions: [
      { key: 'view', label: 'View the WhatsApp log and bill status' },
      { key: 'send', label: 'Send a bill copy to a customer' },
      { key: 'settings', label: 'Set the store number and token, switch sending on' },
    ],
  },
  {
    key: 'vendorissues',
    label: 'Vendor issues',
    description: 'Invoice corrections and defective goods raised with vendors, tracked to a settlement.',
    group: 'Catalog & Purchasing',
    path: '/secure/vendor-issues',
    actions: [
      { key: 'view', label: 'View (own, or their store)' },
      { key: 'add', label: 'Raise issues, send them and add notes' },
      { key: 'return', label: 'Send defective goods back (takes them out of stock)' },
      { key: 'manage', label: 'Settle or refuse, reopen, and see the vendor scorecard' },
    ],
  },
  {
    key: 'stockaudit',
    label: 'Stock audits',
    description: 'Routine stock audits: plans, what is due, and what each found.',
    group: 'Sales & Store Operations',
    path: '/secure/stock-audits',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'perform', label: 'Carry out an audit' },
      { key: 'manage', label: 'Make plans, assign and skip audits' },
    ],
  },
  {
    key: 'pricechanges',
    label: 'Price changes sheet',
    description: 'What changed in the selling prices over a period (what the customer pays), to read at the counter or print. It shows no cost.',
    group: 'Sales & Store Operations',
    path: '/secure/price-changes',
    actions: [{ key: 'view', label: 'Open and print the sheet' }],
  },
  {
    key: 'todos',
    label: 'To-dos',
    description: 'The to-do list with reminders: keep your own, tick the shared ones of your store, and (for managers) give them to others and see the whole team.',
    group: 'Sales & Store Operations',
    path: '/secure/todos',
    actions: [
      { key: 'view', label: 'Open the page, see and tick your to-dos and those of your store' },
      { key: 'add', label: 'Add, change and remove your own to-dos' },
      { key: 'assign', label: 'Give to-dos to other people and to the staff of a store, and see the team list' },
    ],
  },
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'A month, week and day view of what is dated: leave, holidays, to-dos, licence expiries, stock audits, prescription follow-ups and your own attendance. It only shows what the role may already see elsewhere.',
    group: 'Sales & Store Operations',
    path: '/secure/calendar',
    actions: [{ key: 'view', label: 'Open the calendar' }],
  },
  {
    key: 'feedback',
    label: 'Help and feedback',
    description: 'Report something wrong, ask a question or suggest a feature, naming the module and feature, and read the answer. Managers also answer from an inbox.',
    group: 'Sales & Store Operations',
    path: '/secure/feedback',
    actions: [
      { key: 'add', label: 'Send reports, questions and suggestions and read the answers to your own' },
      { key: 'manage', label: 'See everyone\'s reports, reply, leave internal notes, set the status and assign' },
    ],
  },
  {
    key: 'shiftdesk',
    label: 'My shift page',
    description: 'The page where staff open and close their shift; opening and closing themselves are still the store shift permissions.',
    group: 'Sales & Store Operations',
    path: '/secure/shift',
    actions: [{ key: 'view', label: 'Open the page' }],
  },
  {
    key: 'myhr',
    label: 'My HR',
    description: 'A staff member\'s own details, pay slips (once payroll is approved), leave, attendance and staff credit.',
    group: 'Staff & Quality',
    path: '/secure/my-hr',
    actions: [
      { key: 'view', label: 'See my own HR information' },
      { key: 'apply', label: 'Apply for leave and withdraw requests' },
    ],
  },
  {
    key: 'leaveapprove',
    label: 'Leave requests',
    description: 'Decide the leave requests of the staff of their own stores (never their own).',
    group: 'Staff & Quality',
    path: '/secure/leave-approvals',
    actions: [{ key: 'decide', label: 'Approve or decline leave' }],
  },
  {
    key: 'attendpunch',
    label: 'Mark attendance',
    description: 'The attendance screen of a registered store PC: staff mark In and Out with a PIN and a webcam photo.',
    group: 'Staff & Quality',
    path: '/secure/attendance-punch',
    actions: [{ key: 'use', label: 'Open the attendance screen' }],
  },
  {
    key: 'attendreview',
    label: 'Attendance review',
    description: 'Check the punches and photos of each day for the staff of their own stores (never their own), correct days, and choose who punches. Payroll waits for this review.',
    group: 'Staff & Quality',
    path: '/secure/attendance-review',
    actions: [
      { key: 'view', label: 'See the days and photos' },
      { key: 'decide', label: 'Approve or change days, and set PINs' },
    ],
  },
  {
    key: 'inquiries',
    label: 'Customer inquiries',
    description: 'Record what customers ask for, follow it up and close it; counts towards KPI.',
    group: 'Staff & Quality',
    path: '/secure/inquiries',
    actions: [
      { key: 'view', label: 'View (own, or their store)' },
      { key: 'add', label: 'Record inquiries' },
      { key: 'close', label: 'Close inquiries' },
      { key: 'manage', label: 'Assign, reopen and see the whole store' },
    ],
  },
  {
    key: 'kpirate',
    label: 'Rate staff KPI',
    description: 'Rate the manual KPI measures of staff of their own stores.',
    group: 'Staff & Quality',
    path: '/secure/kpi/rate',
    actions: [{ key: 'rate', label: 'Rate staff' }],
  },
  {
    key: 'mykpi',
    label: 'My KPI',
    description: 'See one\'s own finalised KPI scores and the evidence behind them.',
    group: 'Staff & Quality',
    path: '/secure/kpi/mine',
    actions: [{ key: 'view', label: 'View my KPI' }],
  },
  {
    key: 'hr',
    label: 'HR',
    description: 'Staff records, salary and revisions, leave, attendance, KPI and monthly payroll with pay stubs. Business Head only.',
    group: 'Staff & Quality',
    path: '/secure/hr',
    bundle: true,
    bundleLabel: 'Can manage HR and payroll',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'manage', label: 'Change staff, pay and leave' },
    ],
  },
  {
    key: 'staffcredit',
    label: 'Staff Credit',
    description: 'Monthly credit limit per person, what staff took on credit and what was recovered from salary.',
    group: 'Staff & Quality',
    path: '/secure/quality/staff-credit',
    bundle: true,
    bundleLabel: 'Can manage staff credit',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'manage', label: 'Set limits and record recoveries' },
    ],
  },
  {
    key: 'discrepancies',
    label: 'Cash & Shifts',
    description: 'Shifts that did not balance, expenses without receipts, shifts never closed.',
    group: 'Staff & Quality',
    path: '/secure/quality/discrepancies',
    bundle: true,
    bundleLabel: 'Can view cash and shift discrepancies',
    actions: [
      { key: 'view', label: 'View' },
    ],
  },
  {
    key: 'staffsales',
    label: 'Staff Sales',
    description: 'Sales, bills, discounts, returns and edits per person.',
    group: 'Staff & Quality',
    path: '/secure/quality/staff-sales',
    bundle: true,
    bundleLabel: 'Can view staff sales',
    actions: [
      { key: 'view', label: 'View' },
    ],
  },
  {
    key: 'audit',
    label: 'Audit Log',
    description: 'See who did what and when: sign-ins, edits to bills, changes made on behalf of others.',
    group: 'Staff & Quality',
    path: '/secure/quality/audit',
    bundle: true,
    bundleLabel: 'Can view the audit log',
    actions: [
      { key: 'view', label: 'View' },
    ],
  },
  {
    key: 'storesettings',
    label: 'Store Settings',
    description: 'Add, edit, and archive store locations, cash policy, and shift templates.',
    group: 'Administration',
    path: '/secure/settings/store',
    settingsPath: true,
    bundle: true,
    bundleLabel: 'Can manage store settings',
    actions: [
      { key: 'read', label: 'Read' },
      { key: 'add', label: 'Add' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'products',
    label: 'Products',
    description: 'Manage the product catalog and pricing.',
    group: 'Catalog & Purchasing',
    path: '/secure/products',
    actions: [
      { key: 'price', label: 'Adjust pricing', fixedProperties: ['title', 'description'] },
      { key: 'add', label: 'Add products', fixedProperties: ['title', 'description'] },
      { key: 'edit', label: 'Edit products', fixedProperties: ['title'] },
      { key: 'delete', label: 'Delete products' },
    ],
  },
  {
    key: 'purchases',
    label: 'Purchases & Vendors',
    description: 'Manage purchase invoices, requests, and vendor records.',
    group: 'Catalog & Purchasing',
    path: ['/secure/purchases', '/secure/purchases/vendors'],
    actions: [
      { key: 'read', label: 'View purchases', properties: [{ key: 'name', label: 'Name' }] },
      { key: 'add', label: 'Create purchases', properties: [{ key: 'name', label: 'Name' }] },
      { key: 'edit', label: 'Edit purchases', properties: [{ key: 'name', label: 'Name' }] },
      { key: 'vendors.edit', label: 'Edit vendors', properties: [{ key: 'name', label: 'Name' }] },
      { key: 'delete', label: 'Delete purchases' },
      { key: 'request', label: 'Raise purchase requests only' },
    ],
  },
  {
    key: 'purchaseorders',
    label: 'Purchase Order Approvals',
    description: 'Approve or reject purchase orders pending approval.',
    group: 'Catalog & Purchasing',
    path: ['/secure/purchases/orders'],
    actions: [
      { key: 'approve', label: 'Approve orders' },
      { key: 'reject', label: 'Reject orders' },
    ],
  },
  {
    key: 'store',
    label: 'Stock & Cash',
    description: 'Day-to-day stock adjustments and cash handling at a store.',
    group: 'Sales & Store Operations',
    path: ['/secure/store/stock', '/secure/store/cash', '/secure/store/shifts', '/secure/store/transfers', '/secure/store/vault'],
    actions: [
      { key: 'read', label: 'View purchase cost (PTR)', fixedProperties: ['ptrcost'] },
      { key: 'adjust', label: 'Adjust stock & cash' },
      { key: 'shift.open', label: 'Open a shift', hint: 'Start a cash drawer session and count the opening float.' },
      { key: 'shift.close', label: 'Close a shift', hint: 'Count the drawer and close the cash drawer session.' },
    ],
  },
  {
    key: 'stock',
    label: 'Stock Visibility',
    description: 'View current stock levels (lightweight, read-only access).',
    group: 'Sales & Store Operations',
    path: '/secure/stock',
    actions: [
      { key: 'read', label: 'View stock levels', fixedProperties: [] },
    ],
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'View customer records.',
    group: 'Sales & Store Operations',
    path: '/secure/customers',
    actions: [
      { key: 'read', label: 'View customers', fixedProperties: [] },
      { key: 'delete', label: 'Delete customers', fixedProperties: [] },
      { key: 'reveal', label: 'See customers\' full phone numbers, emails and addresses', fixedProperties: [] },
      { key: 'export', label: 'Download customer lists', fixedProperties: [] },
    ],
  },
  {
    key: 'sales',
    label: 'Sales & POS',
    description: 'Point of sale, sales list, returns, and deliveries.',
    group: 'Sales & Store Operations',
    path: [
      '/secure/sales/pos', '/secure/sales/pos/new', '/secure/sales/list', '/secure/sales/view',
      '/secure/sales/new', '/secure/sales/edit', '/secure/sales/returns',
      '/secure/sales/deliveries',
    ],
    pathOptions: [
      { key: '/secure/sales/pos', label: 'Point of Sale' },
      { key: '/secure/sales/pos/new', label: 'New POS sale' },
      { key: '/secure/sales/list', label: 'Sales list' },
      { key: '/secure/sales/view', label: 'View sale' },
      { key: '/secure/sales/new', label: 'New sale' },
      { key: '/secure/sales/edit', label: 'Edit sale' },
      { key: '/secure/sales/returns', label: 'Returns' },
      { key: '/secure/sales/deliveries', label: 'Deliveries' },
    ],
    actions: [
      { key: 'read', label: 'View sales list' },
      { key: 'view', label: 'View sale details' },
      { key: 'add', label: 'Create sales' },
      { key: 'bill', label: 'Print bills' },
      { key: 'void', label: 'Void any bill of the open shift (everyone may void their own)' },
      { key: 'forcevoid', label: 'Force void a bill even after its shift is closed (Business Head)' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Access the business intelligence and reports section.',
    group: 'Reporting',
    path: ['/secure/reports'],
    presenceOnly: true,
    actions: [],
  },
];
