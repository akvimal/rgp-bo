-- Migration 008: Grant All Permissions to Admin Role
-- Purpose: Ensure admin role has comprehensive access to all features
-- Date: 2026-02-05

UPDATE app_role
SET permissions = '[
  {
    "resource": "site",
    "path": [
      "/secure/dashboard",
      "/secure/profile"
    ]
  },
  {
    "resource": "roles",
    "path": "/secure/roles",
    "policies": [
      {"action": "read", "properties": ["name", "permissions"]},
      {"action": "add", "path": "/new", "properties": ["name", "permissions"]},
      {"action": "edit", "path": "/edit", "properties": ["name", "permissions"]},
      {"action": "delete"}
    ]
  },
  {
    "resource": "users",
    "path": "/secure/users",
    "policies": [
      {"action": "read", "properties": ["fullname", "email", "phone", "location"]},
      {"action": "add", "path": "/new", "properties": ["fullname", "email", "phone", "location", "role", "password"]},
      {"action": "edit", "path": "/edit", "properties": ["fullname", "email", "phone", "location", "role"]},
      {"action": "delete"}
    ]
  },
  {
    "resource": "products",
    "path": "/secure/products",
    "policies": [
      {"action": "read", "properties": []},
      {"action": "add", "path": "/new", "properties": []},
      {"action": "edit", "path": "/edit", "properties": []},
      {"action": "delete"},
      {"action": "price", "path": "/price", "properties": []}
    ]
  },
  {
    "resource": "purchases",
    "path": [
      "/secure/purchases",
      "/secure/purchases/vendors",
      "/secure/purchases/orders",
      "/secure/purchases/invoices"
    ],
    "policies": [
      {"action": "read", "properties": []},
      {"action": "add", "path": "/new", "properties": []},
      {"action": "edit", "path": "/edit", "properties": []},
      {"action": "delete"},
      {"action": "vendors.edit", "path": "vendors/edit", "properties": []}
    ]
  },
  {
    "resource": "store",
    "path": [
      "/secure/store/stock",
      "/secure/store/cash"
    ],
    "policies": [
      {"action": "read", "properties": ["ptrcost"]},
      {"action": "adjust"}
    ]
  },
  {
    "resource": "customers",
    "path": "/secure/customers",
    "policies": [
      {"action": "read", "properties": []},
      {"action": "add", "path": "/new", "properties": []},
      {"action": "edit", "path": "/edit", "properties": []},
      {"action": "delete"}
    ]
  },
  {
    "resource": "sales",
    "data": "all",
    "path": [
      "/secure/sales/pos",
      "/secure/sales/pos/new",
      "/secure/sales/list",
      "/secure/sales/view",
      "/secure/sales/new",
      "/secure/sales/edit",
      "/secure/sales/returns",
      "/secure/sales/reminders",
      "/secure/sales/intent",
      "/secure/sales/deliveries"
    ],
    "policies": [
      {"action": "read", "properties": []},
      {"action": "view", "properties": []},
      {"action": "add", "path": "/new", "properties": []},
      {"action": "edit", "path": "/edit", "properties": []},
      {"action": "delete"},
      {"action": "bill", "path": "/bill/print"},
      {"action": "intent", "properties": []},
      {"action": "deliveries", "properties": []}
    ]
  },
  {
    "resource": "settings",
    "data": "all",
    "path": [
      "/secure/settings",
      "/secure/settings/users",
      "/secure/settings/roles",
      "/secure/settings/app"
    ],
    "policies": [
      {"action": "read", "properties": []},
      {"action": "view", "properties": []},
      {"action": "add", "path": "/new", "properties": []},
      {"action": "edit", "path": "/edit", "properties": []},
      {"action": "delete"}
    ]
  },
  {
    "resource": "reports",
    "path": [
      "/secure/reports",
      "/secure/reports/sales",
      "/secure/reports/inventory",
      "/secure/reports/financial"
    ],
    "policies": [
      {"action": "read", "properties": []},
      {"action": "view", "properties": []},
      {"action": "export", "properties": []}
    ]
  },
  {
    "resource": "hr",
    "path": [
      "/secure/hr",
      "/secure/hr/dashboard",
      "/secure/hr/attendance",
      "/secure/hr/leave",
      "/secure/hr/shifts",
      "/secure/hr/shift-assignments",
      "/secure/hr/benefits",
      "/secure/hr/analytics"
    ],
    "policies": [
      {"action": "read", "properties": []},
      {"action": "add", "properties": []},
      {"action": "edit", "properties": []},
      {"action": "delete"},
      {"action": "attendance.clockin", "properties": []},
      {"action": "attendance.clockout", "properties": []},
      {"action": "leave.request", "properties": []},
      {"action": "leave.approve", "properties": []},
      {"action": "shift.manage", "properties": []},
      {"action": "shift.assign", "properties": []}
    ]
  }
]'::jsonb,
updated_on = NOW()
WHERE id = 1;

-- Verify update
SELECT
  id,
  name,
  jsonb_array_length(permissions) as permission_count,
  (SELECT count(*) FROM jsonb_array_elements(permissions) p WHERE p->>'resource' = 'sales') as has_sales
FROM app_role
WHERE id = 1;

COMMENT ON COLUMN app_role.permissions IS 'JSONB array of resource permissions with paths and policies';
