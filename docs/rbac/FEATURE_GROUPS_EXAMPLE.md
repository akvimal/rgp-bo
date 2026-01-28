# Feature Groups - Visual Examples

Real-world examples showing how feature groups simplify permission management.

---

## 🎯 The Problem We're Solving

### Current System (Complex)
Admin has to understand and configure:
```json
{
  "resource": "sales",
  "path": ["/secure/sales/pos", "/secure/sales/list", "/secure/sales/view"],
  "data": "all",
  "policies": [
    {"action": "read", "path": "", "properties": ["customer", "items", "total"]},
    {"action": "add", "path": "/new", "properties": ["customer", "items"]},
    {"action": "view", "path": "", "properties": ["bill_number", "date"]},
    {"action": "bill", "path": "/bill/print"},
    {"action": "edit", "path": "/edit", "properties": ["items"]},
    {"action": "delete"}
  ]
}
```

**Problems:**
- ❌ Too technical - requires JSON knowledge
- ❌ Error-prone - easy to make mistakes
- ❌ Time-consuming - takes 30+ minutes per role
- ❌ Not intuitive - hard to understand what access level this represents

### New System (Simple)
```
┌───────────────────────────────────────┐
│ Sales Management    [Full Access ▼]   │
│ ───────────────────────────────────   │
│ Data Scope:  ⦿ All  ○ Team  ○ Own    │
│ ☑ Include POS operations              │
│ ☑ Allow sales returns                 │
│ ☐ Allow void/cancel sales             │
└───────────────────────────────────────┘
```

**Benefits:**
- ✅ Visual and intuitive
- ✅ Takes 30 seconds to configure
- ✅ Clear understanding of permissions
- ✅ Automatically generates correct JSON

---

## 📋 Complete Feature Groups List

### 1️⃣ Sales Management
**What it controls:** Point-of-sale, orders, returns, customer interactions

**Access Levels:**
| Level | Name | What They Can Do |
|-------|------|------------------|
| 0 | None | No access to sales |
| 1 | View | View sales data, customer info (read-only) |
| 2 | Edit | Create sales, process orders, handle payments |
| 3 | Full | All sales operations + returns + reports |

**Options:**
- ☐ Include POS operations
- ☐ Allow sales returns
- ☐ Allow void/cancel sales
- ☐ Access to sales intent module

**Data Scope:**
- All Sales - See everyone's sales
- Team Sales - Only your team's sales
- Own Sales - Only your own sales

---

### 2️⃣ Inventory Management
**What it controls:** Products, stock, pricing, categories

**Access Levels:**
| Level | Name | What They Can Do |
|-------|------|------------------|
| 0 | None | No access to inventory |
| 1 | View | View products, stock levels (no costs) |
| 2 | Edit | Add/edit products, adjust stock |
| 3 | Full | Complete inventory control + cost management |

**Options:**
- ☐ View cost information (purchase price, margins)
- ☐ Allow negative stock
- ☐ Manage HSN codes and tax rates
- ☐ Access to product pricing

---

### 3️⃣ Purchase Management
**What it controls:** Purchase orders, invoices, vendor management

**Access Levels:**
| Level | Name | What They Can Do |
|-------|------|------------------|
| 0 | None | No access to purchases |
| 1 | View | View purchase orders, invoices |
| 2 | Edit | Create purchase orders, record receipts |
| 3 | Full | Complete purchase cycle + vendor management |

---

### 4️⃣ Customer Management
**What it controls:** Customer database, credit accounts, loyalty

**Access Levels:**
| Level | Name | What They Can Do |
|-------|------|------------------|
| 0 | None | No customer access |
| 1 | View | View customer list and details |
| 2 | Edit | Add/modify customer information |
| 3 | Full | Customer management + credit control |

**Data Scope:**
- All Customers
- Team Customers
- Own Customers

---

### 5️⃣ HR Management
**What it controls:** Attendance, leave, shifts, performance

**Access Levels:**
| Level | Name | What They Can Do |
|-------|------|------------------|
| 0 | None | No HR access |
| 1 | View | View own attendance, leave balance |
| 2 | Edit | Clock in/out, request leave |
| 3 | Full | Approve leave, manage shifts, view all |
| 4 | Admin | System config, payroll, sensitive data |

