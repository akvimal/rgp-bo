# Feature Groups with Access Levels Design

**Enhancement to Multi-Role RBAC System**

Instead of managing granular permissions, provide intuitive feature groups with access level dropdowns.

---

## 🎯 Concept Overview

### Current System (Granular)
```json
{
  "resource": "sales",
  "policies": [
    {"action": "read"},
    {"action": "add"},
    {"action": "edit"},
    {"action": "delete"}
  ]
}
```

### Proposed System (Grouped with Levels)
```
Sales Management: [Full Access ▼]
├─ POS Operations
├─ Sales Orders
├─ Returns & Refunds
└─ Sales Intent

Access Level Options:
- None (no access)
- View (read only)
- Edit (create/modify)
- Full (all operations)
```

---

## 📦 Feature Groups Structure

### 1. Sales Management
**Resources:** `sales`, `sales.pos`, `sales.intent`, `sales.returns`

**Access Levels:**
- **None**: No access to sales features
- **View**: Can view sales, orders, customers
- **Edit**: Can create new sales, modify drafts
- **Full**: All sales operations including returns, void sales

**Generated Permissions:**
```json
{
  "featureGroup": "sales",
  "accessLevel": "full",
  "permissions": [
    {
      "resource": "sales",
      "data": "all",
      "policies": [
        {"action": "read"},
        {"action": "view"},
        {"action": "add"},
        {"action": "edit"},
        {"action": "delete"},
        {"action": "bill"}
      ]
    }
  ]
}
```

---

### 2. Inventory Management
**Resources:** `products`, `stock`

**Access Levels:**
- **None**: No inventory access
- **View**: Can view products, stock levels (no costs)
- **Edit**: Can add products, adjust stock
- **Full**: Full inventory control + cost visibility

**Special Settings:**
- [ ] Hide cost information (even with Full access)
- [ ] Allow negative stock
- [ ] Require approval for adjustments

---

### 3. Purchase Management
**Resources:** `purchases`, `vendors`, `purchase.orders`, `purchase.invoices`

**Access Levels:**
- **None**: No purchase access
- **View**: View purchase orders, invoices
- **Edit**: Create/modify purchase orders
- **Full**: Complete purchase cycle + vendor management

---

### 4. Customer Management
**Resources:** `customers`, `customer.credit`

**Access Levels:**
- **None**: No customer access
- **View**: View customer list, details
- **Edit**: Add/modify customer info
- **Full**: Customer management + credit control

**Data Scope Options:**
- ( ) All customers
- ( ) Team customers only
- ( ) Own customers only

---

### 5. HR Management
**Resources:** `hr`, `hr.attendance`, `hr.leave`, `hr.shifts`, `hr.performance`

**Access Levels:**
- **None**: No HR access
- **View**: View own attendance, leave balance
- **Edit**: Request leave, clock in/out
- **Full**: Approve leave, manage shifts, view all records
- **Admin**: System configuration, payroll access

**Sub-features:**
- Attendance: [Edit ▼] (can clock in/out)
- Leave: [Edit ▼] (can request)
- Shifts: [View ▼] (view schedule)
- Performance: [None ▼] (no access)

---

### 6. Financial Management
**Resources:** `store.cash`, `payments`, `financial.reports`

**Access Levels:**
- **None**: No financial access
- **View**: View reports only
- **Edit**: Record transactions
- **Full**: Complete financial control
- **Admin**: Access sensitive data, export

---

### 7. Reports & Analytics
**Resources:** `reports`, `reports.sales`, `reports.inventory`, `reports.gst`

**Access Levels:**
- **None**: No reports
- **View**: View standard reports
- **Edit**: Create custom reports
- **Full**: All reports + export + scheduled reports

---

### 8. System Administration
**Resources:** `users`, `roles`, `settings`

**Access Levels:**
- **None**: No admin access
- **View**: View system settings
- **Edit**: Modify business settings
- **Full**: User management
- **Admin**: Complete system control

---

## 🎨 UI Design

### Role Builder Interface

