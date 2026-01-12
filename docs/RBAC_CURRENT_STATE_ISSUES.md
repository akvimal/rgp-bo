# RBAC Current State - Issues & Gaps Analysis

**Date:** 2026-01-11
**Status:** Analysis Complete

---

## Current RBAC Implementation Issues

### 🔴 CRITICAL ISSUES

#### 1. No Backend RBAC Enforcement
**Problem:** All 16 backend modules have JWT authentication but NO role-based authorization

**Impact:**
- Any authenticated user can call any endpoint
- Frontend guards can be bypassed via direct API calls
- Security vulnerability - relies only on frontend security

**Example:**
```typescript
// Current: Only JWT check
@UseGuards(AuthGuard)
@Post('/products')
createProduct(@Body() dto: CreateProductDto) { ... }

// Should be: JWT + RBAC check
@UseGuards(AuthGuard, RbacGuard)
@RequirePermission('inventory.create')
@Post('/products')
createProduct(@Body() dto: CreateProductDto) { ... }
```

**Affected Modules:** All 16 (Customers, Products, Vendors, Purchases, Sales, etc.)

---

#### 2. Inconsistent Frontend Permission Guards
**Problem:** Some routes use `*isAuth`, others use `*isNavAuth`, many have no guards

**Navigation Menu Analysis:**

| Menu Item | Permission Check | Issue |
|-----------|-----------------|-------|
| Dashboard | `*isNavAuth` | ⚠️ Generic - no specific permission |
| Sales | `*isNavAuth` | ⚠️ Generic - no specific permission |
| Store | `*isAuth="'store.read'"` | ✅ Specific permission |
| Purchase | `*isAuth="'purchases.read'"` | ✅ Specific permission |
| Products | `*isNavAuth` | ⚠️ Generic - no specific permission |
| Customers | `*isAuth="'customers.read'"` | ✅ Specific permission |
| Reports | No guard | 🔴 **CRITICAL - No check** |
| Settings | `*isAuth="'settings.read'"` | ✅ Specific permission |
| HR Dashboard | No guard | 🔴 **CRITICAL - No check** |
| Attendance | No guard | 🔴 **CRITICAL - No check** |
| Leave Requests | No guard | 🔴 **CRITICAL - No check** |
| Shift Management | No guard | 🔴 **CRITICAL - No check** |
| Shift Assignments | No guard | 🔴 **CRITICAL - No check** |
| Payroll | No guard | 🔴 **CRITICAL - No check** |
| Salary Structures | No guard | 🔴 **CRITICAL - No check** |

**Impact:**
- HR and Payroll modules accessible to ALL authenticated users
- Reports module has no access control
- Inconsistent user experience

---

#### 3. Missing Role Definitions for New Modules
**Problem:** HR and Payroll modules have no role-based permissions defined

**Current Roles (from sql/init.sql):**
- Admin: Has `site`, `roles`, `users`, `products`, `purchases`, `store`, `customers`, `sales`, `settings`, `reports`
- Store Head: Similar to Admin
- Sales Staff: Has `site`, `stock`, `customers`, `sales`, `purchases` (limited)

**Missing Resources:**
- `hr` - Not defined in any role
- `payroll` - Not defined in any role
- `attendance` - Not defined in any role
- `leave` - Not defined in any role
- `shift` - Not defined in any role

**Impact:**
- No control over who can access HR/Payroll features
- All authenticated users can potentially access sensitive payroll data
- No differentiation between HR staff, managers, and regular employees

---

### ⚠️ HIGH PRIORITY ISSUES

#### 4. Unclear Cost Data Visibility
**Problem:** Inconsistent rules for showing cost/margin data to different roles

**Current Implementation:**
- Sales Staff: Can see stock with `ptrcost` property "hidden" (string, not enforced)
- Sales Staff: Can see purchases with `ptrvalue` "hidden" (string, not enforced)
- Store Head: Full cost visibility

**Issues:**
- "Hidden" properties are just strings in JSON, not enforced
- No backend validation of cost field visibility
- Pharmacists should have limited cost visibility (not defined)

**Sensitive Fields Lacking Protection:**
- `ptrcost` (purchase cost)
- `ptrvalue` (purchase value)
- `mrp` (maximum retail price)
- `margin_pcnt` (margin percentage)
- `base_price` (cost price)
- `sale_price` (selling price)
- `profit` (calculated profit)

