-- Migration 012: Feature Groups with Access Levels
-- Simplifies permission management by grouping related features with intuitive access level dropdowns

-- =====================================================
-- 1. CREATE FEATURE_GROUP TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS feature_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- 'core', 'operational', 'administrative'
    icon VARCHAR(50), -- Icon class name for UI
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE feature_group IS 'Groups of related features (e.g., Sales, Inventory, HR)';
COMMENT ON COLUMN feature_group.name IS 'Unique identifier (e.g., sales_management)';
COMMENT ON COLUMN feature_group.display_name IS 'Display name for UI (e.g., Sales Management)';
COMMENT ON COLUMN feature_group.category IS 'Grouping category for organizing features';

-- =====================================================
-- 2. CREATE ACCESS_LEVEL TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS access_level (
    id SERIAL PRIMARY KEY,
    feature_group_id INTEGER NOT NULL REFERENCES feature_group(id) ON DELETE CASCADE,
    level_name VARCHAR(50) NOT NULL, -- 'none', 'view', 'edit', 'full', 'admin'
    level_order INTEGER NOT NULL, -- 0=none, 1=view, 2=edit, 3=full, 4=admin
    display_name VARCHAR(50) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL, -- Array of permission objects to grant
    active BOOLEAN DEFAULT true,
    UNIQUE(feature_group_id, level_name),
    UNIQUE(feature_group_id, level_order)
);

COMMENT ON TABLE access_level IS 'Access level definitions for each feature group';
COMMENT ON COLUMN access_level.level_order IS 'Order determines hierarchy (higher includes all lower permissions)';
COMMENT ON COLUMN access_level.permissions IS 'JSON array of {resource, action, dataScope} permissions';

CREATE INDEX idx_access_level_feature_group ON access_level(feature_group_id);
CREATE INDEX idx_access_level_order ON access_level(feature_group_id, level_order);

