# RBAC Domain Analysis & Consolidation Proposal

**Date:** 2026-01-11
**Purpose:** Organize modules by functionality and domain for role-based access control
**Status:** Analysis Complete - Awaiting Implementation

---

## Executive Summary

The RGP Back Office system currently has **16 backend modules** and **11 frontend feature modules** with partial RBAC implementation. This analysis proposes organizing them into **7 core business domains** with clear role assignments and permissions.

### Current State Issues

1. **Inconsistent Permission Checking**: Some modules use `*isAuth` directives, others use `*isNavAuth`, some have no guards
2. **Missing Backend Guards**: Not all API endpoints have role-based authorization
3. **Fragmented Domains**: Related functionality spread across multiple modules
4. **Incomplete Coverage**: New modules (HR, Payroll) lack permission definitions
5. **Role Overlap**: Unclear boundaries between Admin, Store Head, and Sales Staff

---

## Current System Analysis

### Frontend Modules (11 Total)

| Module | Routes | Permission Guard | Status |
|--------|--------|------------------|--------|
| Dashboard | `/dashboard` | `*isNavAuth` | ✅ Active |
| Sales | `/sales/*` | `*isNavAuth` | ✅ Active |
| Store | `/store/*` | `*isAuth="'store.read'"` | ✅ Active |
| Purchases | `/purchases/*` | `*isAuth="'purchases.read'"` | ✅ Active |
| Products | `/products/*` | `*isNavAuth` | ⚠️ No guard |
| Customers | `/customers/*` | `*isAuth="'customers.read'"` | ✅ Active |
| Reports | `/reports/*` | None | ⚠️ No guard |
| Settings | `/settings/*` | `*isAuth="'settings.read'"` | ✅ Active |
| HR | `/hr/*` | None | ⚠️ No guard |
| Payroll | `/payroll/*` | None | ⚠️ No guard |
| Pricing | `/pricing/*` | None | ⚠️ No guard |

### Backend Modules (16 Total)

| Module | Endpoints | Auth Guard | RBAC |
|--------|-----------|------------|------|
| Customers | 12 | ✅ JWT | ❌ No |
| Products | 45+ | ✅ JWT | ❌ No |
| Vendors | 6 | ✅ JWT | ❌ No |
| Purchases | 40+ | ✅ JWT | ❌ No |
| Sales | 25+ | ✅ JWT | ❌ No |
| Sales Intent | 9 | ✅ JWT | ❌ No |
| Stock | 12 | ✅ JWT | ❌ No |
| Returns | 8 | ✅ JWT | ❌ No |
| Users | 5 | ✅ JWT | ❌ No |
| Roles | 5 | ✅ JWT | ❌ No |
| Reports | 10+ | ✅ JWT | ❌ No |
| Files | 2 | ✅ JWT | ❌ No |
| Documents | 4 | ✅ JWT | ❌ No |
| Lookup | Various | ✅ JWT | ❌ No |
| Downloads | 5 | ✅ JWT | ❌ No |
| Payroll | 10+ | ✅ JWT | ❌ No |

**Note:** All modules have JWT authentication but lack fine-grained role-based authorization checks.

### Current Roles (3 Total)

From `sql/init.sql`:

#### 1. Admin (ID: 1)
**Resources:**
- site, roles, users, products, purchases, store, customers, sales, settings, reports

**Key Permissions:**
- Full CRUD on users and roles
- All product operations
- All purchase operations
- Store management with cost visibility
- All sales operations
- Settings management
- Reports access

#### 2. Sales Staff (ID: 2)
**Resources:**
- site, stock, customers, sales, purchases

**Key Permissions:**
- Sales operations (read, add)
- Customer read access
- Stock read (with `ptrcost` property hidden)
- Limited purchase read (can see invoices but `ptrvalue` hidden)

**Restrictions:**
- No user/role management
- No product editing
- No store adjustments
- No settings access

#### 3. Store Head (ID: 3)
**Resources:**
- site, roles, users, products, purchases, store, customers, sales, settings, reports

**Key Permissions:**
- User and role management
- Product pricing and editing
- Full purchase operations (including vendors)
- Store cash and stock management (with cost visibility)
- All sales operations
- Settings access
- Reports access

**Restrictions:**
- Slightly less than Admin (subtle differences in permission details)

---

## Proposed Domain-Based Organization

### Domain 1: **SALES & CUSTOMER MANAGEMENT**

**Business Purpose:** Point of Sale, customer relationships, sales returns, delivery tracking

