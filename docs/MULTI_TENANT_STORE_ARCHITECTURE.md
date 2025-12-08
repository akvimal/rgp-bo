# Multi-Tenant + Multi-Store Architecture Design

**Status**: Design Proposal
**Date**: 2025-12-07
**Purpose**: Future-proof architecture for multi-tenancy with store-specific inventory management

---

## Executive Summary

This document proposes database schema changes to support:
1. **Multi-Tenancy**: Multiple businesses (tenants) using the same system
2. **Multi-Store per Tenant**: Each tenant can have multiple physical stores
3. **Shared Product Catalog**: Products are global master data across all tenants
4. **Store-Specific Stock & Reorder Limits**: Inventory operations are store-specific

---

## Current State Analysis

### What Exists Today
- Single-tenant system
- Global product catalog
- No store concept
- Purchase orders, sales, invoices are tenant-global
- Reorder limits: Not implemented

### What's Missing for Multi-Tenancy
- ❌ `tenant` table
- ❌ `store` table
- ❌ `store_id` foreign keys in transactional tables
- ❌ Store-specific product configuration (reorder limits, pricing, etc.)
- ❌ Store-aware stock aggregation views
- ❌ Tenant isolation in queries

---

## Proposed Schema Design

### 1. New Core Tables

#### **tenant** (Master Tenant/Business)
```sql
CREATE TABLE tenant (
    id SERIAL PRIMARY KEY,
    tenant_code VARCHAR(20) UNIQUE NOT NULL,    -- e.g., 'APOLLO', 'MEDPLUS'
    tenant_name VARCHAR(100) NOT NULL,

    -- Subscription Info
    subscription_plan VARCHAR(50),
    subscription_status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, SUSPENDED, CANCELLED
    subscription_start_date DATE,
    subscription_end_date DATE,

    -- Contact Info
    primary_contact_name VARCHAR(100),
    primary_contact_email VARCHAR(100),
    primary_contact_mobile VARCHAR(15),

    -- Settings
    settings JSONB,  -- Tenant-specific configuration

    -- Standard Audit Columns
    active BOOLEAN DEFAULT TRUE,
    archive BOOLEAN DEFAULT FALSE,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

CREATE INDEX idx_tenant_code ON tenant(tenant_code);
CREATE INDEX idx_tenant_status ON tenant(subscription_status, active);
```

#### **store** (Physical Store Locations)
```sql
CREATE TABLE store (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenant(id),

    store_code VARCHAR(20) NOT NULL,        -- e.g., 'MAIN', 'BRANCH1'
    store_name VARCHAR(100) NOT NULL,

    -- Location Details
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    pincode VARCHAR(10),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),

    -- Store Type & Status
    store_type VARCHAR(30),  -- MAIN, BRANCH, WAREHOUSE, FRANCHISE
    is_main_store BOOLEAN DEFAULT FALSE,
    store_status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, INACTIVE, TEMP_CLOSED

    -- Contact Info
    manager_name VARCHAR(100),
    contact_mobile VARCHAR(15),
    contact_email VARCHAR(100),

    -- Operational Settings
    settings JSONB,  -- Store-specific configuration

    -- Standard Audit Columns
    active BOOLEAN DEFAULT TRUE,
    archive BOOLEAN DEFAULT FALSE,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,

    UNIQUE(tenant_id, store_code)
);

CREATE INDEX idx_store_tenant ON store(tenant_id);
CREATE INDEX idx_store_status ON store(store_status, active);
CREATE INDEX idx_store_type ON store(store_type);
```

