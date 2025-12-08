# Pricing & Tax Management - Analysis & Recommendations

## Executive Summary

This document analyzes the current pricing and tax management system and provides comprehensive recommendations for improvements, specifically focusing on HSN-based tax rates, automated sale price calculations, and pricing rules engine.

---

## Current Implementation Analysis

### 1. Product Entity
**Location**: `api-v2/src/entities/product.entity.ts`

```typescript
@Column("character varying", { name: "hsn_code", length: 40 })
hsn: string;

@Column("double precision", { name: "tax_pcnt", nullable: true, precision: 53 })
taxpcnt: number | null;
```

**Current State**:
- ✅ HSN code field exists
- ✅ Tax percentage field exists
- ❌ **NOT populated** - Products don't have tax rates set
- ❌ No HSN-to-tax mapping table
- ❌ No validation of HSN codes

### 2. Product Price Management
**Location**: `sql/ddl/tables.sql` (product_price2 table)

```sql
CREATE TABLE public.product_price2 (
    id serial4 NOT NULL,
    eff_date date DEFAULT CURRENT_DATE NOT NULL,
    product_id int4 NOT NULL,
    end_date date DEFAULT '2099-12-31'::date NOT NULL,
    sale_price float4 NOT NULL,
    reason varchar NULL,
    comments varchar NULL,
    CONSTRAINT product_price2_unique UNIQUE (product_id, eff_date, sale_price, end_date)
);
```

**Current Features**:
- ✅ Effective date tracking (eff_date)
- ✅ End date for price history (end_date = '2099-12-31' for current)
- ✅ Unique constraint prevents exact duplicates
- ✅ Audit fields (reason, comments)
- ❌ **Only stores final sale price** - No pricing components
- ❌ No MRP tracking in price table
- ❌ No discount/margin tracking
- ❌ No pricing rule reference

### 3. Price Change Logic
**Location**: `api-v2/src/modules/app/products/product.service.ts`

```typescript
async addPrice(createProductPrice2Dto: CreateProductPrice2Dto, userid) {
  const priceFound = await this.findPriceHistoryById(createProductPrice2Dto.productid);

  if(!priceFound || priceFound.length == 0){
    return this.priceRepository.save({...createProductPrice2Dto, createdby:userid});
  }

  return priceFound && await this.endCurrentPrice(createProductPrice2Dto.productid, createProductPrice2Dto.effdate)
    .then(async (data:any) => {
      return await this.priceRepository.save({...createProductPrice2Dto, createdby:userid});
    })
}

async endCurrentPrice(productid:number, enddate?:string){
  const dateToSet = enddate || new Date().toISOString().split('T')[0];
  return await this.manager.query(
    `update product_price2 set end_date = $1 where product_id = $2 and end_date = '2099-12-31'`,
    [dateToSet, productid]
  );
}
```

**Current Flow**:
1. ✅ Ends current price by setting end_date
2. ✅ Adds new price with new effective date
3. ⚠️ **Race condition risk** - No transaction wrapping
4. ❌ No price calculation logic - just stores what user enters

### 4. Purchase Invoice Items
**Location**: `api-v2/src/entities/purchase-invoice-item.entity.ts`

Stores per-item:
- `mrpcost` - Maximum Retail Price
- `ptrvalue` - Price to Retailer (before tax)
- `ptrcost` - Price to Retailer (after tax)
- `discpcnt` - Discount percentage
- `taxpcnt` - Tax percentage
- `saleprice` - Calculated sale price
- `cgstpcnt`, `sgstpcnt`, `igstpcnt` - GST breakdown
- `cgstamount`, `sgstamount`, `igstamount` - Tax amounts

**Issues**:
- ❌ Tax entered manually per item (not from product/HSN)
- ❌ Sale price calculated manually
- ❌ No pricing rules applied

---

## Problems Identified

### Critical Issues