**Modules Included:**
- Sales (POS, orders, returns, deliveries)
- Customers (CRUD, documents, order history)
- Sales Intent (customer purchase requests)
- Returns (sales return processing)

**Frontend Routes:**
- `/sales/*` - POS and sales operations
- `/customers/*` - Customer management
- `/sales/intent` - Sales intent tracking
- `/sales/returns` - Return processing

**Backend Endpoints:**
- `/sales/*` - Sales API
- `/customers/*` - Customer API
- `/sales-intent/*` - Intent API
- `/returns/*` - Returns API

**Recommended Resource Name:** `sales_operations`

**Actions:**
- `read` - View sales, customers, intents
- `create` - Create new sales, customers, intents
- `edit` - Modify sales, customers
- `delete` - Delete sales, customers
- `process_return` - Handle sales returns
- `view_history` - Customer order history
- `view_cost` - See cost/margin data (restricted)

---

### Domain 2: **PROCUREMENT & VENDOR MANAGEMENT**

**Business Purpose:** Purchase orders, supplier management, invoice processing, payment tracking

**Modules Included:**
- Purchases (orders, invoices, tax credits)
- Vendors (supplier management, payments)
- Purchase Requests (internal procurement requests)

**Frontend Routes:**
- `/purchases/orders` - Purchase orders
- `/purchases/invoices` - Invoice management
- `/purchases/vendors` - Vendor management

**Backend Endpoints:**
- `/purchaseorders/*` - PO API
- `/purchases/*` - Invoice API
- `/vendors/*` - Vendor API

**Recommended Resource Name:** `procurement`

**Actions:**
- `read` - View POs, invoices, vendors
- `create` - Create POs, invoices
- `edit` - Modify POs, invoices, vendors
- `delete` - Delete POs, invoices
- `approve_po` - Approve purchase orders
- `close_invoice` - Close verified invoices
- `manage_payments` - Vendor payment tracking
- `manage_tax_credit` - ITC reconciliation
- `view_cost` - See purchase costs (restricted)

---

### Domain 3: **INVENTORY & STOCK MANAGEMENT**

**Business Purpose:** Stock tracking, adjustments, expiry management, demand forecasting

**Modules Included:**
- Stock (inventory tracking, adjustments)
- Products (catalog, pricing, HSN tax)
- Pricing Calculator (price analysis)

**Frontend Routes:**
- `/store/stock` - Inventory management
- `/products/master` - Product catalog
- `/products/price` - Price management
- `/products/hsn` - HSN tax codes
- `/pricing` - Price estimator

**Backend Endpoints:**
- `/stock/*` - Stock API
- `/products/*` - Product API (including HSN, pricing rules)

**Recommended Resource Name:** `inventory`

**Actions:**
- `read` - View stock, products
- `create` - Create products
- `edit` - Modify products, prices
- `delete` - Delete products
- `adjust_stock` - Stock adjustments (qty, price)
- `manage_pricing` - Pricing rules and strategies
- `manage_hsn` - HSN tax code management
- `view_cost` - See cost data (restricted)
- `view_margins` - See margin analysis

---

### Domain 4: **FINANCIAL MANAGEMENT**

**Business Purpose:** Cash tracking, GST reporting, tax compliance, financial reports

**Modules Included:**
- Store Cash Account
- Reports (GST, sales, purchase reports)
- Tax Credit Management
- Downloads (PDF/Excel exports)

**Frontend Routes:**
- `/store/cash` - Cash account management
- `/reports/gst` - GST reporting
- `/reports/*` - Various reports

**Backend Endpoints:**
- `/reports/*` - Reporting API
- `/downloads/*` - Export API

**Recommended Resource Name:** `finance`

**Actions:**
- `read` - View reports, cash account
- `manage_cash` - Cash deposits/withdrawals
- `view_gst_reports` - GST compliance reports
- `export_data` - Download Excel/PDF reports
- `reconcile_tax` - Tax credit reconciliation

---

### Domain 5: **HUMAN RESOURCES**

**Business Purpose:** Employee management, attendance, leave, shifts, performance

**Modules Included:**
- HR (attendance, leave, shifts, performance)
- User management (for employees)

**Frontend Routes:**
- `/hr/dashboard` - HR overview
- `/hr/attendance` - Clock in/out
- `/hr/leave` - Leave requests
- `/hr/shifts` - Shift management
- `/hr/shift-assignments` - User shift assignments

**Backend Endpoints:**
- `/hr/*` - HR API (attendance, leave, shifts, scoring, reports)
- `/users/*` - User API (for employee records)