#### **product_store_config** (Store-Specific Product Configuration)
```sql
CREATE TABLE product_store_config (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES store(id),
    product_id INTEGER NOT NULL REFERENCES product(id),

    -- Inventory Management
    reorder_limit INTEGER NOT NULL DEFAULT 0,           -- Trigger reorder when stock falls below this
    min_stock_level INTEGER DEFAULT 0,                  -- Absolute minimum stock
    max_stock_level INTEGER,                             -- Maximum stock capacity
    optimal_stock_level INTEGER,                         -- Target stock level

    -- Purchasing Parameters
    lead_time_days INTEGER DEFAULT 7,                   -- Days from order to delivery
    preferred_vendor_id INTEGER REFERENCES vendor(id),  -- Default vendor for this store

    -- Store-Specific Flags
    is_available_in_store BOOLEAN DEFAULT TRUE,         -- Product available for sale in this store
    is_fast_moving BOOLEAN DEFAULT FALSE,               -- Fast-moving SKU flag

    -- Pricing Override (if store-specific pricing needed)
    store_price DECIMAL(10, 2),                         -- NULL = use global product price

    -- Settings
    config_notes TEXT,
    settings JSONB,  -- Additional store-product config

    -- Standard Audit Columns
    active BOOLEAN DEFAULT TRUE,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,

    UNIQUE(store_id, product_id)
);

CREATE INDEX idx_psc_store ON product_store_config(store_id);
CREATE INDEX idx_psc_product ON product_store_config(product_id);
CREATE INDEX idx_psc_reorder ON product_store_config(store_id, product_id)
    WHERE is_available_in_store = TRUE;
```

---

### 2. Modify Existing Tables

#### Add store_id to Transactional Tables

**sales_intent** - Customer/internal purchase requests
```sql
ALTER TABLE sales_intent
    ADD COLUMN store_id INTEGER REFERENCES store(id);

CREATE INDEX idx_salesintent_store ON sales_intent(store_id);
```

**purchase_order** - Purchase orders
```sql
ALTER TABLE purchase_order
    ADD COLUMN store_id INTEGER REFERENCES store(id);

CREATE INDEX idx_po_store ON purchase_order(store_id);
```

**purchase_invoice** - Goods received
```sql
ALTER TABLE purchase_invoice
    ADD COLUMN store_id INTEGER REFERENCES store(id);

CREATE INDEX idx_pi_store ON purchase_invoice(store_id);
```

**sale** - Sales transactions
```sql
ALTER TABLE sale
    ADD COLUMN store_id INTEGER REFERENCES store(id);

CREATE INDEX idx_sale_store ON sale(store_id);
```

**product_price2** - Store-specific pricing (optional)
```sql
ALTER TABLE product_price2
    ADD COLUMN store_id INTEGER REFERENCES store(id);

-- Modify unique constraint to include store_id
ALTER TABLE product_price2 DROP CONSTRAINT IF EXISTS product_price2_un;
ALTER TABLE product_price2
    ADD CONSTRAINT product_price2_un
    UNIQUE(product_id, eff_date, COALESCE(store_id, 0));

CREATE INDEX idx_pp2_store ON product_price2(store_id);
```

---

### 3. New Store-Aware Views

#### **product_stock_by_store_view**
```sql
CREATE OR REPLACE VIEW product_stock_by_store_view AS
SELECT
    p.id AS product_id,
    p.title AS product_name,
    s.id AS store_id,
    s.store_name,
    s.tenant_id,
    psc.reorder_limit,
    psc.min_stock_level,
    psc.max_stock_level,
    psc.optimal_stock_level,
    psc.lead_time_days,
    psc.preferred_vendor_id,

    -- Stock Calculations (these would need to aggregate by store_id from purchase/sale items)
    COALESCE(stock_agg.total_purchased, 0) AS total_purchased,
    COALESCE(stock_agg.total_sold, 0) AS total_sold,
    COALESCE(stock_agg.total_adjusted, 0) AS total_adjusted,
    COALESCE(stock_agg.current_balance, 0) AS current_balance,

    -- Low Stock Flag
    CASE
        WHEN COALESCE(stock_agg.current_balance, 0) < psc.reorder_limit
        THEN TRUE
        ELSE FALSE
    END AS is_low_stock,

    -- Suggested Order Quantity
    CASE
        WHEN COALESCE(stock_agg.current_balance, 0) < psc.reorder_limit
        THEN psc.optimal_stock_level - COALESCE(stock_agg.current_balance, 0)
        ELSE 0
    END AS suggested_order_qty,

    psc.active AS config_active,
    psc.is_available_in_store

FROM product p
CROSS JOIN store s
LEFT JOIN product_store_config psc
    ON psc.product_id = p.id AND psc.store_id = s.id
LEFT JOIN LATERAL (
    -- This is a placeholder - actual stock aggregation by store needs to be implemented
    -- based on purchase_invoice_item, sale_item with store_id joins
    SELECT
        0 AS total_purchased,
        0 AS total_sold,
        0 AS total_adjusted,
        0 AS current_balance
) stock_agg ON TRUE

WHERE p.active = TRUE
  AND s.active = TRUE
  AND psc.is_available_in_store = TRUE;
```