1. **No HSN-Based Tax Automation**
   - Tax rates must be entered manually for each invoice item
   - High risk of incorrect tax rates
   - No compliance checking against GST rates

2. **No Automated Sale Price Calculation**
   - Sale price must be calculated and entered manually
   - No consistent pricing formula
   - Risk of pricing errors and inconsistency

3. **Race Condition in Price Updates** (line 99-135 in product.service.ts)
   - `endCurrentPrice()` and new price insert are not in transaction
   - Can cause duplicate entries under concurrent updates
   - Already causing 500 errors in production!

4. **Missing Pricing Components**
   - product_price2 only stores final sale_price
   - No tracking of: base_price, discount_pcnt, margin_pcnt, tax_inclusive flag
   - Cannot reconstruct pricing logic from historical data

### Business Impact Issues

5. **No Pricing Rules Engine**
   - No support for:
     - Promotional pricing
     - Volume discounts
     - Customer-specific pricing
     - Time-based offers
     - Category-based margins

6. **Inconsistent Tax Handling**
   - Product.taxpcnt exists but not used
   - Invoice item tax entered manually
   - No single source of truth for tax rates

---

## Recommended Solution Architecture

### Phase 1: HSN-Based Tax Management (HIGH PRIORITY)

#### 1.1 Create HSN Tax Master Table

```sql
-- HSN code to GST rate mapping
CREATE TABLE public.hsn_tax_master (
    id SERIAL PRIMARY KEY,
    hsn_code VARCHAR(8) NOT NULL UNIQUE,
    hsn_description VARCHAR(200),

    -- GST Rates
    cgst_rate NUMERIC(5,2) NOT NULL,
    sgst_rate NUMERIC(5,2) NOT NULL,
    igst_rate NUMERIC(5,2) NOT NULL,

    -- Effective dates
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE DEFAULT '2099-12-31',

    -- Category
    tax_category VARCHAR(50), -- 'MEDICINE', 'COSMETIC', 'FMCG', etc.

    -- Audit
    active BOOLEAN DEFAULT true,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,

    CONSTRAINT hsn_tax_master_unique UNIQUE (hsn_code, effective_from)
);

-- Indexes for performance
CREATE INDEX idx_hsn_tax_active ON hsn_tax_master(hsn_code, effective_to)
    WHERE active = true;

-- Sample data for pharmacy products
INSERT INTO hsn_tax_master (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate, tax_category) VALUES
('30049099', 'Other medicaments', 6, 6, 12, 'MEDICINE'),
('33049900', 'Beauty/makeup preparations', 9, 9, 18, 'COSMETIC'),
('30051010', 'Adhesive dressings', 6, 6, 12, 'MEDICINE'),
('96190010', 'Sanitary towels/tampons', 6, 6, 12, 'HYGIENE');
```

#### 1.2 Link Products to HSN Taxonomy

```sql
-- Add constraints and populate product HSN codes
ALTER TABLE product
    ADD CONSTRAINT product_hsn_fk
    FOREIGN KEY (hsn_code)
    REFERENCES hsn_tax_master(hsn_code)
    ON UPDATE CASCADE;

-- Function to get current tax rate for product
CREATE OR REPLACE FUNCTION get_product_tax_rate(p_product_id INTEGER, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    cgst_rate NUMERIC,
    sgst_rate NUMERIC,
    igst_rate NUMERIC,
    total_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        htm.cgst_rate,
        htm.sgst_rate,
        htm.igst_rate,
        (htm.cgst_rate + htm.sgst_rate) as total_rate
    FROM product p
    INNER JOIN hsn_tax_master htm ON htm.hsn_code = p.hsn_code
    WHERE p.id = p_product_id
        AND htm.effective_from <= p_date
        AND htm.effective_to >= p_date
        AND htm.active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

#### 1.3 Update Product Service

```typescript
// api-v2/src/modules/app/products/product.service.ts