**Recommended Resource Name:** `human_resources`

**Actions:**
- `read` - View attendance, leave, shifts
- `clock_in_out` - Personal attendance
- `request_leave` - Submit leave requests
- `approve_leave` - Approve/reject leave (managers)
- `manage_shifts` - Create/edit shifts
- `assign_shifts` - Assign employees to shifts
- `view_team` - See team attendance/leave
- `view_all` - See organization-wide data (HR admin)
- `manage_performance` - Performance scoring

---

### Domain 6: **PAYROLL PROCESSING**

**Business Purpose:** Salary calculations, payroll runs, payslips, payment requests

**Modules Included:**
- Payroll (payroll runs, calculations)
- Salary Structures (employee salary definitions)
- Employment Types & Roles
- KPI Scores (for performance incentives)

**Frontend Routes:**
- `/payroll` - Payroll runs
- `/payroll/create` - Create payroll
- `/payroll/:id/details` - Payroll details
- `/payroll/salary-structures` - Salary definitions

**Backend Endpoints:**
- `/payroll/*` - Payroll API

**Recommended Resource Name:** `payroll`

**Actions:**
- `read` - View payroll runs
- `view_own_payslip` - See personal payslip
- `create_payroll` - Create payroll run
- `calculate` - Calculate payroll
- `approve` - Approve payroll run
- `manage_salary_structures` - Define salary components
- `request_payment` - Create payment requests
- `process_payment` - Process payments
- `view_all_payslips` - See all employee payslips (payroll admin)

---

### Domain 7: **SYSTEM ADMINISTRATION**

**Business Purpose:** User management, role management, access control, system settings

**Modules Included:**
- Users (user CRUD)
- Roles (role & permission management)
- Settings (system configuration)
- Files (file upload/storage)
- Documents (document metadata)
- Lookup (reference data)

**Frontend Routes:**
- `/settings/users` - User management
- `/settings/roles` - Role management
- `/settings` - System settings

**Backend Endpoints:**
- `/users/*` - User API
- `/roles/*` - Role API
- `/files/*` - File upload API
- `/documents/*` - Document API
- `/lookup/*` - Lookup API

**Recommended Resource Name:** `administration`

**Actions:**
- `read` - View users, roles
- `create_user` - Create users
- `edit_user` - Modify users
- `delete_user` - Delete users
- `manage_roles` - Create/edit roles
- `manage_permissions` - Assign permissions
- `manage_settings` - System configuration
- `upload_files` - File management

---

## Proposed Role Structure

### Role 1: **Pharmacy Assistant** (Entry Level)
**Replaces:** Sales Staff (with clearer scope)

**Access Domains:**
1. **Sales & Customer Management** ✅
   - `read`, `create` (sales only)
   - `view_history` (customer orders)
   - ❌ No cost visibility
   - ❌ No returns without approval

2. **Inventory** (Read-Only)
   - `read` (products, stock)
   - ❌ No cost data
   - ❌ No adjustments

**Primary Use Cases:**
- Process sales at POS
- Look up customer information
- Check stock availability
- View product catalog

**Frontend Access:**
- ✅ Dashboard
- ✅ Sales (POS, create new sales)
- ✅ Customers (read-only)
- ✅ Store (stock view, no costs)
- ✅ Products (catalog view)
- ✅ HR (personal attendance/leave)
- ❌ Purchases
- ❌ Reports
- ❌ Settings
- ❌ Payroll

---

### Role 2: **Pharmacist** (Professional)
**New Role**

**Access Domains:**
1. **Sales & Customer Management** ✅
   - `read`, `create`, `edit`
   - `process_return` (with limits)
   - `view_history`
   - ⚠️ Limited cost visibility

2. **Inventory** ✅
   - `read`
   - `adjust_stock` (qty only, for returns)
   - ⚠️ Limited cost data

3. **Procurement** (Read-Only)
   - `read` (view POs and invoices)
   - ❌ No create/edit

**Primary Use Cases:**
- All sales operations including returns
- Customer management
- Stock verification and adjustments
- Review purchase invoices for verification
- Professional consultation

**Frontend Access:**
- ✅ Dashboard
- ✅ Sales (full access)
- ✅ Customers (full CRUD)
- ✅ Store (stock with limited costs)
- ✅ Products (catalog, no pricing)
- ✅ Purchases (view only)
- ✅ HR (personal attendance/leave)
- ⚠️ Reports (limited)
- ❌ Settings
- ❌ Payroll