**Sub-features with Individual Levels:**
- Attendance: [Edit ▼] - Can clock in/out
- Leave: [Full ▼] - Can approve leave requests
- Shifts: [Full ▼] - Can manage schedules
- Performance: [View ▼] - View reviews only

---

### 6️⃣ Financial Management
**What it controls:** Cash, payments, expenses, reconciliation

**Access Levels:**
| Level | Name | What They Can Do |
|-------|------|------------------|
| 0 | None | No financial access |
| 1 | View | View reports only |
| 2 | Edit | Record cash transactions |
| 3 | Full | Cash management, reconciliation |
| 4 | Admin | Access sensitive financial data |

---

### 7️⃣ Reports & Analytics
**What it controls:** Business reports, dashboards, exports

**Access Levels:**
| Level | Name | What They Can Do |
|-------|------|------------------|
| 0 | None | No reports |
| 1 | View | View standard reports |
| 2 | Edit | Create custom reports |
| 3 | Full | All reports + export + scheduling |

**Options:**
- ☐ Access GST reports
- ☐ Access financial statements
- ☐ Export to Excel
- ☐ Schedule automated reports

---

### 8️⃣ System Administration
**What it controls:** Users, roles, settings, system config

**Access Levels:**
| Level | Name | What They Can Do |
|-------|------|------------------|
| 0 | None | No admin access |
| 1 | View | View system settings (read-only) |
| 2 | Edit | Modify business settings |
| 3 | Full | User management, role assignment |
| 4 | Admin | Complete system control |

---

## 🎭 Example Roles

### Example 1: Store Manager

```
Role: Store Manager
Description: Manages daily store operations

┌─────────────────────────────────────────────────┐
│ 📊 Sales Management         [Full Access ▼]     │
│    Data Scope: ⦿ All  ○ Team  ○ Own            │
│    ☑ Include POS operations                     │
│    ☑ Allow sales returns                        │
│    ☑ Allow void/cancel sales                    │
│                                                  │
│ 📦 Inventory Management     [Full Access ▼]     │
│    ☑ View cost information                      │
│    ☐ Allow negative stock                       │
│    ☑ Manage HSN codes                           │
│                                                  │
│ 🛒 Purchase Management      [Edit ▼]            │
│                                                  │
│ 👥 Customer Management      [Full Access ▼]     │
│    Data Scope: ⦿ All  ○ Team  ○ Own            │
│                                                  │
│ 👔 HR Management            [Full Access ▼]     │
│    ├─ Attendance:   [Full Access ▼]            │
│    ├─ Leave:        [Full Access ▼]            │
│    ├─ Shifts:       [Full Access ▼]            │
│    └─ Performance:  [View ▼]                    │
│                                                  │
│ 💰 Financial Management     [Edit ▼]            │
│                                                  │
│ 📈 Reports & Analytics      [Full Access ▼]     │
│    ☑ Access GST reports                         │
│    ☑ Export to Excel                            │
│                                                  │
│ ⚙️  System Administration   [None ▼]            │
└─────────────────────────────────────────────────┘
```

**Summary:**
- ✅ Full control over sales, inventory, customers
- ✅ Can approve leave and manage shifts
- ✅ Can create purchase orders but not manage vendors
- ✅ Can handle cash but no sensitive financial data
- ✅ Can access all reports
- ❌ Cannot manage users or system settings

---

### Example 2: Sales Associate

```
Role: Sales Associate
Description: Front-line sales staff

┌─────────────────────────────────────────────────┐
│ 📊 Sales Management         [Edit ▼]            │
│    Data Scope: ○ All  ○ Team  ⦿ Own            │
│    ☑ Include POS operations                     │
│    ☐ Allow sales returns                        │
│    ☐ Allow void/cancel sales                    │
│                                                  │
│ 📦 Inventory Management     [View ▼]            │
│    ☐ View cost information                      │
│                                                  │
│ 🛒 Purchase Management      [None ▼]            │
│                                                  │
│ 👥 Customer Management      [View ▼]            │
│    Data Scope: ○ All  ○ Team  ⦿ Own            │
│                                                  │
│ 👔 HR Management            [Edit ▼]            │
│    ├─ Attendance:   [Edit ▼]                   │
│    ├─ Leave:        [Edit ▼]                   │
│    ├─ Shifts:       [View ▼]                   │
│    └─ Performance:  [View ▼]                    │
│                                                  │
│ 💰 Financial Management     [None ▼]            │
│                                                  │
│ 📈 Reports & Analytics      [View ▼]            │
│                                                  │
│ ⚙️  System Administration   [None ▼]            │
└─────────────────────────────────────────────────┘
```