async getProductWithTaxRate(productId: number): Promise<any> {
  const result = await this.manager.query(`
    SELECT
      p.*,
      htm.cgst_rate,
      htm.sgst_rate,
      htm.igst_rate,
      (htm.cgst_rate + htm.sgst_rate) as total_tax_rate
    FROM product p
    LEFT JOIN hsn_tax_master htm
      ON htm.hsn_code = p.hsn_code
      AND htm.active = true
      AND CURRENT_DATE BETWEEN htm.effective_from AND htm.effective_to
    WHERE p.id = $1
  `, [productId]);

  return result[0];
}

// Update product.taxpcnt automatically when HSN is set
async updateProductHsn(productId: number, hsnCode: string, userId: number) {
  // Get tax rate from HSN master
  const taxRate = await this.manager.query(`
    SELECT (cgst_rate + sgst_rate) as total_rate
    FROM hsn_tax_master
    WHERE hsn_code = $1
      AND active = true
      AND CURRENT_DATE BETWEEN effective_from AND effective_to
  `, [hsnCode]);

  if (taxRate && taxRate[0]) {
    // Update product with HSN and auto-populated tax rate
    await this.productRepository.update(productId, {
      hsn: hsnCode,
      taxpcnt: taxRate[0].total_rate,
      updatedby: userId
    });
  }

  return this.findById(productId);
}
```

### Phase 2: Enhanced Price Management with Components

#### 2.1 Enhanced product_price2 Schema

```sql
-- Migration: Add pricing components to product_price2
ALTER TABLE product_price2
    ADD COLUMN mrp NUMERIC(10,2),
    ADD COLUMN base_price NUMERIC(10,2),
    ADD COLUMN margin_pcnt NUMERIC(5,2),
    ADD COLUMN discount_pcnt NUMERIC(5,2),
    ADD COLUMN tax_pcnt NUMERIC(5,2),
    ADD COLUMN tax_inclusive BOOLEAN DEFAULT false,
    ADD COLUMN pricing_rule_id INTEGER,
    ADD COLUMN calculation_method VARCHAR(50) DEFAULT 'STANDARD';

COMMENT ON COLUMN product_price2.mrp IS 'Maximum Retail Price';
COMMENT ON COLUMN product_price2.base_price IS 'Base cost (PTR + Tax if applicable)';
COMMENT ON COLUMN product_price2.margin_pcnt IS 'Profit margin percentage';
COMMENT ON COLUMN product_price2.discount_pcnt IS 'Discount from MRP';
COMMENT ON COLUMN product_price2.tax_inclusive IS 'Whether sale_price includes tax';
COMMENT ON COLUMN product_price2.calculation_method IS 'STANDARD, PROMOTIONAL, CLEARANCE, CUSTOM';

-- Create view for current prices with all components
CREATE OR REPLACE VIEW product_current_price_view AS
SELECT
    pp.id as price_id,
    pp.product_id,
    p.title as product_name,
    p.hsn_code,
    pp.mrp,
    pp.base_price,
    pp.margin_pcnt,
    pp.discount_pcnt,
    pp.tax_pcnt,
    pp.sale_price,
    pp.tax_inclusive,
    pp.calculation_method,
    pp.eff_date,
    pp.end_date,
    pp.reason,
    -- Calculated fields
    CASE
        WHEN pp.tax_inclusive THEN pp.sale_price
        ELSE pp.sale_price * (1 + pp.tax_pcnt/100)
    END as sale_price_with_tax,
    pp.mrp - pp.sale_price as savings_amount,
    ((pp.mrp - pp.sale_price) / pp.mrp * 100) as savings_pcnt
FROM product_price2 pp
INNER JOIN product p ON p.id = pp.product_id
WHERE pp.active = true
    AND CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date;
```

#### 2.2 Sale Price Calculation Service

```typescript
// api-v2/src/modules/app/products/pricing-calculator.service.ts

import { Injectable } from '@nestjs/common';

