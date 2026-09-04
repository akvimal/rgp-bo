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
    path: ['/secure/store/stock', '/secure/store/cash', '/secure/store/shifts'],
    actions: [
      { key: 'read', label: 'View purchase cost (PTR)', fixedProperties: ['ptrcost'] },
      { key: 'adjust', label: 'Adjust stock & cash' },
      { key: 'shift.open', label: 'Open a shift', hint: 'Start a till session and count the opening float.' },
      { key: 'shift.close', label: 'Close a shift', hint: 'Count the drawer and close the till session.' },
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
    ],
  },
  {
    key: 'sales',
    label: 'Sales & POS',
    description: 'Point of sale, sales list, returns, reminders, and deliveries.',
    group: 'Sales & Store Operations',
    path: [
      '/secure/sales/pos', '/secure/sales/pos/new', '/secure/sales/list', '/secure/sales/view',
      '/secure/sales/new', '/secure/sales/edit', '/secure/sales/returns', '/secure/sales/reminders',
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
      { key: '/secure/sales/reminders', label: 'Reminders' },
      { key: '/secure/sales/deliveries', label: 'Deliveries' },
    ],
    actions: [
      { key: 'read', label: 'View sales list' },
      { key: 'view', label: 'View sale details' },
      { key: 'add', label: 'Create sales' },
      { key: 'bill', label: 'Print bills' },
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