-- =====================================================
-- 3. CREATE SUB_FEATURE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sub_feature (
    id SERIAL PRIMARY KEY,
    feature_group_id INTEGER NOT NULL REFERENCES feature_group(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    UNIQUE(feature_group_id, name)
);

COMMENT ON TABLE sub_feature IS 'Sub-features within a feature group for granular control';

CREATE INDEX idx_sub_feature_group ON sub_feature(feature_group_id);

-- =====================================================
-- 4. CREATE SUB_FEATURE_ACCESS_LEVEL TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sub_feature_access_level (
    id SERIAL PRIMARY KEY,
    sub_feature_id INTEGER NOT NULL REFERENCES sub_feature(id) ON DELETE CASCADE,
    level_name VARCHAR(50) NOT NULL,
    level_order INTEGER NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    permissions JSONB NOT NULL,
    active BOOLEAN DEFAULT true,
    UNIQUE(sub_feature_id, level_name)
);

COMMENT ON TABLE sub_feature_access_level IS 'Access levels for sub-features';

CREATE INDEX idx_sub_feature_access_level ON sub_feature_access_level(sub_feature_id);

-- =====================================================
-- 5. CREATE ROLE_FEATURE_ASSIGNMENT TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS role_feature_assignment (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES app_role(id) ON DELETE CASCADE,
    feature_group_id INTEGER NOT NULL REFERENCES feature_group(id) ON DELETE CASCADE,
    access_level_id INTEGER REFERENCES access_level(id) ON DELETE SET NULL,
    data_scope VARCHAR(20) DEFAULT 'all', -- 'all', 'team', 'own'
    options JSONB DEFAULT '{}', -- Additional toggles like {viewCost: true, allowVoid: false}
    active BOOLEAN DEFAULT true,
    assigned_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES app_user(id),
    UNIQUE(role_id, feature_group_id)
);

COMMENT ON TABLE role_feature_assignment IS 'Links roles to feature groups with selected access levels';
COMMENT ON COLUMN role_feature_assignment.data_scope IS 'Controls data visibility: all/team/own';
COMMENT ON COLUMN role_feature_assignment.options IS 'Additional feature-specific options';

CREATE INDEX idx_role_feature_role ON role_feature_assignment(role_id);
CREATE INDEX idx_role_feature_group ON role_feature_assignment(feature_group_id);

-- =====================================================
-- 6. CREATE ROLE_SUB_FEATURE_ASSIGNMENT TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS role_sub_feature_assignment (
    id SERIAL PRIMARY KEY,
    role_feature_assignment_id INTEGER NOT NULL REFERENCES role_feature_assignment(id) ON DELETE CASCADE,
    sub_feature_id INTEGER NOT NULL REFERENCES sub_feature(id) ON DELETE CASCADE,
    access_level_id INTEGER REFERENCES sub_feature_access_level(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    UNIQUE(role_feature_assignment_id, sub_feature_id)
);

COMMENT ON TABLE role_sub_feature_assignment IS 'Links role feature assignments to specific sub-features';

CREATE INDEX idx_role_sub_feature_assignment ON role_sub_feature_assignment(role_feature_assignment_id);

-- =====================================================
-- 7. ADD MIGRATION FLAG TO APP_ROLE
-- =====================================================
ALTER TABLE app_role
ADD COLUMN IF NOT EXISTS uses_feature_groups BOOLEAN DEFAULT false;

COMMENT ON COLUMN app_role.uses_feature_groups IS 'True if role uses feature groups, false if using legacy permissions JSON';

-- =====================================================
-- 8. SEED FEATURE GROUPS
-- =====================================================

-- Sales Management Feature Group
INSERT INTO feature_group (name, display_name, description, category, icon, sort_order) VALUES
('sales_management', 'Sales Management', 'Point of sale, orders, returns, and customer intent', 'core', 'bi-cart', 1),
('inventory_management', 'Inventory Management', 'Stock control, movements, and clearance', 'core', 'bi-box', 2),
('purchase_management', 'Purchase Management', 'Purchase requests, orders, invoices, and vendors', 'operational', 'bi-bag', 3),
('customer_management', 'Customer Management', 'Customer records and credit accounts', 'operational', 'bi-people', 4),
('hr_management', 'HR Management', 'Attendance, leave, shifts, and performance', 'administrative', 'bi-person-badge', 5),
('financial_management', 'Financial Management', 'Cash accounts, payments, and reconciliation', 'administrative', 'bi-cash-coin', 6),
('reports_analytics', 'Reports & Analytics', 'Business reports and data exports', 'administrative', 'bi-graph-up', 7),
('system_administration', 'System Administration', 'Users, roles, settings, and business configuration', 'administrative', 'bi-gear', 8);

-- =====================================================
-- 9. SEED ACCESS LEVELS FOR SALES MANAGEMENT
-- =====================================================
INSERT INTO access_level (feature_group_id, level_name, level_order, display_name, description, permissions) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'sales_management'),
    'none',
    0,
    'No Access',
    'Cannot access sales features',
    '[]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'sales_management'),
    'view',
    1,
    'View Only',
    'Can view sales and returns',
    '[
        {"resource": "sales", "action": "read", "dataScope": "all"},
        {"resource": "salereturn", "action": "read", "dataScope": "all"},
        {"resource": "intent", "action": "read", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'sales_management'),
    'edit',
    2,
    'Edit',
    'Can create and edit sales',
    '[
        {"resource": "sales", "action": "read", "dataScope": "all"},
        {"resource": "sales", "action": "add", "dataScope": "all"},
        {"resource": "sales", "action": "edit", "dataScope": "all"},
        {"resource": "salereturn", "action": "read", "dataScope": "all"},
        {"resource": "salereturn", "action": "add", "dataScope": "all"},
        {"resource": "intent", "action": "read", "dataScope": "all"},
        {"resource": "intent", "action": "add", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'sales_management'),
    'full',
    3,
    'Full Access',
    'Complete sales operations including void and discounts',
    '[
        {"resource": "sales", "action": "read", "dataScope": "all"},
        {"resource": "sales", "action": "add", "dataScope": "all"},
        {"resource": "sales", "action": "edit", "dataScope": "all"},
        {"resource": "sales", "action": "delete", "dataScope": "all"},
        {"resource": "salereturn", "action": "read", "dataScope": "all"},
        {"resource": "salereturn", "action": "add", "dataScope": "all"},
        {"resource": "salereturn", "action": "edit", "dataScope": "all"},
        {"resource": "salereturn", "action": "delete", "dataScope": "all"},
        {"resource": "intent", "action": "read", "dataScope": "all"},
        {"resource": "intent", "action": "add", "dataScope": "all"},
        {"resource": "intent", "action": "edit", "dataScope": "all"},
        {"resource": "intent", "action": "delete", "dataScope": "all"}
    ]'::jsonb
);