---

### Role 3: **Store Manager** (Management)
**Replaces:** Store Head (with clearer scope)

**Access Domains:**
1. **Sales & Customer Management** ✅ (Full)
2. **Procurement** ✅ (Full)
3. **Inventory** ✅ (Full)
4. **Financial Management** ✅
   - `read`, `manage_cash`
   - `view_gst_reports`
   - `export_data`

5. **Human Resources** ✅
   - `read`, `view_team`
   - `approve_leave`
   - `assign_shifts`
   - `manage_performance`

6. **Payroll** (Limited)
   - `read` (view payroll runs)
   - ❌ No create/approve

7. **Administration** (Limited)
   - `read` (users)
   - ❌ No user/role creation

**Primary Use Cases:**
- Complete store operations
- Purchase order management
- Stock and cash management
- Team attendance and leave approval
- GST reporting and compliance
- Sales and inventory reports

**Frontend Access:**
- ✅ Dashboard
- ✅ Sales (full)
- ✅ Customers (full)
- ✅ Store (full with costs)
- ✅ Products (full)
- ✅ Purchases (full)
- ✅ Reports (all)
- ✅ HR (team management)
- ✅ Payroll (view only)
- ⚠️ Settings (read users, no edit)

---

### Role 4: **HR Manager** (HR Department)
**New Role**

**Access Domains:**
1. **Human Resources** ✅ (Full)
   - All HR operations
   - Organization-wide visibility

2. **Payroll Processing** ✅
   - `read`, `create_payroll`, `calculate`
   - ⚠️ No approve (requires Finance/Admin)
   - `manage_salary_structures`

3. **Administration** (Limited)
   - `read` (users)
   - `create_user`, `edit_user` (for HR purposes)

**Primary Use Cases:**
- Complete HR operations
- Payroll calculation and processing
- Employee records management
- Performance management
- Leave and attendance oversight

**Frontend Access:**
- ✅ Dashboard
- ✅ HR (full access)
- ✅ Payroll (create, calculate, no approve)
- ✅ Settings (user management only)
- ❌ Sales
- ❌ Store
- ❌ Purchases
- ❌ Products
- ❌ Customers
- ⚠️ Reports (HR reports only)

---

### Role 5: **Accountant** (Finance Department)
**New Role**

**Access Domains:**
1. **Financial Management** ✅ (Full)
   - All financial reporting
   - GST compliance
   - Tax reconciliation

2. **Procurement** (Read + Payment)
   - `read`
   - `manage_payments`
   - `manage_tax_credit`
   - ✅ Full cost visibility

3. **Sales & Customer Management** (Read-Only)
   - `read`
   - ✅ Full cost/margin visibility

4. **Inventory** (Read-Only)
   - `read`
   - ✅ Full cost visibility

5. **Payroll Processing** ✅
   - `read`, `approve`
   - `process_payment`
   - ✅ View all payslips

**Primary Use Cases:**
- GST filing and compliance
- Purchase invoice verification and payment
- Financial reports and exports
- Payroll approval and payment
- Tax credit reconciliation

**Frontend Access:**
- ✅ Dashboard
- ✅ Reports (full access)
- ✅ Purchases (payment focus)
- ✅ Payroll (approve and pay)
- ✅ Store (cash management)
- ⚠️ Sales (read with costs)
- ⚠️ Products (read with costs)
- ⚠️ Customers (read only)
- ❌ HR (except payroll)
- ❌ Settings

---

### Role 6: **System Administrator** (IT/Admin)
**Replaces:** Admin (with clearer IT focus)

**Access Domains:**
1. **Administration** ✅ (Full)
2. All other domains: Read access for troubleshooting

**Primary Use Cases:**
- User and role management
- System configuration
- Access control
- File and document management
- System troubleshooting

**Frontend Access:**
- ✅ All modules (full access)
- ✅ Settings (complete control)

---

### Role 7: **Owner/Director** (Business Owner)
**New Role**

**Access Domains:**
- **All Domains** ✅ (Complete access)
- ✅ All cost and margin data
- ✅ All financial data
- ✅ All HR and payroll data
- ✅ All reports and analytics

**Primary Use Cases:**
- Business oversight
- Strategic decision-making
- Complete visibility across all operations
- Audit and compliance review

**Frontend Access:**
- ✅ All modules (full access)

---

## Domain-Resource-Action Matrix