```
┌─────────────────────────────────────────────────────────┐
│ Create/Edit Role: Store Manager                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Role Name: [Store Manager                           ]   │
│                                                          │
│ Description: [Manages store operations              ]   │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Feature Permissions                                │  │
│ ├───────────────────────────────────────────────────┤  │
│ │                                                    │  │
│ │ 📊 Sales Management          [Full Access ▼]      │  │
│ │    Control point-of-sale and sales operations     │  │
│ │    ☑ Include POS operations                       │  │
│ │    ☑ Include sales returns                        │  │
│ │    ☐ Include sales intent                         │  │
│ │                                                    │  │
│ │ 📦 Inventory Management      [Edit ▼]             │  │
│ │    Manage products and stock levels               │  │
│ │    ☑ View cost information                        │  │
│ │    ☐ Allow negative stock                         │  │
│ │                                                    │  │
│ │ 🛒 Purchase Management       [View ▼]             │  │
│ │    Handle purchase orders and vendors             │  │
│ │                                                    │  │
│ │ 👥 Customer Management       [Full Access ▼]      │  │
│ │    Manage customer relationships                  │  │
│ │    Data Scope: ⦿ All  ○ Team  ○ Own              │  │
│ │                                                    │  │
│ │ 👔 HR Management             [Edit ▼]             │  │
│ │    Human resources and attendance                 │  │
│ │    ├─ Attendance:   [Edit ▼]                      │  │
│ │    ├─ Leave:        [Full Access ▼]               │  │
│ │    ├─ Shifts:       [Full Access ▼]               │  │
│ │    └─ Performance:  [View ▼]                      │  │
│ │                                                    │  │
│ │ 💰 Financial Management      [View ▼]             │  │
│ │    Cash handling and financial reports            │  │
│ │                                                    │  │
│ │ 📈 Reports & Analytics       [Full Access ▼]      │  │
│ │    Business intelligence and reporting            │  │
│ │                                                    │  │
│ │ ⚙️  System Administration    [None ▼]             │  │
│ │    System settings and user management            │  │
│ │                                                    │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ [Preview Permissions]  [Save Role]  [Cancel]            │
└─────────────────────────────────────────────────────────┘
```

### Access Level Dropdown

```
┌─────────────────────────────┐
│ [Full Access            ▼] │
├─────────────────────────────┤
│ None                        │ ← No access
│ View                        │ ← Read-only
│ Edit                        │ ← Create/modify
│ Full Access                 │ ← All operations
│ Admin                       │ ← System-level control
└─────────────────────────────┘
```

---

## 🔧 Implementation

### Data Structure

#### Feature Group Definition
```typescript
interface FeatureGroup {
  id: string;                    // 'sales', 'inventory', 'hr'
  name: string;                  // 'Sales Management'
  description: string;
  icon: string;                  // 'bi-cart', 'bi-box'
  resources: string[];           // ['sales', 'sales.intent']
  accessLevels: AccessLevel[];
  subFeatures?: SubFeature[];    // Optional sub-features
  dataScopes?: DataScope[];      // Optional data scope
  options?: FeatureOption[];     // Optional checkboxes
}

interface AccessLevel {
  level: number;                 // 0=none, 1=view, 2=edit, 3=full, 4=admin
  name: string;                  // 'None', 'View', 'Edit', 'Full', 'Admin'
  description: string;
  permissions: Permission[];     // Generated permissions
}

interface SubFeature {
  id: string;
  name: string;
  defaultLevel: number;
  resources: string[];
}

interface DataScope {
  value: 'all' | 'team' | 'self';
  label: string;
  description: string;
}

interface FeatureOption {
  id: string;
  label: string;
  description: string;
  affectsPermissions: string[];  // Which permissions it modifies
}
```

#### Role with Feature Groups
```typescript
interface Role {
  id: number;
  name: string;
  description: string;
  featurePermissions: FeaturePermission[];
  rawPermissions: Permission[];  // Generated from featurePermissions
}

interface FeaturePermission {
  featureGroup: string;          // 'sales', 'inventory'
  accessLevel: number;           // 0-4
  dataScope?: 'all' | 'team' | 'self';
  subFeatures?: {
    [key: string]: number;       // sub-feature ID -> access level
  };
  options?: {
    [key: string]: boolean;      // option ID -> enabled
  };
}
```

---

## 📋 Feature Group Definitions

### Example: Sales Management

