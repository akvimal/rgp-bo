# RBAC Domain Organization - Quick Reference

**Date:** 2026-01-11
**Related:** RBAC_DOMAIN_ANALYSIS.md

---

## Current State Summary

### Existing Roles (3)
1. **Admin** - Full system access
2. **Sales Staff** - Limited sales and customer operations
3. **Store Head** - Almost full access (store management focus)

### Issues
- ❌ Inconsistent permission enforcement (frontend vs backend)
- ❌ No HR/Payroll role definitions
- ❌ Missing specialized roles (Accountant, HR Manager)
- ❌ Backend endpoints lack RBAC guards
- ❌ Unclear cost data visibility rules

---

## Proposed 7 Domain Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    RGP BACK OFFICE SYSTEM                   │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴──────────────┐
                │                            │
        ┌───────▼────────┐          ┌───────▼────────┐
        │   OPERATIONS   │          │  ADMINISTRATION │
        └───────┬────────┘          └───────┬────────┘
                │                            │
    ┌───────────┼───────────┐               │
    │           │           │               │
┌───▼───┐  ┌───▼───┐  ┌───▼────┐      ┌───▼────┐
│Sales &│  │Procure│  │Inventory│     │Finance │
│Customer│  │ -ment │  │        │     │        │
└───────┘  └───────┘  └────────┘      └────────┘
                                           │
                            ┌──────────────┼──────────────┐
                            │              │              │
                       ┌────▼────┐    ┌───▼───┐    ┌─────▼─────┐
                       │   HR    │    │Payroll│    │System     │
                       │         │    │       │    │Admin      │
                       └─────────┘    └───────┘    └───────────┘