| Domain | Resource Name | Create | Read | Edit | Delete | Special Actions |
|--------|---------------|--------|------|------|--------|-----------------|
| Sales & Customer | `sales_operations` | ✅ | ✅ | ✅ | ✅ | process_return, view_history, view_cost |
| Procurement | `procurement` | ✅ | ✅ | ✅ | ✅ | approve_po, close_invoice, manage_payments, manage_tax_credit, view_cost |
| Inventory | `inventory` | ✅ | ✅ | ✅ | ✅ | adjust_stock, manage_pricing, manage_hsn, view_cost, view_margins |
| Finance | `finance` | ❌ | ✅ | ❌ | ❌ | manage_cash, view_gst_reports, export_data, reconcile_tax |
| HR | `human_resources` | ✅ | ✅ | ✅ | ✅ | clock_in_out, request_leave, approve_leave, manage_shifts, assign_shifts, view_team, view_all, manage_performance |
| Payroll | `payroll` | ✅ | ✅ | ✅ | ❌ | view_own_payslip, calculate, approve, manage_salary_structures, request_payment, process_payment, view_all_payslips |
| Administration | `administration` | ✅ | ✅ | ✅ | ✅ | manage_roles, manage_permissions, manage_settings, upload_files |

---

## Role-Domain Access Matrix

| Domain | Pharmacy Assistant | Pharmacist | Store Manager | HR Manager | Accountant | System Admin | Owner/Director |
|--------|-------------------|------------|---------------|------------|------------|--------------|----------------|
| **Sales & Customer** | Read, Create (sales only) | Full (limited cost) | Full | ❌ | Read (full cost) | Full | Full |
| **Procurement** | ❌ | Read only | Full | ❌ | Read + Payments | Full | Full |
| **Inventory** | Read (no cost) | Read + Adjust (limited cost) | Full | ❌ | Read (full cost) | Full | Full |
| **Finance** | ❌ | ❌ | Read + Cash | ❌ | Full | Read | Full |
| **HR** | Personal only | Personal only | Team management | Full | ❌ | Read | Full |
| **Payroll** | View own | View own | Read all | Create, Calculate | Approve, Pay | Full | Full |
| **Administration** | ❌ | ❌ | Read users | User mgmt (HR) | ❌ | Full | Full |

---

## Implementation Roadmap

### Phase 1: Backend RBAC Infrastructure (2-3 days)

**Tasks:**
1. Create RBAC decorator for NestJS controllers
   - `@RequirePermission('resource.action')`
   - `@RequireAnyPermission(['resource.action1', 'resource.action2'])`
   - `@RequireAllPermissions(['resource.action1', 'resource.action2'])`

2. Create RBAC guard for automatic permission checking
   - Extract user from JWT
   - Check permissions from database
   - Allow/deny based on decorator metadata

3. Create permission checking service
   - `hasPermission(user, resource, action): boolean`
   - `hasAnyPermission(user, permissions): boolean`
   - `hasAllPermissions(user, permissions): boolean`
   - `canAccessField(user, resource, field): boolean`

**Files to Create:**
- `api-v2/src/core/decorator/require-permission.decorator.ts`
- `api-v2/src/core/guards/rbac.guard.ts`
- `api-v2/src/core/services/permission.service.ts`

### Phase 2: Update Role Definitions (1 day)

**Tasks:**
1. Create migration script to update role permissions
2. Define 7 new roles with domain-based permissions
3. Map old roles to new roles (migration path)

**Files to Create:**
- `sql/migrations/034_rbac_domain_based_roles.sql`
- `sql/migrations/034_rollback.sql`

### Phase 3: Apply RBAC to Backend Endpoints (3-5 days)

**Tasks:**
1. Add `@RequirePermission()` decorators to all controllers
2. Organize by domain:
   - Sales & Customer: `/sales/*`, `/customers/*`, `/sales-intent/*`, `/returns/*`
   - Procurement: `/purchases/*`, `/purchaseorders/*`, `/vendors/*`
   - Inventory: `/stock/*`, `/products/*`
   - Finance: `/reports/*`, cash endpoints
   - HR: `/hr/*`
   - Payroll: `/payroll/*`
   - Administration: `/users/*`, `/roles/*`, `/settings/*`

**Estimated Controllers:** 25+ controllers, 200+ endpoints

### Phase 4: Update Frontend Navigation (1-2 days)

**Tasks:**
1. Update `secured.component.html` with new permission checks
2. Replace `*isNavAuth` with specific `*isAuth` directives
3. Organize menu by domain
4. Add sub-menus for domain sections

**Files to Update:**
- `frontend/src/app/secured/secured.component.html`
- `frontend/src/app/secured/secured.component.ts`