export enum PricingMethod {
  MARGIN_ON_PTR = 'MARGIN_ON_PTR',      // sale = ptr * (1 + margin%)
  DISCOUNT_FROM_MRP = 'DISCOUNT_FROM_MRP', // sale = mrp * (1 - discount%)
  FIXED_PRICE = 'FIXED_PRICE',           // sale = fixed value
  PROMOTIONAL = 'PROMOTIONAL'             // Custom promotional logic
}

export interface PriceCalculationInput {
  mrp: number;
  ptr: number;           // Price to Retailer (after tax)
  ptrBeforeTax?: number; // Price to Retailer (before tax)
  taxPcnt: number;
  method: PricingMethod;
  marginPcnt?: number;    // For MARGIN_ON_PTR
  discountPcnt?: number;  // For DISCOUNT_FROM_MRP
  fixedPrice?: number;    // For FIXED_PRICE
}

export interface PriceCalculationResult {
  salePrice: number;
  salePriceWithTax: number;
  basePrice: number;
  marginAmount: number;
  marginPcnt: number;
  discountFromMrp: number;
  savingsAmount: number;
  savingsPcnt: number;
  method: string;
  breakdown: {
    mrp: number;
    ptr: number;
    taxPcnt: number;
    appliedDiscount: number;
    appliedMargin: number;
  };
}

@Injectable()
export class PricingCalculatorService {

  /**
   * Calculate sale price based on business rules
   *
   * Priority order:
   * 1. Promotional pricing (if active)
   * 2. Discount from MRP (standard pharmacy model)
   * 3. Margin on PTR (alternative model)
   */
  calculateSalePrice(input: PriceCalculationInput): PriceCalculationResult {
    let salePrice: number;
    let marginPcnt: number = 0;
    let discountPcnt: number = 0;

    // Validate inputs
    if (input.mrp <= 0 || input.ptr <= 0) {
      throw new Error('MRP and PTR must be positive values');
    }

    if (input.ptr >= input.mrp) {
      throw new Error('PTR cannot be greater than or equal to MRP');
    }

    switch (input.method) {
      case PricingMethod.DISCOUNT_FROM_MRP:
        // Standard pharmacy: discount from MRP
        discountPcnt = input.discountPcnt || 0;
        salePrice = input.mrp * (1 - discountPcnt / 100);

        // Ensure sale price doesn't go below PTR
        if (salePrice < input.ptr) {
          salePrice = input.ptr;
          discountPcnt = ((input.mrp - salePrice) / input.mrp) * 100;
        }

        marginPcnt = ((salePrice - input.ptr) / input.ptr) * 100;
        break;

      case PricingMethod.MARGIN_ON_PTR:
        // Alternative: margin on cost
        marginPcnt = input.marginPcnt || 0;
        salePrice = input.ptr * (1 + marginPcnt / 100);

        // Ensure sale price doesn't exceed MRP
        if (salePrice > input.mrp) {
          salePrice = input.mrp;
          marginPcnt = ((salePrice - input.ptr) / input.ptr) * 100;
        }

        discountPcnt = ((input.mrp - salePrice) / input.mrp) * 100;
        break;

      case PricingMethod.FIXED_PRICE:
        salePrice = input.fixedPrice || input.mrp;

        // Validate bounds
        if (salePrice < input.ptr) {
          throw new Error('Fixed price cannot be less than PTR');
        }
        if (salePrice > input.mrp) {
          throw new Error('Fixed price cannot exceed MRP');
        }

        marginPcnt = ((salePrice - input.ptr) / input.ptr) * 100;
        discountPcnt = ((input.mrp - salePrice) / input.mrp) * 100;
        break;

      default:
        throw new Error(`Unsupported pricing method: ${input.method}`);
    }

    // Round to 2 decimal places
    salePrice = Math.round(salePrice * 100) / 100;

    // Calculate tax-inclusive price if needed
    const salePriceWithTax = salePrice * (1 + input.taxPcnt / 100);

    return {
      salePrice: salePrice,
      salePriceWithTax: Math.round(salePriceWithTax * 100) / 100,
      basePrice: input.ptr,
      marginAmount: salePrice - input.ptr,
      marginPcnt: Math.round(marginPcnt * 100) / 100,
      discountFromMrp: discountPcnt,
      savingsAmount: input.mrp - salePrice,
      savingsPcnt: Math.round(discountPcnt * 100) / 100,
      method: input.method,
      breakdown: {
        mrp: input.mrp,
        ptr: input.ptr,
        taxPcnt: input.taxPcnt,
        appliedDiscount: discountPcnt,
        appliedMargin: marginPcnt
      }
    };
  }

