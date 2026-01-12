export interface PermissionAction {
  action: string;
  label: string;
  requiresPath?: boolean;
  requiresProperties?: boolean;
}

export interface ResourcePermission {
  resource: string;
  label: string;
  description: string;
  defaultPaths?: string[];
  actions: PermissionAction[];
  availableProperties?: string[];
}

export const PERMISSION_RESOURCES: ResourcePermission[] = [
  {
    resource: 'site',
    label: 'Site Navigation',
    description: 'Access to basic site pages',
    defaultPaths: ['/secure/dashboard', '/secure/profile'],
    actions: [
      { action: 'access', label: 'Access Site' }
    ]
  },
  {
    resource: 'roles',
    label: 'Roles & Permissions',
    description: 'Manage user roles and permissions',
    defaultPaths: ['/secure/settings/roles'],
    actions: [
      { action: 'read', label: 'View Roles' },
      { action: 'add', label: 'Create Role', requiresPath: true },
      { action: 'edit', label: 'Edit Role', requiresPath: true },
      { action: 'delete', label: 'Delete Role' }
    ],
    availableProperties: ['name', 'permissions']
  },
  {
    resource: 'users',
    label: 'User Management',
    description: 'Manage system users',
    defaultPaths: ['/secure/settings/users'],
    actions: [
      { action: 'read', label: 'View Users', requiresProperties: true },
      { action: 'add', label: 'Create User', requiresPath: true, requiresProperties: true },
      { action: 'edit', label: 'Edit User', requiresPath: true, requiresProperties: true },
      { action: 'delete', label: 'Delete User' }
    ],
    availableProperties: ['fullname', 'email', 'phone', 'location', 'role', 'password']
  },
  {
    resource: 'products',
    label: 'Product Management',
    description: 'Manage product catalog and pricing',
    defaultPaths: ['/secure/products', '/secure/products/master', '/secure/products/price', '/secure/products/hsn'],
    actions: [
      { action: 'read', label: 'View Products', requiresProperties: true },
      { action: 'add', label: 'Create Product', requiresPath: true, requiresProperties: true },
      { action: 'edit', label: 'Edit Product', requiresPath: true, requiresProperties: true },
      { action: 'delete', label: 'Delete Product' },
      { action: 'price', label: 'Manage Pricing', requiresPath: true },
      { action: 'hsn.read', label: 'View HSN Codes', requiresPath: true },
      { action: 'hsn.add', label: 'Add HSN Code', requiresPath: true },
      { action: 'hsn.edit', label: 'Edit HSN Code', requiresPath: true },
      { action: 'hsn.delete', label: 'Delete HSN Code' }
    ],
    availableProperties: ['title', 'description', 'ptrcost', 'mrp', 'cgst', 'sgst']
  },
  {
    resource: 'purchases',
    label: 'Purchase Management',
    description: 'Manage purchase orders and invoices',
    defaultPaths: ['/secure/purchases', '/secure/purchases/orders', '/secure/purchases/invoices', '/secure/purchases/vendors'],
    actions: [
      { action: 'read', label: 'View Purchases', requiresProperties: true },
      { action: 'add', label: 'Create Purchase', requiresPath: true },
      { action: 'edit', label: 'Edit Purchase', requiresPath: true },
      { action: 'delete', label: 'Delete Purchase' },
      { action: 'vendors.read', label: 'View Vendors' },
      { action: 'vendors.add', label: 'Add Vendor', requiresPath: true },
      { action: 'vendors.edit', label: 'Edit Vendor', requiresPath: true },
      { action: 'vendors.delete', label: 'Delete Vendor' }
    ],
    availableProperties: ['name', 'vendorname', 'ponumber', 'invoicenumber', 'amount', 'ptrvalue']
  },
  {
    resource: 'store',
    label: 'Store Management',
    description: 'Manage store stock and cash',
    defaultPaths: ['/secure/store/stock', '/secure/store/cash'],
    actions: [
      { action: 'read', label: 'View Store Data', requiresProperties: true },
      { action: 'adjust', label: 'Stock Adjustment' }
    ],
    availableProperties: ['ptrcost', 'mrp', 'qty', 'balance']
  },
  {
    resource: 'customers',
    label: 'Customer Management',
    description: 'Manage customer records',
    defaultPaths: ['/secure/customers'],
    actions: [
      { action: 'read', label: 'View Customers' },
      { action: 'add', label: 'Add Customer', requiresPath: true },
      { action: 'edit', label: 'Edit Customer', requiresPath: true },
      { action: 'delete', label: 'Delete Customer' }
    ],
    availableProperties: ['name', 'phone', 'email', 'address']
  },
  {
    resource: 'sales',
    label: 'Sales Management',
    description: 'Manage sales, POS, and sales intents',
    defaultPaths: [
      '/secure/sales/pos', '/secure/sales/pos/new', '/secure/sales/list',
      '/secure/sales/view', '/secure/sales/new', '/secure/sales/edit',
      '/secure/sales/returns', '/secure/sales/reminders',
      '/secure/sales/intent', '/secure/sales/intent/new',
      '/secure/sales/intent/edit', '/secure/sales/intent/view'
    ],
    actions: [
      { action: 'read', label: 'View Sales' },
      { action: 'view', label: 'View Sale Details' },
      { action: 'add', label: 'Create Sale', requiresPath: true },
      { action: 'edit', label: 'Edit Sale', requiresPath: true },
      { action: 'delete', label: 'Delete Sale' },
      { action: 'bill', label: 'Print Bill', requiresPath: true },
      { action: 'return', label: 'Process Returns' },
      { action: 'intent.read', label: 'View Sales Intents', requiresPath: true },
      { action: 'intent.add', label: 'Create Sales Intent', requiresPath: true },
      { action: 'intent.edit', label: 'Edit Sales Intent', requiresPath: true },
      { action: 'intent.view', label: 'View Intent Details', requiresPath: true },
      { action: 'intent.delete', label: 'Delete Sales Intent' },
      { action: 'intent.cancel', label: 'Cancel Sales Intent' }
    ],
    availableProperties: ['billno', 'customername', 'total', 'items']
  },
  {
    resource: 'reports',
    label: 'Reports',
    description: 'Access to reporting module',
    defaultPaths: ['/secure/reports'],
    actions: [
      { action: 'read', label: 'View Reports' },
      { action: 'export', label: 'Export Reports' }
    ]
  },
  {
    resource: 'settings',
    label: 'Settings',
    description: 'Application settings',
    defaultPaths: ['/secure/settings', '/secure/settings/users', '/secure/settings/roles', '/secure/settings/app'],
    actions: [
      { action: 'read', label: 'View Settings' },
      { action: 'view', label: 'View Details' },
      { action: 'add', label: 'Add Setting', requiresPath: true },
      { action: 'edit', label: 'Edit Setting', requiresPath: true }
    ]
  }
];

export interface PermissionState {
  [resource: string]: {
    enabled: boolean;
    paths: string[];
    actions: {
      [action: string]: {
        enabled: boolean;
        path?: string;
        properties?: string[];
      };
    };
  };
}