**Summary:**
- ✅ Can create sales for own customers only
- ✅ Can view products but not costs
- ✅ Can clock in/out and request leave
- ✅ Can view own shift schedule
- ✅ Can view standard reports
- ❌ Cannot handle returns or void sales
- ❌ No purchase or financial access
- ❌ No admin capabilities

---

### Example 3: Inventory Manager

```
Role: Inventory Manager
Description: Manages product catalog and stock

┌─────────────────────────────────────────────────┐
│ 📊 Sales Management         [View ▼]            │
│                                                  │
│ 📦 Inventory Management     [Full Access ▼]     │
│    ☑ View cost information                      │
│    ☑ Allow negative stock                       │
│    ☑ Manage HSN codes                           │
│    ☑ Access to product pricing                  │
│                                                  │
│ 🛒 Purchase Management      [Full Access ▼]     │
│                                                  │
│ 👥 Customer Management      [View ▼]            │
│                                                  │
│ 👔 HR Management            [Edit ▼]            │
│    ├─ Attendance:   [Edit ▼]                   │
│    ├─ Leave:        [Edit ▼]                   │
│    ├─ Shifts:       [View ▼]                   │
│    └─ Performance:  [None ▼]                    │
│                                                  │
│ 💰 Financial Management     [None ▼]            │
│                                                  │
│ 📈 Reports & Analytics      [Edit ▼]            │
│    ☑ Access inventory reports                   │
│    ☑ Export to Excel                            │
│                                                  │
│ ⚙️  System Administration   [None ▼]            │
└─────────────────────────────────────────────────┘
```

**Summary:**
- ✅ Complete inventory and purchase control
- ✅ Can view sales data (for planning)
- ✅ Can create custom inventory reports
- ✅ Own HR management (attendance, leave)
- ❌ Cannot process sales
- ❌ No financial or admin access

---

### Example 4: HR Manager

```
Role: HR Manager
Description: Manages human resources and payroll

┌─────────────────────────────────────────────────┐
│ 📊 Sales Management         [None ▼]            │
│                                                  │
│ 📦 Inventory Management     [None ▼]            │
│                                                  │
│ 🛒 Purchase Management      [None ▼]            │
│                                                  │
│ 👥 Customer Management      [None ▼]            │
│                                                  │
│ 👔 HR Management            [Admin ▼]           │
│    ├─ Attendance:   [Admin ▼]                  │
│    ├─ Leave:        [Admin ▼]                  │
│    ├─ Shifts:       [Admin ▼]                  │
│    └─ Performance:  [Admin ▼]                  │
│                                                  │
│ 💰 Financial Management     [View ▼]            │
│                                                  │
│ 📈 Reports & Analytics      [Full Access ▼]     │
│    ☑ Access HR reports                          │
│    ☑ Export to Excel                            │
│    ☑ Schedule automated reports                 │
│                                                  │
│ ⚙️  System Administration   [Edit ▼]            │
│    (Limited to HR settings only)                │
└─────────────────────────────────────────────────┘
```

**Summary:**
- ✅ Complete HR and payroll control
- ✅ Can view financial reports (for payroll)
- ✅ Can access all HR reports
- ✅ Can modify HR-related system settings
- ❌ No sales, inventory, or purchase access
- ❌ Cannot manage non-HR users

---

## 🔄 Permission Generation Example

### Input: Store Manager Feature Selections