---

#### 5. No Specialized Roles
**Problem:** Only 3 generic roles; missing specialized business roles

**Current:**
- Admin (1) - Everything
- Store Head (3) - Almost everything
- Sales Staff (2) - Limited sales

**Missing Roles:**
- **HR Manager** - For HR department staff
- **Accountant** - For financial operations
- **Pharmacist** - For licensed pharmacists (different from sales staff)
- **Owner/Director** - For business owners (separate from IT admin)

**Impact:**
- Can't properly assign HR staff (would need Admin access)
- Can't restrict financial data to accounting staff only
- Can't differentiate between licensed pharmacists and sales assistants
- IT admin and business owner have same permissions

---

#### 6. Overlapping Role Permissions
**Problem:** Admin and Store Head have nearly identical permissions

**Comparison:**

| Resource | Admin | Store Head | Difference |
|----------|-------|------------|------------|
| roles | Full | Full | None |
| users | Full | Full | None |
| products | Full | Full | None |
| purchases | Full | Full | None |
| store | Full | Full | None |
| customers | Full | Full | None |
| sales | Full | Full | None |
| settings | Full | Full | None |
| reports | Full | Full | None |

**Impact:**
- Store Head has too much access (can manage system users and roles)
- Unclear when to use Admin vs Store Head
- No clear separation of duties
- Audit trail confusion

---

### ⚠️ MEDIUM PRIORITY ISSUES

#### 7. Field-Level Permission Format Issues
**Problem:** Field permissions use array of property names, inconsistent enforcement

**Current Format:**
```json
{
  "action": "read",
  "properties": ["ptrcost"]  // What does this mean?
}
```

**Ambiguity:**
- Does `["ptrcost"]` mean "can ONLY see ptrcost"?
- Or does it mean "HIDE ptrcost"?
- Current implementation interprets it as "hide these fields"
- Not documented anywhere

**Better Format:**
```json
{
  "action": "read",
  "allowed_fields": ["*"],
  "denied_fields": ["ptrcost", "ptrvalue", "margin_pcnt"]
}
```

---

#### 8. Path-Based Permissions vs Resource-Based
**Problem:** Inconsistent use of path-based and resource-based permissions

**Current Approach:**
```json
{
  "resource": "sales",
  "path": ["/secure/sales/pos", "/secure/sales/list"],
  "policies": [
    {"action": "read"},
    {"action": "add", "path": "/new"}
  ]
}
```

**Issues:**
- Mixes URL paths (frontend) with resource actions (backend)
- Path changes require permission updates
- No clear mapping to backend endpoints
- `path` in resource AND `path` in policy (confusing)

**Better Approach:**
```json
{
  "domain": "sales_operations",
  "resources": ["sales", "customers", "sales_intent"],
  "actions": ["read", "create", "edit", "delete"],
  "data_scope": "all"  // or "own" for personal data only
}
```

---

#### 9. No Data Scoping
**Problem:** No concept of "own data" vs "all data"

**Examples Where Needed:**
- Sales Staff should see ALL sales (current: probably can)
- Employees should see ONLY own payslip (current: no restriction)
- Managers should see TEAM attendance (current: not defined)
- HR Manager should see ALL employee data (current: not defined)

**Current JSON:**
```json
{
  "resource": "sales",
  "data": "all",  // Only in some roles, not consistently used
  "policies": [...]
}
```

**Impact:**
- No way to enforce "personal data only" restrictions
- Payroll data potentially visible to all employees
- HR data potentially visible to non-HR staff

---

#### 10. Missing Permission Actions
**Problem:** Limited set of actions defined

**Current Actions:**
- `read`, `add`, `edit`, `delete` - Basic CRUD
- Some special: `adjust`, `price`, `vendors.edit`

**Missing Actions:**
- `approve` - For purchase orders, leave requests, payroll
- `close` - For invoices, financial periods
- `export` - For report downloads
- `reconcile` - For tax credit, payments
- `calculate` - For payroll, pricing
- `view_cost` - For cost/margin visibility
- `view_team` - For manager access to team data
- `manage_cash` - For cash account operations

---

### 🟡 LOW PRIORITY ISSUES

#### 11. No Permission Inheritance
**Problem:** Can't define role hierarchies or inherit permissions

