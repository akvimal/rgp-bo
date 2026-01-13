-- Migration 013: Complete Feature Group Access Levels
-- Adds access level definitions for all remaining feature groups

-- =====================================================
-- PURCHASE MANAGEMENT ACCESS LEVELS
-- =====================================================
INSERT INTO access_level (feature_group_id, level_name, level_order, display_name, description, permissions) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'purchase_management'),
    'none',
    0,
    'No Access',
    'Cannot access purchase features',
    '[]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'purchase_management'),
    'view',
    1,
    'View Only',
    'Can view purchase orders and invoices',
    '[
        {"resource": "purchases", "action": "read", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'purchase_management'),
    'edit',
    2,
    'Edit',
    'Can create and edit purchase orders',
    '[
        {"resource": "purchases", "action": "read", "dataScope": "all"},
        {"resource": "purchases", "action": "add", "dataScope": "all"},
        {"resource": "purchases", "action": "edit", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'purchase_management'),
    'full',
    3,
    'Full Access',
    'Complete purchase operations including delete and vendor management',
    '[
        {"resource": "purchases", "action": "read", "dataScope": "all"},
        {"resource": "purchases", "action": "add", "dataScope": "all"},
        {"resource": "purchases", "action": "edit", "dataScope": "all"},
        {"resource": "purchases", "action": "delete", "dataScope": "all"},
        {"resource": "purchases", "action": "vendors.read", "dataScope": "all"},
        {"resource": "purchases", "action": "vendors.edit", "dataScope": "all"}
    ]'::jsonb
);

-- =====================================================
-- CUSTOMER MANAGEMENT ACCESS LEVELS
-- =====================================================
INSERT INTO access_level (feature_group_id, level_name, level_order, display_name, description, permissions) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'customer_management'),
    'none',
    0,
    'No Access',
    'Cannot access customer features',
    '[]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'customer_management'),
    'view',
    1,
    'View Only',
    'Can view customer information',
    '[
        {"resource": "customers", "action": "read", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'customer_management'),
    'edit',
    2,
    'Edit',
    'Can create and edit customers',
    '[
        {"resource": "customers", "action": "read", "dataScope": "all"},
        {"resource": "customers", "action": "add", "dataScope": "all"},
        {"resource": "customers", "action": "edit", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'customer_management'),
    'full',
    3,
    'Full Access',
    'Complete customer management including credit accounts',
    '[
        {"resource": "customers", "action": "read", "dataScope": "all"},
        {"resource": "customers", "action": "add", "dataScope": "all"},
        {"resource": "customers", "action": "edit", "dataScope": "all"},
        {"resource": "customers", "action": "delete", "dataScope": "all"}
    ]'::jsonb
);

-- =====================================================
-- HR MANAGEMENT ACCESS LEVELS
-- =====================================================
INSERT INTO access_level (feature_group_id, level_name, level_order, display_name, description, permissions) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'hr_management'),
    'none',
    0,
    'No Access',
    'Cannot access HR features',
    '[]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'hr_management'),
    'view',
    1,
    'View Only',
    'Can view HR information',
    '[
        {"resource": "hr", "action": "read", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'hr_management'),
    'edit',
    2,
    'Edit',
    'Can manage attendance and leave',
    '[
        {"resource": "hr", "action": "read", "dataScope": "all"},
        {"resource": "hr", "action": "attendance.clockin", "dataScope": "all"},
        {"resource": "hr", "action": "attendance.clockout", "dataScope": "all"},
        {"resource": "hr", "action": "leave.request", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'hr_management'),
    'full',
    3,
    'Full Access',
    'Complete HR operations',
    '[
        {"resource": "hr", "action": "read", "dataScope": "all"},
        {"resource": "hr", "action": "attendance.clockin", "dataScope": "all"},
        {"resource": "hr", "action": "attendance.clockout", "dataScope": "all"},
        {"resource": "hr", "action": "leave.request", "dataScope": "all"},
        {"resource": "hr", "action": "leave.approve", "dataScope": "all"},
        {"resource": "hr", "action": "shift.manage", "dataScope": "all"},
        {"resource": "hr", "action": "shift.assign", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'hr_management'),
    'admin',
    4,
    'Admin',
    'Full HR administration including performance management',
    '[
        {"resource": "hr", "action": "read", "dataScope": "all"},
        {"resource": "hr", "action": "attendance.clockin", "dataScope": "all"},
        {"resource": "hr", "action": "attendance.clockout", "dataScope": "all"},
        {"resource": "hr", "action": "leave.request", "dataScope": "all"},
        {"resource": "hr", "action": "leave.approve", "dataScope": "all"},
        {"resource": "hr", "action": "shift.manage", "dataScope": "all"},
        {"resource": "hr", "action": "shift.assign", "dataScope": "all"},
        {"resource": "hr", "action": "performance.manage", "dataScope": "all"}
    ]'::jsonb
);