  /**
   * Get recommended pricing based on category defaults
   */
  async getRecommendedPrice(
    productId: number,
    mrp: number,
    ptr: number,
    taxPcnt: number,
    category: string
  ): Promise<PriceCalculationResult> {
    // Category-based defaults (could come from database)
    const categoryDefaults = {
      'Drug': { method: PricingMethod.DISCOUNT_FROM_MRP, discount: 5 },
      'Cosmetic': { method: PricingMethod.DISCOUNT_FROM_MRP, discount: 10 },
      'FMCG': { method: PricingMethod.DISCOUNT_FROM_MRP, discount: 15 },
      'default': { method: PricingMethod.DISCOUNT_FROM_MRP, discount: 8 }
    };

    const defaults = categoryDefaults[category] || categoryDefaults['default'];

    return this.calculateSalePrice({
      mrp,
      ptr,
      taxPcnt,
      method: defaults.method,
      discountPcnt: defaults.discount
    });
  }
}
```

#### 2.3 Updated Product Service with Transactions

```typescript
// Fix race condition with transaction
async addPrice(createProductPrice2Dto: CreateProductPrice2Dto, userid: number) {
  return await this.manager.transaction(async (transactionalManager) => {
    // Check existing prices
    const existingPrices = await transactionalManager.query(
      `SELECT * FROM product_price2 WHERE product_id = $1 ORDER BY eff_date DESC LIMIT 1`,
      [createProductPrice2Dto.productid]
    );

    // End current price if exists
    if (existingPrices && existingPrices.length > 0) {
      await transactionalManager.query(
        `UPDATE product_price2
         SET end_date = $1
         WHERE product_id = $2
           AND end_date = '2099-12-31'`,
        [createProductPrice2Dto.effdate, createProductPrice2Dto.productid]
      );
    }

    // Insert new price
    return await transactionalManager.save(ProductPrice2, {
      ...createProductPrice2Dto,
      createdby: userid
    });
  });
}
```

### Phase 3: Pricing Rules Engine (Optional - Future Enhancement)

```sql
-- Pricing rules for promotions, bulk discounts, etc.
CREATE TABLE public.pricing_rule (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'PROMOTIONAL', 'VOLUME', 'CUSTOMER_SPECIFIC', 'TIME_BASED'

    -- Applicability
    product_ids INTEGER[],
    category_filter VARCHAR(50),
    customer_type VARCHAR(50),

    -- Discount configuration
    discount_type VARCHAR(20), -- 'PERCENTAGE', 'FIXED_AMOUNT'
    discount_value NUMERIC(10,2),
    max_discount_amount NUMERIC(10,2),

    -- Validity
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,

    -- Priority (higher = applied first)
    priority INTEGER DEFAULT 0,

    -- Status
    active BOOLEAN DEFAULT true,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER
);
```

---

## Implementation Roadmap

### Immediate (Week 1)
1. ✅ Create HSN tax master table
2. ✅ Populate common pharmacy HSN codes with GST rates
3. ✅ Add function `get_product_tax_rate()`
4. ✅ Update product service to fetch tax from HSN

### Short Term (Week 2-3)
5. ✅ Create `PricingCalculatorService`
6. ✅ Add enhanced columns to `product_price2`
7. ✅ Fix race condition with transaction wrapper
8. ✅ Update invoice item form to auto-populate tax from product/HSN

### Medium Term (Month 1-2)
9. ✅ Implement pricing rules engine
10. ✅ Add category-based default margins
11. ✅ Create pricing history reports
12. ✅ Add pricing recommendations UI

---

## Benefits

### Immediate Benefits
- ✅ **Tax Compliance**: Automatic GST rates from HSN codes
- ✅ **Reduced Errors**: No manual tax entry
- ✅ **Consistency**: Same HSN = same tax rate always
- ✅ **Audit Trail**: Complete price change history with components

### Business Benefits
- ✅ **Pricing Transparency**: See MRP, discount, margin breakdown
- ✅ **Better Margins**: Automated calculations ensure profitability
- ✅ **Competitive Pricing**: Easy to adjust discounts by category
- ✅ **Promotion Support**: Foundation for pricing rules engine

### Technical Benefits
- ✅ **Data Integrity**: Foreign key constraints, transactions
- ✅ **Performance**: Indexed lookups for tax rates
- ✅ **Scalability**: Support for thousands of products
- ✅ **Maintainability**: Single source of truth for tax rates

---

## Migration Strategy

### Step 1: Add New Tables (No Downtime)
```sql
-- Run migration to create hsn_tax_master
-- Populate with common HSN codes
```

### Step 2: Backfill Product HSN Codes
```sql
-- Manually or via import, set hsn_code for existing products
UPDATE product SET hsn_code = '30049099' WHERE category = 'Drug';
```

### Step 3: Update Product Tax Rates
```sql
-- Auto-populate product.taxpcnt from HSN master
UPDATE product p
SET tax_pcnt = (htm.cgst_rate + htm.sgst_rate)
FROM hsn_tax_master htm
WHERE htm.hsn_code = p.hsn_code
  AND htm.active = true
  AND CURRENT_DATE BETWEEN htm.effective_from AND htm.effective_to;