```

---

## 7 Business Domains

### 1️⃣ Sales & Customer Management
**Resources:** `sales_operations`
- Sales (POS, orders, returns)
- Customers (CRUD, history)
- Sales Intent (customer requests)
- Returns processing

**Modules:** Sales, Customers, Sales Intent, Returns

### 2️⃣ Procurement & Vendor Management
**Resources:** `procurement`
- Purchase Orders (create, approve)
- Purchase Invoices (lifecycle management)
- Vendors (supplier management)
- Vendor Payments (payment tracking)

**Modules:** Purchases, Vendors, Purchase Requests

### 3️⃣ Inventory & Stock Management
**Resources:** `inventory`
- Stock (tracking, adjustments)
- Products (catalog, pricing)
- HSN Tax Codes (tax management)
- Pricing Rules (dynamic pricing)

**Modules:** Stock, Products, Pricing Calculator

### 4️⃣ Financial Management
**Resources:** `finance`
- Cash Account (deposits/withdrawals)
- GST Reports (compliance)
- Tax Credit (ITC reconciliation)
- Financial Exports (Excel/PDF)

**Modules:** Reports, Store Cash, Downloads

### 5️⃣ Human Resources
**Resources:** `human_resources`
- Attendance (clock in/out)
- Leave Management (requests, approvals)
- Shift Management (definitions, assignments)
- Performance Scoring

**Modules:** HR (all sub-modules)

### 6️⃣ Payroll Processing
**Resources:** `payroll`
- Payroll Runs (monthly processing)
- Salary Structures (component definitions)
- Payslips (employee payslips)
- Payment Requests (salary payments)

**Modules:** Payroll, Salary Structures

### 7️⃣ System Administration
**Resources:** `administration`
- User Management (CRUD)
- Role Management (permissions)
- System Settings
- File/Document Management

**Modules:** Users, Roles, Settings, Files, Documents

---

## Proposed 7 Roles

### 👤 Role 1: Pharmacy Assistant (Entry Level)
**Replaces:** Sales Staff

**Access:**
- ✅ Sales (create, read)
- ✅ Customers (read, view history)
- ✅ Inventory (read, no costs)
- ✅ HR (personal attendance/leave)
- ❌ Purchases, Reports, Settings, Payroll

**Use Case:** Front-line sales staff, POS operations

---

### 👨‍⚕️ Role 2: Pharmacist (Professional)
**New Role**

**Access:**
- ✅ Sales (full, including returns)
- ✅ Customers (full CRUD)
- ✅ Inventory (read + limited adjustments)
- ✅ Purchases (read only, for verification)
- ✅ HR (personal attendance/leave)
- ⚠️ Limited cost visibility
- ❌ Settings, Payroll

**Use Case:** Licensed pharmacists, professional consultations

---

### 👔 Role 3: Store Manager (Management)
**Replaces:** Store Head

**Access:**
- ✅ Sales (full)
- ✅ Customers (full)
- ✅ Inventory (full with costs)
- ✅ Purchases (full)
- ✅ Finance (cash, reports)
- ✅ HR (team management)
- ✅ Payroll (read only)
- ⚠️ Settings (read users, no edit)

**Use Case:** Store operations management, team leadership

---

### 👥 Role 4: HR Manager (HR Department)
**New Role**

**Access:**
- ✅ HR (full, organization-wide)
- ✅ Payroll (create, calculate, no approve)
- ✅ Administration (user management for HR)
- ⚠️ Reports (HR reports only)
- ❌ Sales, Store, Purchases, Products, Customers

**Use Case:** HR operations, employee management, payroll preparation

---

### 💼 Role 5: Accountant (Finance Department)
**New Role**

**Access:**
- ✅ Finance (full - GST, tax, reports)
- ✅ Purchases (payments, tax credit)
- ✅ Payroll (approve, process payments)
- ✅ Sales (read with full cost visibility)
- ✅ Inventory (read with full cost visibility)
- ⚠️ All with cost/margin data
- ❌ HR, Settings (except payroll)

**Use Case:** Financial reporting, GST compliance, payment processing

---

### 🔧 Role 6: System Administrator (IT/Admin)
**Replaces:** Admin (focused on IT)

**Access:**
- ✅ Administration (full)
- ✅ All other domains (read for troubleshooting)

**Use Case:** System configuration, user/role management, access control

---

### 👨‍💼 Role 7: Owner/Director (Business Owner)
**New Role**

**Access:**
- ✅ ALL DOMAINS (complete access)
- ✅ All cost/margin data
- ✅ All financial data
- ✅ All HR/payroll data

**Use Case:** Business oversight, strategic decisions, complete visibility

---

## Role Comparison Matrix

| Feature | Pharmacy Assistant | Pharmacist | Store Manager | HR Manager | Accountant | Sys Admin | Owner |
|---------|-------------------|------------|---------------|------------|------------|-----------|-------|
| **POS Sales** | ✅ Create | ✅ Full | ✅ Full | ❌ | ❌ | ✅ | ✅ |
| **Sales Returns** | ❌ | ✅ Limited | ✅ Full | ❌ | ❌ | ✅ | ✅ |
| **Customer Mgmt** | 👁️ Read | ✅ Full | ✅ Full | ❌ | 👁️ Read | ✅ | ✅ |
| **Stock View** | 👁️ No cost | 👁️ Limited | ✅ Full cost | ❌ | 👁️ Full cost | ✅ | ✅ |
| **Stock Adjust** | ❌ | ⚠️ Limited | ✅ Full | ❌ | ❌ | ✅ | ✅ |
| **Product Mgmt** | 👁️ Read | 👁️ Read | ✅ Full | ❌ | 👁️ Read | ✅ | ✅ |
| **Purchase Orders** | ❌ | 👁️ Read | ✅ Full | ❌ | ⚠️ Payments | ✅ | ✅ |
| **Vendor Mgmt** | ❌ | ❌ | ✅ Full | ❌ | ⚠️ Payments | ✅ | ✅ |
| **Cash Account** | ❌ | ❌ | ✅ Manage | ❌ | ✅ Manage | 👁️ Read | ✅ |
| **GST Reports** | ❌ | ❌ | 👁️ View | ❌ | ✅ Full | 👁️ Read | ✅ |
| **HR - Personal** | ✅ Own | ✅ Own | ✅ Own | ✅ Full | ✅ Own | ✅ | ✅ |
| **HR - Team** | ❌ | ❌ | ✅ Team | ✅ All | ❌ | 👁️ Read | ✅ |
| **HR - Approve Leave** | ❌ | ❌ | ✅ Team | ✅ All | ❌ | ❌ | ✅ |
| **Payroll - View Own** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Payroll - Create** | ❌ | ❌ | ❌ | ✅ Calculate | ❌ | ✅ | ✅ |
| **Payroll - Approve** | ❌ | ❌ | ❌ | ❌ | ✅ Approve | ✅ | ✅ |
| **User Mgmt** | ❌ | ❌ | 👁️ Read | ⚠️ HR only | ❌ | ✅ Full | ✅ |
| **Role Mgmt** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Full | ✅ |
| **Reports - Sales** | ❌ | ⚠️ Basic | ✅ Full | ❌ | ✅ Full | 👁️ Read | ✅ |
| **Reports - Financial** | ❌ | ❌ | ✅ View | ❌ | ✅ Full | 👁️ Read | ✅ |

**Legend:**
- ✅ Full access
- 👁️ Read only
- ⚠️ Partial/Conditional access
- ❌ No access

---

## Implementation Checklist

### Backend (API)
- [ ] Create RBAC decorator (`@RequirePermission`)
- [ ] Create RBAC guard
- [ ] Create permission service
- [ ] Apply decorators to all 200+ endpoints
- [ ] Test endpoint protection

### Database
- [ ] Create migration 034 for new role structure
- [ ] Define 7 roles with domain permissions
- [ ] Create rollback script
- [ ] Test migration on dev database

### Frontend
- [ ] Update navigation menu with new guards
- [ ] Replace generic `*isNavAuth` with specific `*isAuth`
- [ ] Update route guards per domain
- [ ] Add field-level permission checks
- [ ] Reorganize menu by domain

### Testing
- [ ] Create test users for each role
- [ ] Test CRUD operations per role
- [ ] Verify cost visibility restrictions
- [ ] Test edge cases (missing permissions)
- [ ] Performance test permission checks

### Documentation
- [ ] Implementation guide
- [ ] Permission reference
- [ ] Migration guide for existing users
- [ ] Update CLAUDE.md

---

## Migration Path for Existing Users

```
OLD ROLE              →  NEW ROLE(S)
════════════════════  →  ════════════════════════════════
Admin                 →  Owner/Director (default)
                         OR System Administrator (IT staff)