```typescript
const salesFeatureGroup: FeatureGroup = {
  id: 'sales',
  name: 'Sales Management',
  description: 'Point-of-sale operations, orders, and returns',
  icon: 'bi-cart',
  resources: ['sales', 'site'],

  accessLevels: [
    {
      level: 0,
      name: 'None',
      description: 'No access to sales features',
      permissions: []
    },
    {
      level: 1,
      name: 'View',
      description: 'View sales data only',
      permissions: [
        {
          resource: 'sales',
          path: ['/secure/sales', '/secure/sales/list', '/secure/sales/view'],
          data: 'self',
          policies: [
            { action: 'read', properties: [] },
            { action: 'view', properties: [] }
          ]
        }
      ]
    },
    {
      level: 2,
      name: 'Edit',
      description: 'Create and modify sales',
      permissions: [
        {
          resource: 'sales',
          path: ['/secure/sales', '/secure/sales/pos', '/secure/sales/new'],
          data: 'team',
          policies: [
            { action: 'read', properties: [] },
            { action: 'view', properties: [] },
            { action: 'add', properties: [] },
            { action: 'bill', properties: [] }
          ]
        }
      ]
    },
    {
      level: 3,
      name: 'Full Access',
      description: 'Complete sales management including returns',
      permissions: [
        {
          resource: 'sales',
          path: [
            '/secure/sales/pos',
            '/secure/sales/list',
            '/secure/sales/view',
            '/secure/sales/new',
            '/secure/sales/edit',
            '/secure/sales/returns'
          ],
          data: 'all',
          policies: [
            { action: 'read', properties: [] },
            { action: 'view', properties: [] },
            { action: 'add', properties: [] },
            { action: 'edit', properties: [] },
            { action: 'delete', properties: [] },
            { action: 'bill', properties: [] }
          ]
        }
      ]
    }
  ],

  subFeatures: [
    {
      id: 'sales.intent',
      name: 'Sales Intent',
      defaultLevel: 2,
      resources: ['sales.intent']
    },
    {
      id: 'sales.returns',
      name: 'Returns & Refunds',
      defaultLevel: 3,
      resources: ['sales.returns']
    }
  ],

  dataScopes: [
    {
      value: 'all',
      label: 'All Sales',
      description: 'Access all sales across the organization'
    },
    {
      value: 'team',
      label: 'Team Sales',
      description: 'Access sales from your team only'
    },
    {
      value: 'self',
      label: 'Own Sales',
      description: 'Access only your own sales'
    }
  ],

  options: [
    {
      id: 'include_pos',
      label: 'Include POS operations',
      description: 'Allow direct point-of-sale transactions',
      affectsPermissions: ['sales.pos']
    },
    {
      id: 'allow_void',
      label: 'Allow void sales',
      description: 'Permission to void/cancel completed sales',
      affectsPermissions: ['sales.void']
    }
  ]
};
```

---

## 🔄 Permission Generation Logic

### Algorithm

```typescript
function generatePermissions(featurePermissions: FeaturePermission[]): Permission[] {
  const allPermissions: Permission[] = [];

  for (const fp of featurePermissions) {
    // Get feature group definition
    const featureGroup = getFeatureGroup(fp.featureGroup);

    // Get base permissions for access level
    const accessLevel = featureGroup.accessLevels.find(al => al.level === fp.accessLevel);
    if (!accessLevel) continue;

    // Clone base permissions
    let permissions = deepClone(accessLevel.permissions);

    // Apply data scope if specified
    if (fp.dataScope) {
      permissions = permissions.map(p => ({...p, data: fp.dataScope}));
    }

    // Add sub-feature permissions
    if (fp.subFeatures && featureGroup.subFeatures) {
      for (const [subId, subLevel] of Object.entries(fp.subFeatures)) {
        const subFeature = featureGroup.subFeatures.find(sf => sf.id === subId);
        if (!subFeature) continue;

        const subAccessLevel = featureGroup.accessLevels.find(al => al.level === subLevel);
        if (!subAccessLevel) continue;

        // Add sub-feature permissions
        const subPermissions = subAccessLevel.permissions
          .filter(p => subFeature.resources.includes(p.resource));

        permissions.push(...subPermissions);
      }
    }

    // Apply options (modify permissions based on checkbox selections)
    if (fp.options && featureGroup.options) {
      for (const [optionId, enabled] of Object.entries(fp.options)) {
        const option = featureGroup.options.find(o => o.id === optionId);
        if (!option) continue;

        if (enabled) {
          // Add permissions for this option
          permissions = addOptionPermissions(permissions, option);
        } else {
          // Remove permissions for this option
          permissions = removeOptionPermissions(permissions, option);
        }
      }
    }

    allPermissions.push(...permissions);
  }

  // Merge duplicates using union strategy
  return mergePermissions(allPermissions);
}
```

---

## 🎬 Usage Examples

### Example 1: Store Manager Role

```typescript
const storeManagerRole = {
  name: 'Store Manager',
  description: 'Manages daily store operations',
  featurePermissions: [
    {
      featureGroup: 'sales',
      accessLevel: 3,  // Full Access
      dataScope: 'all',
      options: {
        include_pos: true,
        allow_void: true
      }
    },
    {
      featureGroup: 'inventory',
      accessLevel: 3,  // Full Access
      options: {
        view_costs: true,
        allow_negative_stock: false
      }
    },
    {
      featureGroup: 'customers',
      accessLevel: 3,  // Full Access
      dataScope: 'all'
    },
    {
      featureGroup: 'hr',
      accessLevel: 3,  // Full Access
      subFeatures: {
        'hr.attendance': 3,  // Full
        'hr.leave': 3,       // Full (can approve)
        'hr.shifts': 3,      // Full (can manage)
        'hr.performance': 1  // View only
      }
    },
    {
      featureGroup: 'reports',
      accessLevel: 2,  // Edit (can create custom)
    },
    {
      featureGroup: 'system',
      accessLevel: 0   // None
    }
  ]
};

// Generated permissions would be ~50 individual permission objects
// merged from all feature groups
```