-- =====================================================
-- FINANCIAL MANAGEMENT ACCESS LEVELS
-- =====================================================
INSERT INTO access_level (feature_group_id, level_name, level_order, display_name, description, permissions) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'financial_management'),
    'none',
    0,
    'No Access',
    'Cannot access financial features',
    '[]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'financial_management'),
    'view',
    1,
    'View Only',
    'Can view financial information',
    '[
        {"resource": "store", "action": "read", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'financial_management'),
    'edit',
    2,
    'Edit',
    'Can manage cash and payments',
    '[
        {"resource": "store", "action": "read", "dataScope": "all"},
        {"resource": "store", "action": "adjust", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'financial_management'),
    'full',
    3,
    'Full Access',
    'Complete financial management',
    '[
        {"resource": "store", "action": "read", "dataScope": "all"},
        {"resource": "store", "action": "adjust", "dataScope": "all"},
        {"resource": "payments", "action": "read", "dataScope": "all"},
        {"resource": "payments", "action": "add", "dataScope": "all"}
    ]'::jsonb
);

-- =====================================================
-- REPORTS & ANALYTICS ACCESS LEVELS
-- =====================================================
INSERT INTO access_level (feature_group_id, level_name, level_order, display_name, description, permissions) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'reports_analytics'),
    'none',
    0,
    'No Access',
    'Cannot access reports',
    '[]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'reports_analytics'),
    'view',
    1,
    'View Reports',
    'Can view and generate reports',
    '[
        {"resource": "reports", "action": "read", "dataScope": "all"},
        {"resource": "reports", "action": "generate", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'reports_analytics'),
    'full',
    2,
    'Full Access',
    'Can view, generate, and export reports',
    '[
        {"resource": "reports", "action": "read", "dataScope": "all"},
        {"resource": "reports", "action": "generate", "dataScope": "all"},
        {"resource": "reports", "action": "export", "dataScope": "all"}
    ]'::jsonb
);

-- =====================================================
-- SYSTEM ADMINISTRATION ACCESS LEVELS
-- =====================================================
INSERT INTO access_level (feature_group_id, level_name, level_order, display_name, description, permissions) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'system_administration'),
    'none',
    0,
    'No Access',
    'Cannot access system settings',
    '[]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'system_administration'),
    'view',
    1,
    'View Only',
    'Can view system settings',
    '[
        {"resource": "settings", "action": "read", "dataScope": "all"},
        {"resource": "users", "action": "read", "dataScope": "all"},
        {"resource": "roles", "action": "read", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'system_administration'),
    'edit',
    2,
    'Edit',
    'Can manage users',
    '[
        {"resource": "settings", "action": "read", "dataScope": "all"},
        {"resource": "settings", "action": "view", "dataScope": "all"},
        {"resource": "users", "action": "read", "dataScope": "all"},
        {"resource": "users", "action": "add", "dataScope": "all"},
        {"resource": "users", "action": "edit", "dataScope": "all"},
        {"resource": "roles", "action": "read", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'system_administration'),
    'admin',
    3,
    'Full Admin',
    'Complete system administration including roles',
    '[
        {"resource": "settings", "action": "read", "dataScope": "all"},
        {"resource": "settings", "action": "view", "dataScope": "all"},
        {"resource": "settings", "action": "add", "dataScope": "all"},
        {"resource": "users", "action": "read", "dataScope": "all"},
        {"resource": "users", "action": "add", "dataScope": "all"},
        {"resource": "users", "action": "edit", "dataScope": "all"},
        {"resource": "users", "action": "delete", "dataScope": "all"},
        {"resource": "roles", "action": "read", "dataScope": "all"},
        {"resource": "roles", "action": "add", "dataScope": "all"},
        {"resource": "roles", "action": "edit", "dataScope": "all"},
        {"resource": "roles", "action": "delete", "dataScope": "all"}
    ]'::jsonb
);

-- =====================================================
-- CREATE PAYROLL FEATURE GROUP (was missing)
-- =====================================================
INSERT INTO feature_group (name, display_name, description, category, icon, sort_order) VALUES
('payroll_management', 'Payroll Management', 'Payroll processing, salary structures, and KPI-based calculations', 'administrative', 'bi-cash-stack', 9);

-- =====================================================
-- PAYROLL MANAGEMENT ACCESS LEVELS
-- =====================================================
INSERT INTO access_level (feature_group_id, level_name, level_order, display_name, description, permissions) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'payroll_management'),
    'none',
    0,
    'No Access',
    'Cannot access payroll features',
    '[]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'payroll_management'),
    'view',
    1,
    'View Only',
    'Can view payroll information',
    '[
        {"resource": "payroll", "action": "read", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'payroll_management'),
    'edit',
    2,
    'Edit',
    'Can process payroll',
    '[
        {"resource": "payroll", "action": "read", "dataScope": "all"},
        {"resource": "payroll", "action": "calculate", "dataScope": "all"},
        {"resource": "payroll", "action": "run", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'payroll_management'),
    'admin',
    3,
    'Admin',
    'Full payroll administration including salary structures',
    '[
        {"resource": "payroll", "action": "read", "dataScope": "all"},
        {"resource": "payroll", "action": "calculate", "dataScope": "all"},
        {"resource": "payroll", "action": "run", "dataScope": "all"},
        {"resource": "payroll", "action": "approve", "dataScope": "all"},
        {"resource": "payroll", "action": "manage-structures", "dataScope": "all"}
    ]'::jsonb
);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- All feature groups now have complete access level definitions