Store Head            →  Store Manager (default)

Sales Staff           →  Pharmacy Assistant (default)
                         OR Pharmacist (if licensed)
```

**Action Required:**
1. Review all existing "Admin" users
2. Assign Owner/Director to business owners
3. Assign System Administrator to IT staff
4. Identify licensed pharmacists in Sales Staff
5. Upgrade to Pharmacist role where applicable

---

## Quick Decision Guide

**Need to hire/assign a role? Use this guide:**

| Scenario | Recommended Role |
|----------|-----------------|
| Front desk sales person | Pharmacy Assistant |
| Licensed pharmacist on duty | Pharmacist |
| Store manager/supervisor | Store Manager |
| HR department staff | HR Manager |
| Accountant/bookkeeper | Accountant |
| IT support staff | System Administrator |
| Business owner/director | Owner/Director |

---

## Cost Visibility Matrix

| Role | Purchase Cost | Sale Cost | Profit Margin | Stock Value |
|------|--------------|-----------|---------------|-------------|
| Pharmacy Assistant | ❌ | ❌ | ❌ | ❌ |
| Pharmacist | ⚠️ Limited | ⚠️ Limited | ❌ | ⚠️ Limited |
| Store Manager | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| HR Manager | ❌ | ❌ | ❌ | ❌ |
| Accountant | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| System Admin | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| Owner/Director | ✅ Full | ✅ Full | ✅ Full | ✅ Full |

---

## Resource Naming Convention

**Current (inconsistent):**
- `store`, `purchases`, `customers`, `sales`, `settings`

**Proposed (domain-based):**
- `sales_operations` - Sales & Customer domain
- `procurement` - Procurement & Vendor domain
- `inventory` - Inventory & Stock domain
- `finance` - Financial Management domain
- `human_resources` - HR domain
- `payroll` - Payroll Processing domain
- `administration` - System Administration domain

---

## Next Steps

1. **Review** this analysis with stakeholders
2. **Approve** the 7-domain, 7-role structure
3. **Prioritize** domains for implementation
4. **Begin Phase 1** - RBAC infrastructure
5. **Deploy incrementally** - domain by domain

---

**Document Status:** ✅ READY FOR REVIEW
**Related Documents:**
- RBAC_DOMAIN_ANALYSIS.md (detailed analysis)
- CLAUDE.md (project context)

**Date:** 2026-01-11