### Example 2: Sales Associate Role

```typescript
const salesAssociateRole = {
  name: 'Sales Associate',
  description: 'Front-line sales staff',
  featurePermissions: [
    {
      featureGroup: 'sales',
      accessLevel: 2,  // Edit (can create sales)
      dataScope: 'self',  // Only their own sales
      options: {
        include_pos: true,
        allow_void: false  // Cannot void
      }
    },
    {
      featureGroup: 'inventory',
      accessLevel: 1,  // View only
      options: {
        view_costs: false  // Hide costs
      }
    },
    {
      featureGroup: 'customers',
      accessLevel: 1,  // View only
      dataScope: 'self'
    },
    {
      featureGroup: 'hr',
      accessLevel: 2,  // Edit (for self)
      subFeatures: {
        'hr.attendance': 2,  // Can clock in/out
        'hr.leave': 2,       // Can request leave
        'hr.shifts': 1,      // View schedule only
        'hr.performance': 1  // View own performance
      }
    }
  ]
};
```

---

## 🎨 Backend API

### New Endpoints

```typescript
// Get all feature group definitions
GET /api/feature-groups
Response: FeatureGroup[]

// Get permissions preview for feature selections
POST /api/feature-groups/preview
Body: {
  featurePermissions: FeaturePermission[]
}
Response: {
  permissions: Permission[],
  summary: {
    totalPermissions: number,
    resourcesCovered: string[],
    dataScopes: string[]
  }
}

// Save role with feature-based permissions
POST /api/roles
Body: {
  name: string,
  description: string,
  featurePermissions: FeaturePermission[]
}
Response: Role (with generated rawPermissions)

// Get role with feature breakdown
GET /api/roles/:id/features
Response: {
  role: Role,
  featurePermissions: FeaturePermission[],
  rawPermissions: Permission[]
}
```

---

## 💡 Benefits

### For Administrators
✅ **Intuitive Interface**: No need to understand complex permission JSON
✅ **Faster Setup**: Configure role in minutes instead of hours
✅ **Visual Clarity**: See all permissions at a glance
✅ **Consistency**: Standardized access levels across features
✅ **Error Prevention**: Cannot create invalid permission combinations

### For Developers
✅ **Maintainable**: Changes to permissions happen in one place
✅ **Flexible**: Can still use raw permissions for edge cases
✅ **Testable**: Easy to verify permission generation
✅ **Scalable**: Add new features without changing UI code

### For End Users
✅ **Predictable**: Clear understanding of what each role can do
✅ **Transparent**: See exactly what access they have
✅ **Secure**: Principle of least privilege enforced by design

---

## 🚀 Implementation Phases

### Phase 1: Backend Foundation (Week 2)
- Define feature group structure
- Create permission generation logic
- Build API endpoints for feature groups
- Add feature permissions to role schema

### Phase 2: UI Implementation (Week 3)
- Build feature group selection component
- Create access level dropdowns
- Add preview functionality
- Integrate with role management

### Phase 3: Migration & Testing (Week 4)
- Migrate existing roles to feature-based model
- Comprehensive testing
- Documentation
- User training

---

## 📊 Comparison

### Before (Current)
```json
{
  "resource": "sales",
  "path": ["/secure/sales", "/secure/sales/pos", "/secure/sales/list"],
  "data": "all",
  "policies": [
    {"action": "read", "properties": []},
    {"action": "add", "properties": []},
    {"action": "view", "properties": []},
    {"action": "bill"}
  ]
}
```
**Admin must:** Manually craft JSON, understand resources, paths, policies

### After (Feature Groups)
```
Sales Management: [Full Access]
Data Scope: All Sales
✓ Include POS operations
✓ Allow void sales
```
**Admin must:** Select dropdown, choose options

---

## 🔐 Security Considerations

1. **Backward Compatibility**
   - Keep raw permissions as source of truth
   - Feature permissions are UI abstraction only
   - Can always fall back to raw JSON

2. **Validation**
   - Validate generated permissions before saving
   - Prevent privilege escalation
   - Audit trail for changes

3. **Flexibility**
   - Allow "Advanced Mode" for raw JSON editing
   - Mix feature groups with custom permissions
   - Override generated permissions if needed

---

## 📝 Next Steps

1. **Review & Approve** this design
2. **Define all feature groups** for your domain
3. **Build permission generator** service
4. **Create UI components** for role builder
5. **Test with real scenarios**
6. **Deploy & train users**

---

**Ready to implement?** This will make your RBAC system world-class! 🚀
