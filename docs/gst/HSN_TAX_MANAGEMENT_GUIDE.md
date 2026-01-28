# HSN Tax Management Guide
## Complete Guide for Managing GST Rate Changes

**Document Version**: 1.0
**Last Updated**: 2025-12-06
**System**: RGP Back Office
**Audience**: System Administrators, Database Managers, Developers

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [How Tax Rates Work](#how-tax-rates-work)
4. [Updating Tax Rates (Step-by-Step)](#updating-tax-rates-step-by-step)
5. [Adding New HSN Codes](#adding-new-hsn-codes)
6. [Querying Tax Rates](#querying-tax-rates)
7. [Testing & Verification](#testing--verification)
8. [Common Scenarios](#common-scenarios)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

---

## Overview

The RGP Back Office system uses a **time-based HSN Tax Master** system that:

- ✅ Automatically applies correct tax rates based on invoice date
- ✅ Maintains complete historical accuracy for old invoices
- ✅ Supports future-dated tax rate changes
- ✅ Adapts to any GST rate modifications
- ✅ Eliminates need for code changes when GST rates change

### Key Principle

**NEVER delete old tax rates**. Instead, close them by setting `effective_to` date and insert new rates with future `effective_from` dates.

---

## System Architecture

### Database Layer

**Table**: `hsn_tax_master`

```sql
CREATE TABLE hsn_tax_master (
  id SERIAL PRIMARY KEY,
  hsn_code VARCHAR(8) NOT NULL,           -- 4-8 digit HSN code
  hsn_description VARCHAR(200),            -- Human-readable description

  -- GST Rates (in percentage)
  cgst_rate NUMERIC(5,2) NOT NULL,        -- Central GST
  sgst_rate NUMERIC(5,2) NOT NULL,        -- State GST
  igst_rate NUMERIC(5,2) NOT NULL,        -- Integrated GST (CGST + SGST)

  -- Effective dates for time-based lookup
  effective_from DATE NOT NULL,            -- When this rate starts
  effective_to DATE DEFAULT '2099-12-31', -- When this rate ends

  -- Category for grouping
  tax_category VARCHAR(50),                -- MEDICINE, SURGICAL, COSMETIC, etc.

  -- Audit fields
  active BOOLEAN DEFAULT true,
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  updated_by INTEGER,

  -- Constraints
  CONSTRAINT hsn_tax_master_unique UNIQUE (hsn_code, effective_from),
  CONSTRAINT hsn_tax_master_igst_equals_cgst_plus_sgst
    CHECK (igst_rate = cgst_rate + sgst_rate)
);
```

### Backend Services

**File**: `api-v2/src/modules/app/products/product.service.ts`

Key Methods:
- `getTaxRateForHsn(hsnCode, date)` - Get tax rate for HSN code on specific date
- `getProductWithTaxRate(productId)` - Get product with auto-populated tax rate
- `findAllHsnTaxCodes(filters)` - List all HSN codes with filters
- `createHsnTax(data, userId)` - Add new HSN tax code
- `updateHsnTax(id, data, userId)` - Update existing HSN tax code

### Frontend Integration

**Auto-population Flow**:

1. User selects product in invoice form
2. Frontend calls: `GET /products/{id}/with-tax`
3. Backend fetches product and current HSN tax rate
4. Frontend auto-populates tax% field
5. User can override if needed

**HSN Display**:
- Product form shows HSN dropdown with tax breakdown
- Invoice form displays HSN code (read-only) for selected product

---

## How Tax Rates Work

### Time-Based Lookup

When calculating tax for an invoice:

```sql
SELECT cgst_rate, sgst_rate, igst_rate
FROM hsn_tax_master
WHERE hsn_code = 'XXXX'
  AND active = true
  AND invoice_date BETWEEN effective_from AND effective_to
ORDER BY effective_from DESC
LIMIT 1;
```

### Example: Medicine Rate Change (12% → 5%)

**Timeline**:
- Before Sep 22, 2025: 12% GST (CGST 6% + SGST 6%)
- Sep 22, 2025 onwards: 5% GST (CGST 2.5% + SGST 2.5%)

**Database Records**:

| hsn_code | cgst_rate | sgst_rate | igst_rate | effective_from | effective_to | active |
|----------|-----------|-----------|-----------|----------------|--------------|--------|
| 3004     | 6.00      | 6.00      | 12.00     | 2020-01-01     | 2025-09-21   | true   |
| 3004     | 2.5       | 2.5       | 5.00      | 2025-09-22     | 2099-12-31   | true   |

**Result**:
- Invoice dated Sep 20, 2025 → Uses 12% rate (first row)
- Invoice dated Sep 23, 2025 → Uses 5% rate (second row)

---

## Updating Tax Rates (Step-by-Step)

### Scenario: GST Council announces rate change

**Announcement**: "From Jan 1, 2026, cosmetics GST reduced from 18% to 12%"

### Step 1: Prepare the Migration Script

Create file: `sql/migrations/0XX_update_cosmetics_gst_2026.sql`

```sql
-- Migration 0XX: Update Cosmetics GST from 18% to 12%
-- Effective Date: 2026-01-01
-- Reference: GST Council Notification XYZ dated 2025-12-XX

BEGIN;

-- Step 1: Close existing 18% rates
UPDATE hsn_tax_master
SET
    effective_to = '2025-12-31',  -- Day before new rate takes effect
    updated_on = CURRENT_TIMESTAMP
WHERE
    tax_category = 'COSMETIC'
    AND effective_to = '2099-12-31'
    AND cgst_rate = 9
    AND sgst_rate = 9;

-- Verify closure
SELECT 'Closed old rates:' as action, COUNT(*) as count
FROM hsn_tax_master
WHERE tax_category = 'COSMETIC' AND effective_to = '2025-12-31';

-- Step 2: Insert new 12% rates
INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, effective_to, tax_category, active, created_on, updated_on)
SELECT
    hsn_code,
    hsn_description,
    6.0 as cgst_rate,      -- Changed from 9%
    6.0 as sgst_rate,      -- Changed from 9%
    12.0 as igst_rate,     -- Changed from 18%
    '2026-01-01' as effective_from,
    '2099-12-31' as effective_to,
    tax_category,
    true as active,
    CURRENT_TIMESTAMP as created_on,
    CURRENT_TIMESTAMP as updated_on
FROM hsn_tax_master
WHERE
    tax_category = 'COSMETIC'
    AND effective_to = '2025-12-31';

-- Verify new rates
SELECT 'Created new rates:' as action, COUNT(*) as count
FROM hsn_tax_master
WHERE tax_category = 'COSMETIC'
  AND effective_from = '2026-01-01';

-- Step 3: Verification Report
SELECT
    hsn_code,
    hsn_description,
    cgst_rate + sgst_rate as gst_total,
    effective_from,
    effective_to,
    CASE
        WHEN effective_to >= CURRENT_DATE THEN 'ACTIVE'
        ELSE 'HISTORICAL'
    END as status
FROM hsn_tax_master
WHERE tax_category = 'COSMETIC'
ORDER BY hsn_code, effective_from;

COMMIT;
```

### Step 2: Test in Development

```bash
# Connect to development database
docker exec -i rgp-db psql -U rgpapp -d rgpdb_dev < sql/migrations/0XX_update_cosmetics_gst_2026.sql
```

Verify:
1. Old rates are closed on correct date
2. New rates start on correct date
3. Count matches (same number of HSN codes)

### Step 3: Apply to Production

**IMPORTANT**: Take backup first!

```bash
# Backup
docker exec rgp-db pg_dump -U rgpapp rgpdb > backup_before_gst_update_2026-01-01.sql

# Apply migration
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/0XX_update_cosmetics_gst_2026.sql
```

### Step 4: Verify in Production

```sql
-- Check active cosmetic rates
SELECT * FROM get_hsn_tax_rate('3304', CURRENT_DATE);

-- Check future date
SELECT * FROM get_hsn_tax_rate('3304', '2026-01-02');

-- Summary by category
SELECT
    tax_category,
    cgst_rate + sgst_rate as gst_rate,
    COUNT(*) as hsn_count,
    effective_from,
    effective_to
FROM hsn_tax_master
WHERE tax_category = 'COSMETIC'
  AND active = true
GROUP BY tax_category, gst_rate, effective_from, effective_to
ORDER BY effective_from;
```

### Step 5: Communicate to Users

Send notification:
```
Subject: GST Rate Change - Cosmetics (Effective Jan 1, 2026)

Dear Team,

From January 1, 2026, GST on cosmetic products will be reduced from 18% to 12%.

The system has been updated to automatically apply:
- Old invoices (Dec 31, 2025 and before): 18% GST
- New invoices (Jan 1, 2026 onwards): 12% GST

No manual action required. The system will auto-populate correct rates.

Note: If you manually override tax rates, ensure you use the correct rate.
```

---

## Adding New HSN Codes

### Scenario: New product category not in system

### Method 1: Via Frontend (HSN Tax Management UI)

**Note**: HSN management UI screens may need to be created if not already available.

### Method 2: Via SQL (Recommended for bulk additions)

```sql
-- Add new HSN codes for a new category
INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, effective_to, tax_category, active)
VALUES
    -- Example: Adding lab equipment HSN codes
    ('9027', 'Laboratory equipment and instruments', 9.0, 9.0, 18.0, CURRENT_DATE, '2099-12-31', 'LAB_EQUIPMENT', true),
    ('9028', 'Gas, liquid or electricity meters', 9.0, 9.0, 18.0, CURRENT_DATE, '2099-12-31', 'LAB_EQUIPMENT', true);

-- Verify
SELECT * FROM hsn_tax_master WHERE tax_category = 'LAB_EQUIPMENT';
```

### Method 3: Via API (Programmatic)

```bash
POST /products/hsn-tax
Content-Type: application/json
Authorization: Bearer {token}

{
  "hsncode": "9027",
  "hsndescription": "Laboratory equipment and instruments",
  "cgstrate": 9.0,
  "sgstrate": 9.0,
  "igstrate": 18.0,
  "effectivefrom": "2025-12-06",
  "effectiveto": "2099-12-31",
  "taxcategory": "LAB_EQUIPMENT"
}
```

---

## Querying Tax Rates

### Get Current Rate for HSN Code

```sql
-- Using function
SELECT * FROM get_hsn_tax_rate('3004', CURRENT_DATE);

-- Direct query
SELECT
    cgst_rate,
    sgst_rate,
    igst_rate,
    (cgst_rate + sgst_rate) as total_rate
FROM hsn_tax_master
WHERE hsn_code = '3004'
  AND active = true
  AND CURRENT_DATE BETWEEN effective_from AND effective_to;
```

### Get Historical Rate

```sql
-- What was the rate on Sep 20, 2025?
SELECT * FROM get_hsn_tax_rate('3004', '2025-09-20');
```

### Get Rate for Product

```sql
-- Using function
SELECT * FROM get_product_tax_rate(123, CURRENT_DATE);

-- Direct query
SELECT
    p.id,
    p.title,
    p.hsn_code,
    htm.cgst_rate,
    htm.sgst_rate,
    htm.igst_rate,
    (htm.cgst_rate + htm.sgst_rate) as total_gst,
    htm.tax_category
FROM product p
INNER JOIN hsn_tax_master htm ON htm.hsn_code = p.hsn_code
WHERE p.id = 123
  AND htm.active = true
  AND CURRENT_DATE BETWEEN htm.effective_from AND htm.effective_to;
```

### List All Current Rates by Category

```sql
SELECT
    tax_category,
    hsn_code,
    hsn_description,
    (cgst_rate + sgst_rate) as gst_total,
    effective_from
FROM hsn_tax_master
WHERE active = true
  AND CURRENT_DATE BETWEEN effective_from AND effective_to
ORDER BY tax_category, hsn_code;
```

---

## Testing & Verification

### Test Checklist Before Going Live

```markdown
- [ ] Old invoices still show correct old rates
- [ ] New invoices use new rates
- [ ] Transition date is correct (day before vs day of)
- [ ] All HSN codes in category were updated
- [ ] IGST = CGST + SGST for all new rates
- [ ] Frontend auto-populates correct rate when product selected
- [ ] Can manually override rate if needed
- [ ] Historical reports show correct tax amounts
- [ ] Database backup taken
```

### Test Scenarios

**Test 1: Time-based lookup works**

```sql
-- Should return 12% (old rate)
SELECT * FROM get_hsn_tax_rate('3004', '2025-09-20');

-- Should return 5% (new rate)
SELECT * FROM get_hsn_tax_rate('3004', '2025-09-23');
```

**Test 2: Product auto-population**

1. Open invoice item form
2. Select a medicine product
3. Verify tax% field shows 5%
4. Check HSN code displayed correctly

**Test 3: Old invoice integrity**

```sql
-- Verify old invoices still show their original tax amounts
SELECT
    inv.invoice_no,
    inv.invoice_date,
    item.product_id,
    item.tax_pcnt,
    item.cgst_amount,
    item.sgst_amount
FROM purchase_invoice inv
INNER JOIN purchase_invoice_item item ON item.invoice_id = inv.id
WHERE inv.invoice_date < '2025-09-22'
  AND item.tax_pcnt = 12;  -- Should still show 12%
```

---

## Common Scenarios

### Scenario 1: Entire Category Rate Change

**Example**: All medicines 12% → 5%

```sql
-- Close old rates
UPDATE hsn_tax_master
SET effective_to = 'YYYY-MM-DD'
WHERE tax_category = 'MEDICINE' AND effective_to = '2099-12-31';

-- Insert new rates
INSERT INTO hsn_tax_master (...)
SELECT ..., new_cgst, new_sgst, new_igst, ...
FROM hsn_tax_master
WHERE tax_category = 'MEDICINE' AND effective_to = 'YYYY-MM-DD';
```

### Scenario 2: Specific HSN Code Rate Change

**Example**: HSN 3304 (cosmetics) 18% → 12%

```sql
-- Close old rate for specific HSN
UPDATE hsn_tax_master
SET effective_to = '2025-12-31'
WHERE hsn_code = '3304' AND effective_to = '2099-12-31';

-- Insert new rate
INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
SELECT
    hsn_code, hsn_description, 6.0, 6.0, 12.0,
    '2026-01-01', tax_category, true
FROM hsn_tax_master
WHERE hsn_code = '3304' AND effective_to = '2025-12-31';
```

### Scenario 3: Future-Dated Rate Change

**Example**: Announcement made today, effective in 3 months

Just use future `effective_from` date:

```sql
-- Insert new rate with future effective date
INSERT INTO hsn_tax_master (...)
VALUES (..., '2026-04-01', '2099-12-31', ...);

-- Close current rate on day before
UPDATE hsn_tax_master
SET effective_to = '2026-03-31'
WHERE hsn_code = 'XXXX' AND effective_to = '2099-12-31';
```

System will automatically use correct rate based on invoice date.

### Scenario 4: Rollback a Rate Change

**Emergency**: Need to undo recent rate change

```sql
BEGIN;

-- Delete new rate
DELETE FROM hsn_tax_master
WHERE hsn_code = 'XXXX'
  AND effective_from = '2026-01-01';

-- Reopen old rate
UPDATE hsn_tax_master
SET effective_to = '2099-12-31'
WHERE hsn_code = 'XXXX'
  AND effective_to = '2025-12-31';

COMMIT;
```

---

## Troubleshooting

### Problem: Tax rate not auto-populating

**Symptoms**: When selecting product, tax% field remains empty

**Checks**:

1. Does product have HSN code?
   ```sql
   SELECT id, title, hsn_code FROM product WHERE id = XXX;
   ```

2. Is there an active HSN tax rate?
   ```sql
   SELECT * FROM get_hsn_tax_rate('XXXX', CURRENT_DATE);
   ```

3. Check browser console for JavaScript errors

4. Verify API endpoint works:
   ```bash
   curl http://localhost:3000/products/XXX/with-tax
   ```

### Problem: Wrong tax rate being used

**Symptoms**: Invoice shows old rate when should use new rate (or vice versa)

**Checks**:

1. Check invoice date vs effective dates:
   ```sql
   SELECT
       invoice_date,
       (SELECT cgst_rate + sgst_rate
        FROM hsn_tax_master
        WHERE hsn_code = 'XXXX'
          AND invoice_date BETWEEN effective_from AND effective_to
       ) as correct_rate
   FROM purchase_invoice
   WHERE id = XXX;
   ```

2. Verify effective dates are correct:
   ```sql
   SELECT * FROM hsn_tax_master
   WHERE hsn_code = 'XXXX'
   ORDER BY effective_from;
   ```

### Problem: Duplicate HSN code error

**Symptoms**: Cannot insert new HSN rate - unique constraint violation

**Cause**: Trying to insert same hsn_code + effective_from combination

**Solution**: Check if rate already exists

```sql
SELECT * FROM hsn_tax_master
WHERE hsn_code = 'XXXX'
  AND effective_from = '2026-01-01';
```

If exists, use UPDATE instead of INSERT, or delete and re-insert.

---

## API Reference

### Get All HSN Tax Codes

```
GET /products/hsn-tax
Query Parameters:
  - category: string (optional) - Filter by tax category
  - activeOnly: boolean (optional) - Show only active records
  - search: string (optional) - Search in HSN code or description

Response:
[
  {
    "id": 1,
    "hsncode": "3004",
    "hsndescription": "Medicaments (Medicines)",
    "cgstrate": 2.5,
    "sgstrate": 2.5,
    "igstrate": 5.0,
    "effectivefrom": "2025-09-22",
    "effectiveto": "2099-12-31",
    "taxcategory": "MEDICINE",
    "active": true
  }
]
```

### Get Tax Rate for HSN Code

```
GET /products/hsn-tax/code/{code}/rate
Query Parameters:
  - date: string (optional) - Date in YYYY-MM-DD format (defaults to today)

Response:
{
  "cgstRate": 2.5,
  "sgstRate": 2.5,
  "igstRate": 5.0,
  "totalRate": 5.0,
  "taxCategory": "MEDICINE"
}
```

### Get Product with Tax Rate

```
GET /products/{id}/with-tax

Response:
{
  "id": 123,
  "title": "Medicine Name",
  "hsn": "3004",
  "category": "Drug",
  ... other product fields ...
  "taxRate": {
    "cgstRate": 2.5,
    "sgstRate": 2.5,
    "igstRate": 5.0,
    "totalRate": 5.0,
    "taxCategory": "MEDICINE"
  }
}
```

### Create HSN Tax Code

```
POST /products/hsn-tax
Content-Type: application/json
Authorization: Bearer {token}

Request Body:
{
  "hsncode": "9027",
  "hsndescription": "Laboratory equipment",
  "cgstrate": 9.0,
  "sgstrate": 9.0,
  "igstrate": 18.0,
  "effectivefrom": "2025-12-06",
  "effectiveto": "2099-12-31",
  "taxcategory": "LAB_EQUIPMENT"
}

Response:
{
  "id": 30,
  "hsncode": "9027",
  ...
}
```

### Update HSN Tax Code

```
PUT /products/hsn-tax/{id}
Content-Type: application/json
Authorization: Bearer {token}

Request Body:
{
  "cgstrate": 6.0,
  "sgstrate": 6.0,
  "igstrate": 12.0
}

Response:
{
  "id": 30,
  "hsncode": "9027",
  "cgstrate": 6.0,
  ...
}
```

---

## Best Practices

### DO:
✅ Always use effective dates for rate changes
✅ Keep old rates for historical accuracy
✅ Test in development before production
✅ Take database backup before rate changes
✅ Document GST notification reference
✅ Communicate changes to users
✅ Verify IGST = CGST + SGST

### DON'T:
❌ Delete old tax rates
❌ Directly update existing rates (breaks history)
❌ Skip testing
❌ Change rates without notification reference
❌ Forget to close old rates when adding new ones
❌ Use same effective_from for multiple rates of same HSN code

---

## Quick Reference Commands

```sql
-- Get current rate for HSN code
SELECT * FROM get_hsn_tax_rate('3004', CURRENT_DATE);

-- Get rate on specific date
SELECT * FROM get_hsn_tax_rate('3004', '2025-09-20');

-- List all current active rates
SELECT hsn_code, hsn_description, cgst_rate, sgst_rate, tax_category
FROM hsn_tax_master
WHERE active = true AND CURRENT_DATE BETWEEN effective_from AND effective_to
ORDER BY tax_category, hsn_code;

-- Check rate history for an HSN code
SELECT hsn_code, cgst_rate, sgst_rate, effective_from, effective_to
FROM hsn_tax_master
WHERE hsn_code = '3004'
ORDER BY effective_from DESC;

-- Find products without HSN codes
SELECT id, title, category FROM product WHERE hsn_code IS NULL OR hsn_code = '';
```

---

## Support & Further Reading

- **Official GST Portal**: https://www.gst.gov.in
- **HSN Code Reference**: https://www.cbic.gov.in/resources//htdocs-cbec/gst/hsn-code.pdf
- **System Documentation**: `docs/GST_2025_IMPACT_ANALYSIS.md`
- **Migration Scripts**: `sql/migrations/013_comprehensive_hsn_tax_master_2025.sql`

---

**Document Maintainer**: Development Team
**Last Review**: 2025-12-06
**Next Review**: Quarterly or when GST notification issued