```json
{
  "featurePermissions": [
    {
      "featureGroup": "sales",
      "accessLevel": 3,
      "dataScope": "all",
      "options": {
        "include_pos": true,
        "allow_returns": true,
        "allow_void": true
      }
    },
    {
      "featureGroup": "inventory",
      "accessLevel": 3,
      "options": {
        "view_costs": true,
        "allow_negative": false,
        "manage_hsn": true
      }
    },
    {
      "featureGroup": "hr",
      "accessLevel": 3,
      "subFeatures": {
        "attendance": 3,
        "leave": 3,
        "shifts": 3,
        "performance": 1
      }
    }
  ]
}
```

### Output: Generated Raw Permissions

```json
{
  "permissions": [
    {
      "resource": "sales",
      "path": [
        "/secure/sales/pos",
        "/secure/sales/pos/new",
        "/secure/sales/list",
        "/secure/sales/view",
        "/secure/sales/new",
        "/secure/sales/edit",
        "/secure/sales/returns"
      ],
      "data": "all",
      "policies": [
        {"action": "read", "properties": []},
        {"action": "view", "properties": []},
        {"action": "add", "properties": []},
        {"action": "edit", "properties": []},
        {"action": "delete", "properties": []},
        {"action": "bill", "properties": []},
        {"action": "void", "properties": []}
      ]
    },
    {
      "resource": "products",
      "path": [
        "/secure/products",
        "/secure/products/master",
        "/secure/products/price",
        "/secure/products/hsn"
      ],
      "policies": [
        {"action": "read", "properties": ["title", "description", "price", "cost"]},
        {"action": "add", "properties": ["title", "description", "price", "cost"]},
        {"action": "edit", "properties": ["title", "price", "cost"]},
        {"action": "delete"},
        {"action": "hsn.read"},
        {"action": "hsn.add"},
        {"action": "hsn.edit"}
      ]
    },
    {
      "resource": "stock",
      "path": ["/secure/store/stock"],
      "policies": [
        {"action": "read", "properties": ["qty", "cost"]},
        {"action": "adjust", "properties": ["qty"]}
      ]
    },
    {
      "resource": "hr",
      "path": [
        "/secure/hr",
        "/secure/hr/dashboard",
        "/secure/hr/attendance",
        "/secure/hr/leave",
        "/secure/hr/shifts"
      ],
      "policies": [
        {"action": "read", "properties": []},
        {"action": "attendance.clockin"},
        {"action": "attendance.clockout"},
        {"action": "attendance.approve"},
        {"action": "leave.request"},
        {"action": "leave.approve"},
        {"action": "shift.manage"},
        {"action": "shift.assign"}
      ]
    }
  ]
}
```

---

## 📊 Comparison Table

| Aspect | Current System | Feature Groups |
|--------|----------------|----------------|
| **Setup Time** | 30-60 minutes | 2-5 minutes |
| **Technical Knowledge** | High (JSON, resources, policies) | Low (dropdown selection) |
| **Error Rate** | High (typos, invalid combos) | Low (validated UI) |
| **Maintenance** | Manual JSON editing | Visual interface |
| **User Understanding** | Difficult | Intuitive |
| **Flexibility** | Very high | High (with advanced mode) |
| **Consistency** | Low (varies by admin) | High (standardized) |

---

## 💡 Key Insights

### 1. Hierarchical Control
```
Feature Group (Sales)
  ├─ Access Level (Full)
  ├─ Data Scope (All)
  ├─ Sub-features
  │   ├─ POS (included)
  │   ├─ Returns (included)
  │   └─ Intent (excluded)
  └─ Generated → 15 permission objects
```

### 2. Intelligent Defaults
- Edit level includes View permissions automatically
- Full includes Edit and View
- Admin includes Full, Edit, and View

### 3. Conflict Resolution
- If user has multiple roles with same feature at different levels
- Highest access level wins (Full > Edit > View > None)
- Data scopes merge: All > Team > Self

---

## 🎯 Next Steps

1. **Review this proposal** - Does it meet your needs?
2. **Customize feature groups** - Add/remove/modify for your domain
3. **Define access level mappings** - What each level means per feature
4. **Build the generator** - Backend logic to create permissions
5. **Create the UI** - Beautiful, intuitive interface
6. **Test thoroughly** - Ensure generated permissions are correct
7. **Train users** - Show admins the new system

---

**This transforms RBAC from technical task to business process!** 🚀