#### **low_stock_products_by_store_view**
```sql
CREATE OR REPLACE VIEW low_stock_products_by_store_view AS
SELECT
    product_id,
    product_name,
    store_id,
    store_name,
    tenant_id,
    reorder_limit,
    current_balance,
    suggested_order_qty,
    preferred_vendor_id,
    lead_time_days
FROM product_stock_by_store_view
WHERE is_low_stock = TRUE
  AND config_active = TRUE
ORDER BY
    tenant_id,
    store_id,
    (reorder_limit - current_balance) DESC;  -- Most critical items first
```

---

## Migration Strategy

### Phase 1: Schema Changes (Non-Breaking)
1. Create new tables: `tenant`, `store`, `product_store_config`
2. Add **NULLABLE** `store_id` columns to existing tables
3. Create store-aware views
4. Deploy schema changes to production

### Phase 2: Default Data Setup
1. Create default tenant (existing business)
2. Create default store (main store)
3. Populate `product_store_config` with default reorder limits for all products

### Phase 3: Application Changes
1. Update TypeORM entities
2. Add store context to all transactional operations
3. Update services to filter by store_id
4. Implement store selection in UI

### Phase 4: Data Migration (Optional)
1. Backfill existing transactions with default store_id
2. Make store_id NOT NULL after backfill
3. Add foreign key constraints

---

## Impact on Smart PO Creation

### Before Multi-Store:
```
GET /purchaseorders/suggestions
→ Returns products needing reorder (tenant-global)
```

### After Multi-Store:
```
GET /purchaseorders/suggestions?store_id=1
→ Returns products needing reorder for SPECIFIC STORE
```

**Smart PO Suggestions will aggregate**:
1. **Low Stock Items** - Products below `product_store_config.reorder_limit` for the selected store
2. **Sales Intents** - Pending intents for the selected store
3. **AI Recommendations** - Store-specific demand predictions (future)
4. **Manual Additions** - User can add any product

**Each suggestion includes**:
- Product details
- Current stock balance (in selected store)
- Reorder limit (for selected store)
- Suggested order quantity
- Preferred vendor (for selected store)
- Last vendor used (for selected store)
- Reason (LOW_STOCK, SALES_INTENT, AI_RECOMMENDATION, MANUAL)

---

## User Experience Changes

### Current Flow:
1. Click "Create PO"
2. Select products
3. Select vendor
4. Submit

### New Flow (Multi-Store):
1. **Select Store** (new step)
2. Click "Create PO for [Store Name]"
3. See store-specific low stock items
4. See store-specific sales intents
5. Select products (with store-specific stock levels shown)
6. Select vendor (with last vendor for this store highlighted)
7. Submit PO (tagged with store_id)

---

## Implementation Recommendation

Given the future multi-tenancy requirement, I recommend:

**Option A: Implement Multi-Store NOW (Recommended)**
- Build the proper structure from the start
- Easier to build right than to migrate later
- Single-tenant, single-store for now, but schema ready for expansion
- Estimated time: +2 hours vs simple reorder limit

**Option B: Simple Reorder Limit Now, Migrate Later**
- Add `product.reorderlimit` column (tenant-global)
- Build Smart PO without store context
- **Pain point**: Will need to migrate all reorder limits to `product_store_config` later
- **Pain point**: All queries will need to be rewritten for store filtering

**My Recommendation**: Go with **Option A**. The upfront investment is worth avoiding a painful migration later.

---

## Next Steps

Please review and confirm:
1. Does this architecture align with your multi-tenancy vision?
2. Should we implement multi-store structure NOW, or defer to later?
3. Any modifications needed to the proposed schema?

Once approved, I'll proceed with implementation.