-- =====================================================
-- 10. SEED ACCESS LEVELS FOR INVENTORY MANAGEMENT
-- =====================================================
INSERT INTO access_level (feature_group_id, level_name, level_order, display_name, description, permissions) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'inventory_management'),
    'none',
    0,
    'No Access',
    'Cannot access inventory features',
    '[]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'inventory_management'),
    'view',
    1,
    'View Only',
    'Can view stock levels (no cost)',
    '[
        {"resource": "stock", "action": "read", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'inventory_management'),
    'edit',
    2,
    'Edit',
    'Can adjust stock and view movements',
    '[
        {"resource": "stock", "action": "read", "dataScope": "all"},
        {"resource": "stock", "action": "edit", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM feature_group WHERE name = 'inventory_management'),
    'full',
    3,
    'Full Access',
    'Complete inventory control including clearance',
    '[
        {"resource": "stock", "action": "read", "dataScope": "all"},
        {"resource": "stock", "action": "add", "dataScope": "all"},
        {"resource": "stock", "action": "edit", "dataScope": "all"},
        {"resource": "stock", "action": "delete", "dataScope": "all"}
    ]'::jsonb
);

-- =====================================================
-- 11. SEED SUB-FEATURES FOR HR MANAGEMENT
-- =====================================================
INSERT INTO sub_feature (feature_group_id, name, display_name, description, sort_order) VALUES
(
    (SELECT id FROM feature_group WHERE name = 'hr_management'),
    'attendance',
    'Attendance',
    'Clock in/out and attendance records',
    1
),
(
    (SELECT id FROM feature_group WHERE name = 'hr_management'),
    'leave',
    'Leave Management',
    'Leave requests and approvals',
    2
),
(
    (SELECT id FROM feature_group WHERE name = 'hr_management'),
    'shifts',
    'Shift Management',
    'Shift scheduling and assignments',
    3
),
(
    (SELECT id FROM feature_group WHERE name = 'hr_management'),
    'performance',
    'Performance',
    'KPI scores and reviews',
    4
);

-- =====================================================
-- 12. SEED SUB-FEATURE ACCESS LEVELS FOR HR ATTENDANCE
-- =====================================================
INSERT INTO sub_feature_access_level (sub_feature_id, level_name, level_order, display_name, permissions) VALUES
(
    (SELECT id FROM sub_feature WHERE name = 'attendance' AND feature_group_id = (SELECT id FROM feature_group WHERE name = 'hr_management')),
    'view',
    1,
    'View Only',
    '[{"resource": "attendance", "action": "read", "dataScope": "all"}]'::jsonb
),
(
    (SELECT id FROM sub_feature WHERE name = 'attendance' AND feature_group_id = (SELECT id FROM feature_group WHERE name = 'hr_management')),
    'edit',
    2,
    'Edit',
    '[
        {"resource": "attendance", "action": "read", "dataScope": "all"},
        {"resource": "attendance", "action": "add", "dataScope": "all"},
        {"resource": "attendance", "action": "edit", "dataScope": "all"}
    ]'::jsonb
),
(
    (SELECT id FROM sub_feature WHERE name = 'attendance' AND feature_group_id = (SELECT id FROM feature_group WHERE name = 'hr_management')),
    'full',
    3,
    'Full Access',
    '[
        {"resource": "attendance", "action": "read", "dataScope": "all"},
        {"resource": "attendance", "action": "add", "dataScope": "all"},
        {"resource": "attendance", "action": "edit", "dataScope": "all"},
        {"resource": "attendance", "action": "delete", "dataScope": "all"}
    ]'::jsonb
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_group TO rgpapp;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_level TO rgpapp;
GRANT SELECT, INSERT, UPDATE, DELETE ON sub_feature TO rgpapp;
GRANT SELECT, INSERT, UPDATE, DELETE ON sub_feature_access_level TO rgpapp;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_feature_assignment TO rgpapp;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_sub_feature_assignment TO rgpapp;

GRANT USAGE, SELECT ON SEQUENCE feature_group_id_seq TO rgpapp;
GRANT USAGE, SELECT ON SEQUENCE access_level_id_seq TO rgpapp;
GRANT USAGE, SELECT ON SEQUENCE sub_feature_id_seq TO rgpapp;
GRANT USAGE, SELECT ON SEQUENCE sub_feature_access_level_id_seq TO rgpapp;
GRANT USAGE, SELECT ON SEQUENCE role_feature_assignment_id_seq TO rgpapp;
GRANT USAGE, SELECT ON SEQUENCE role_sub_feature_assignment_id_seq TO rgpapp;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Feature groups tables created and seeded with initial data
-- Existing roles continue to use legacy permissions JSON (uses_feature_groups = false)
-- New roles can use feature groups (uses_feature_groups = true)