**Desired Hierarchy:**
```
Owner/Director (all permissions)
  ↓ inherits all
Store Manager (all operations)
  ↓ inherits sales, inventory
Pharmacist (sales + limited inventory)
  ↓ inherits sales only
Pharmacy Assistant (basic sales)
```

**Impact:**
- Permission duplication across similar roles
- Hard to maintain consistency
- Can't easily create "junior" and "senior" variants

---

#### 12. No Conditional Permissions
**Problem:** Can't define context-based permissions

**Examples Needed:**
- Sales Staff can EDIT sales they created themselves
- Sales Staff can DELETE sales only if status = 'draft'
- Store Manager can APPROVE leave for direct reports only
- Pharmacist can RETURN items only within 7 days

**Current:** All-or-nothing permission model

---

#### 13. No Audit Logging of Permission Checks
**Problem:** No visibility into who accessed what

**Missing:**
- Log of all permission denials
- Log of sensitive data access (costs, payroll)
- Audit trail for compliance

---

#### 14. No Permission Testing Tools
**Problem:** Hard to test if permissions work correctly

**Missing:**
- Permission simulator (test as different roles)
- Permission coverage report (which endpoints are protected)
- Role comparison tool (diff two roles)

---

## Summary Statistics

### Permission Coverage

| Area | Total Items | Protected | Unprotected | % Protected |
|------|-------------|-----------|-------------|-------------|
| Backend Endpoints | ~200 | 0 | ~200 | 0% |
| Frontend Routes | ~50 | ~20 | ~30 | 40% |
| Menu Items | 17 | 6 | 11 | 35% |
| Modules | 16 | 0 | 16 | 0% |

### Issues by Severity

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 Critical | 3 | No backend RBAC, Missing HR/Payroll permissions, No guards on new modules |
| ⚠️ High | 3 | Cost visibility, Missing specialized roles, Role overlap |
| ⚠️ Medium | 4 | Field permissions, Path-based confusion, No data scoping, Missing actions |
| 🟡 Low | 4 | No inheritance, No conditional, No audit, No testing tools |
| **Total** | **14** | |

---

## Impact Assessment

### Security Risk: 🔴 HIGH
- Backend endpoints unprotected (can bypass frontend)
- HR/Payroll data accessible to all users
- Cost data potentially visible to unauthorized users

### Compliance Risk: ⚠️ MEDIUM
- No audit trail for sensitive data access
- Can't enforce separation of duties
- Hard to prove least-privilege access

### Operational Risk: ⚠️ MEDIUM
- Can't assign specialized roles (HR, Accountant)
- Users have too much or too little access
- Confusion about role responsibilities

### Maintenance Risk: 🟡 LOW-MEDIUM
- Inconsistent permission patterns hard to maintain
- No testing tools make changes risky
- Role overlap causes confusion

---

## Recommended Immediate Actions

### Week 1: Quick Wins (2-3 days)
1. ✅ Add `*isAuth` guards to HR and Payroll navigation items
2. ✅ Add `*isAuth` guard to Reports navigation
3. ✅ Add HR and Payroll resources to Admin role permissions
4. ✅ Document current permission structure

### Week 2: Backend Security (5 days)
1. ✅ Implement RBAC decorators and guards
2. ✅ Protect all backend endpoints
3. ✅ Add permission checking to critical endpoints first
   - Payroll (highest risk)
   - HR (high risk)
   - Purchase costs (medium risk)

### Weeks 3-4: Role Definitions (5-7 days)
1. ✅ Create migration for 7-role structure
2. ✅ Define domain-based permissions
3. ✅ Test with sample users
4. ✅ Update documentation

### Weeks 5-6: Frontend Updates (5-7 days)
1. ✅ Update all navigation guards
2. ✅ Implement field-level permission checking
3. ✅ Hide cost fields based on role
4. ✅ Test all modules with each role

---

## Related Documents

- **RBAC_DOMAIN_ANALYSIS.md** - Detailed analysis and proposed solution
- **RBAC_QUICK_REFERENCE.md** - Quick reference guide
- **CLAUDE.md** - Project context (needs updating post-RBAC)

---

**Status:** ✅ ANALYSIS COMPLETE
**Next Step:** Review with stakeholders and approve implementation plan
**Priority:** 🔴 HIGH - Security and compliance gaps identified
**Estimated Effort:** 3-4 weeks full-time development

**Date:** 2026-01-11