```

### Step 4: Deploy Code Changes
- Deploy PricingCalculatorService
- Deploy updated product service
- Deploy frontend changes for auto-tax population

### Step 5: Update product_price2 Schema
```sql
-- Add new columns with defaults
ALTER TABLE product_price2 ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);
-- Backfill from latest purchase invoice items
```

---

## Testing Checklist

### Unit Tests
- [ ] HSN tax rate lookup
- [ ] Price calculation: DISCOUNT_FROM_MRP
- [ ] Price calculation: MARGIN_ON_PTR
- [ ] Price calculation: boundary conditions (ptr >= mrp)
- [ ] Price calculation: negative values
- [ ] Transaction rollback on error

### Integration Tests
- [ ] Add invoice item → tax auto-populated from product
- [ ] Change product HSN → tax_pcnt updated
- [ ] Add new price → previous price end_date updated
- [ ] Concurrent price updates → no duplicates

### User Acceptance Tests
- [ ] Create invoice item → verify tax shown automatically
- [ ] Change price → verify old price ended correctly
- [ ] View price history → see all components (mrp, margin, discount)
- [ ] Generate pricing report → export with all calculations

---

## SQL Scripts for Quick Start

See attached files:
- `001_create_hsn_tax_master.sql` - Create HSN table
- `002_populate_pharmacy_hsn_codes.sql` - Common HSN codes
- `003_enhance_product_price2.sql` - Add pricing components
- `004_create_pricing_views.sql` - Helper views

---

## Conclusion

The recommended solution provides:
1. **HSN-based automatic tax rates** - Compliance guaranteed
2. **Transparent pricing calculations** - See all components
3. **Flexible pricing methods** - Support various business models
4. **Complete audit trail** - Track every price change
5. **Foundation for advanced features** - Rules engine, promotions

This architecture supports current pharmacy operations while providing extensibility for future business requirements.

---

**Document Version**: 1.0
**Last Updated**: 2025-12-05
**Author**: Claude Code
**Status**: Recommendation - Pending Approval