### Phase 5: Update Frontend Route Guards (2-3 days)

**Tasks:**
1. Add domain-based route guards
2. Update `auth.service.ts` with domain checking
3. Add field-level permission checks in components

**Files to Update:**
- `frontend/src/app/@core/auth/auth.service.ts`
- All route modules in `frontend/src/app/secured/*/`

### Phase 6: Testing & Validation (2-3 days)

**Tasks:**
1. Create test users for each role
2. Test all CRUD operations per role
3. Verify permission enforcement
4. Test edge cases (missing permissions, etc.)

**Files to Create:**
- `tests/rbac-validation.js`
- `tests/test-roles.sql` (test user data)

### Phase 7: Documentation (1 day)

**Tasks:**
1. Document new role structure
2. Create permission reference guide
3. Update CLAUDE.md with RBAC details

**Files to Create:**
- `docs/RBAC_IMPLEMENTATION_GUIDE.md`
- `docs/ROLE_PERMISSIONS_REFERENCE.md`

---

## Total Estimated Effort

- **Development**: 12-18 days
- **Testing**: 2-3 days
- **Documentation**: 1 day
- **Total**: 15-22 days (3-4 weeks)

---

## Migration Strategy

### For Existing Users

1. **Automatic Role Mapping:**
   - Admin → Owner/Director (with note to review)
   - Store Head → Store Manager
   - Sales Staff → Pharmacy Assistant

2. **Manual Review Required:**
   - Identify users who need specialized roles (HR Manager, Accountant)
   - Create new user accounts for new roles
   - Notify users of permission changes

### Backwards Compatibility

- Keep old role IDs (1, 2, 3) for Admin, Sales Staff, Store Head
- Add new role IDs (4-7) for new roles
- Run migration that updates permissions JSON
- Provide rollback script in case of issues

---

## Security Considerations

1. **Least Privilege Principle**: Each role has minimum necessary permissions
2. **Separation of Duties**: Financial operations separated from operational
3. **Audit Trail**: All permission checks should be logged
4. **Cost Data Protection**: Sensitive cost/margin data restricted to management
5. **Personal Data**: Employees can only view own payslips/attendance unless manager

---

## Benefits of Domain-Based RBAC

1. **Clear Boundaries**: Each domain has well-defined scope
2. **Scalability**: Easy to add new modules to existing domains
3. **Maintainability**: Permissions grouped logically by business function
4. **User-Friendly**: Roles match real job titles and responsibilities
5. **Compliance**: Better audit trail and access control
6. **Flexibility**: Fine-grained permissions within each domain
7. **Security**: Cost-sensitive data properly restricted

---

## Next Steps

1. **Review & Approve**: Stakeholder review of proposed structure
2. **Prioritize Domains**: Which domains to implement first?
3. **Create Test Plan**: Define test cases for each role
4. **Begin Phase 1**: Implement RBAC infrastructure
5. **Iterative Rollout**: Deploy domain by domain

---

## Appendix A: Current Permission JSON Structure

```json
{
  "resource": "sales_operations",
  "path": ["/secure/sales", "/secure/customers"],
  "data": "all",  // or "own" for personal data only
  "policies": [
    {
      "action": "read",
      "path": "",
      "properties": ["customer_name", "bill_amount"]
    },
    {
      "action": "create",
      "path": "/new",
      "properties": ["customer_id", "items", "payment"]
    },
    {
      "action": "view_cost",
      "path": "",
      "properties": ["cost_price", "margin"]
    }
  ]
}
```

## Appendix B: Proposed Permission JSON Structure (Enhanced)

```json
{
  "domain": "sales_operations",
  "resources": [
    {
      "name": "sales",
      "actions": ["read", "create", "edit", "delete"],
      "data_scope": "all",
      "cost_visibility": false,
      "conditions": {
        "edit": "created_by = current_user OR role IN ['Store Manager', 'Owner']",
        "delete": "status = 'draft' AND created_by = current_user"
      }
    },
    {
      "name": "customers",
      "actions": ["read", "create", "edit"],
      "data_scope": "all",
      "sensitive_fields": ["credit_limit", "balance"],
      "field_visibility": {
        "credit_limit": "role IN ['Store Manager', 'Owner', 'Accountant']"
      }
    }
  ]
}
```

---

**Document Status:** ✅ COMPLETE
**Next Action:** Review with stakeholders and approve implementation plan
**Author:** Claude Code
**Date:** 2026-01-11
