# GST Filing and Input Tax Credit (ITC) Claim Guide
## Complete Guide for Pharmacy Business using RGP Back Office

**Document Version**: 1.0
**Last Updated**: 2025-12-06
**System**: RGP Back Office
**Applicable to**: Indian Pharmacy Business with GST Registration

---

## Table of Contents

1. [Overview of GST Filing Process](#overview-of-gst-filing-process)
2. [Understanding ITC (Input Tax Credit)](#understanding-itc-input-tax-credit)
3. [Data Required from RGP System](#data-required-from-rgp-system)
4. [Step-by-Step Filing Process](#step-by-step-filing-process)
5. [Claiming ITC](#claiming-itc)
6. [SQL Queries for Report Generation](#sql-queries-for-report-generation)
7. [Common Issues and Solutions](#common-issues-and-solutions)
8. [Monthly Compliance Checklist](#monthly-compliance-checklist)
9. [Best Practices](#best-practices)

---

## Overview of GST Filing Process

### Key GST Returns for Pharmacy Business

| Return | Description | Due Date | Filed By |
|--------|-------------|----------|----------|
| **GSTR-1** | Outward supplies (Sales) | 11th of next month | All regular taxpayers |
| **GSTR-3B** | Summary return with tax payment | 20th of next month | All regular taxpayers |
| **GSTR-2B** | Auto-generated ITC statement | 14th of next month | Auto-drafted (no filing needed) |

### GST Filing Cycle

```
Month: January 2026
├── Feb 11: File GSTR-1 (Sales data from Jan 1-31)
├── Feb 14: GSTR-2B auto-generated (Purchase data)
└── Feb 20: File GSTR-3B (Summary + Tax Payment)
```

---

## Understanding ITC (Input Tax Credit)

### What is ITC?

**Input Tax Credit (ITC)** = Tax paid on purchases that you can claim back when paying output tax

### Example:

```
Purchase Invoice (January 2026):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Medicine purchased from Vendor: ₹10,000
CGST @ 2.5%:                      ₹250
SGST @ 2.5%:                      ₹250
Total Invoice:                  ₹10,500
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ITC Available = ₹500 (CGST ₹250 + SGST ₹250)
```

```
Sales Invoice (January 2026):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Medicine sold to Customer:      ₹15,000
CGST @ 2.5%:                      ₹375
SGST @ 2.5%:                      ₹375
Total Invoice:                  ₹15,750
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output Tax = ₹750 (CGST ₹375 + SGST ₹375)
```

```
Net Tax Payable:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Output Tax (Sales):               ₹750
Less: ITC (Purchases):           (₹500)
Net Tax to Pay:                   ₹250
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Conditions for Claiming ITC

✅ **Must Have**:
1. Valid tax invoice from registered vendor
2. Goods received (in your stock)
3. Tax actually paid by vendor to government
4. Return filed by vendor (appears in GSTR-2B)
5. HSN code on invoice (if turnover > ₹5 Cr, must be 4-digit)

❌ **Cannot Claim ITC For**:
1. Personal/non-business purchases
2. Invoices without vendor GSTIN
3. Goods not received
4. Invoices with incorrect details
5. Expired products purchased (without proper documentation)

---

## Data Required from RGP System

### 1. For GSTR-1 (Sales Data)

**Required Information**:
```
For each sale invoice:
├── Invoice Number
├── Invoice Date
├── Customer GSTIN (if B2B)
├── Customer State (if B2B)
├── Invoice Value (excluding tax)
├── HSN Code (4-digit)
├── Taxable Value per HSN
├── CGST Amount
├── SGST Amount
├── IGST Amount (if interstate)
└── Total Invoice Value
```

**Sales Categories**:
1. **B2B Sales** (Business to Business) - Customer has GSTIN
2. **B2C Large** (Business to Consumer) - Invoice > ₹2.5 lakhs, no GSTIN
3. **B2C Small** (Business to Consumer) - Invoice ≤ ₹2.5 lakhs, no GSTIN
4. **Exports** (if applicable)

### 2. For GSTR-3B (Summary Return)

**Required Data**:
```
Outward Supplies:
├── Total Sales (Taxable)
├── Tax Rate-wise breakdown (0%, 5%, 12%, 18%)
├── CGST Collected
├── SGST Collected
└── IGST Collected (if any)

Inward Supplies (Purchases):
├── Total Purchases (Taxable)
├── ITC Available
│   ├── CGST Input
│   ├── SGST Input
│   └── IGST Input
├── ITC Reversed (if any)
└── Net ITC

Tax Payment:
├── Output Tax Payable
├── Less: ITC Available
└── Net Tax to Pay (or Refund)
```

### 3. For ITC Claim (from GSTR-2B)

**Required Documentation**:
```
For each purchase invoice:
├── Vendor GSTIN
├── Invoice Number
├── Invoice Date
├── Invoice Value
├── HSN Code (4-digit minimum)
├── Taxable Value
├── CGST Amount
├── SGST Amount
├── IGST Amount (if interstate)
├── Goods Received Note (GRN) reference
└── Payment Status
```

---

## Step-by-Step Filing Process

### Month-End Process (January 2026 Example)

#### Week 1 of February (Preparation)

**Step 1: Close Month in System**
```sql
-- Verify all January sales are recorded
SELECT COUNT(*), MIN(bill_date), MAX(bill_date)
FROM sale
WHERE bill_date >= '2026-01-01' AND bill_date <= '2026-01-31';

-- Verify all January purchases are recorded
SELECT COUNT(*), MIN(invoice_date), MAX(invoice_date)
FROM purchase_invoice
WHERE invoice_date >= '2026-01-01' AND invoice_date <= '2026-01-31'
  AND status NOT IN ('CANCELLED', 'DRAFT');
```

**Step 2: Verify Data Completeness**
```sql
-- Check for missing HSN codes in sales
SELECT id, bill_no, bill_date
FROM sale s
WHERE bill_date >= '2026-01-01' AND bill_date <= '2026-01-31'
  AND EXISTS (
    SELECT 1 FROM sale_item si
    INNER JOIN product p ON p.id = si.product_id
    WHERE si.sale_id = s.id
      AND (p.hsn_code IS NULL OR p.hsn_code = '')
  );

-- Check for missing vendor GSTIN in purchases
SELECT id, invoice_no, vendor_id
FROM purchase_invoice
WHERE invoice_date >= '2026-01-01' AND invoice_date <= '2026-01-31'
  AND vendor_id IN (
    SELECT id FROM vendor WHERE gstin IS NULL OR gstin = ''
  );
```

**Step 3: Reconcile Purchase Invoices with GSTR-2B**
1. Login to GST Portal: https://www.gst.gov.in
2. Navigate to: **Returns → GSTR-2B → February 2026**
3. Download GSTR-2B JSON/Excel
4. Compare with your purchase data
5. Identify mismatches

#### Week 2 of February (Filing GSTR-1)

**Step 4: Generate GSTR-1 Sales Report**

See [SQL Queries](#sql-queries-for-report-generation) section below.

**Step 5: File GSTR-1 on Portal**

1. **Login**: https://www.gst.gov.in → Login with credentials
2. **Navigate**: Services → Returns → Returns Dashboard
3. **Select Period**: February 2026 (for January data)
4. **Prepare Online**:
   - Click on GSTR-1 tile
   - Select "Prepare Online"

5. **Enter Sales Data**:

   **Table 4 - B2B Invoices** (Sales to businesses with GSTIN):
   ```
   For each B2B invoice:
   ├── GSTIN of Recipient
   ├── Invoice Number
   ├── Invoice Date
   ├── Invoice Value
   ├── Place of Supply
   ├── Rate-wise breakdown:
   │   ├── Taxable Value
   │   ├── CGST Rate & Amount
   │   ├── SGST Rate & Amount
   │   └── IGST Rate & Amount (if interstate)
   └── HSN Code (4-digit)
   ```

   **Table 6C - B2C Large** (Sales > ₹2.5 lakhs without GSTIN):
   ```
   For each state:
   ├── Place of Supply (State)
   ├── Rate-wise summary:
   │   ├── Taxable Value
   │   └── Tax Amount
   └── Total Invoice Value
   ```

   **Table 7 - B2C Small** (Sales ≤ ₹2.5 lakhs):
   ```
   Consolidated by state and rate:
   ├── Place of Supply
   ├── Tax Rate
   ├── Taxable Value
   └── Tax Amount
   ```

   **Table 12 - HSN Summary**:
   ```
   For each HSN code:
   ├── HSN Code (4-digit minimum)
   ├── Description
   ├── UQC (Unit Quantity Code) - e.g., NOS, KGS
   ├── Total Quantity
   ├── Total Taxable Value
   └── Total Tax Amount
   ```

6. **Validate & Preview**:
   - Click "Preview" button
   - Verify all totals match your records
   - Check for errors/warnings

7. **File with DSC/EVC**:
   - File using Digital Signature Certificate (DSC) OR
   - File using EVC (Electronic Verification Code) sent to mobile

8. **Download ARN**:
   - Application Reference Number (ARN) generated
   - Save for records

**Due Date**: 11th February 2026

#### Week 3 of February (Claiming ITC)

**Step 6: Review GSTR-2B**

GSTR-2B is auto-generated on 14th of next month.

1. **Login to GST Portal**
2. **Navigate**: Returns → GSTR-2B → February 2026
3. **Download**: JSON/Excel/PDF
4. **Review Sections**:
   - 4A: B2B Invoices (from vendors)
   - 4B: Credit/Debit Notes
   - 4C: ISD (Input Service Distributor) - usually N/A for pharmacy
   - 4D: Amendment to B2B

**Step 7: Reconcile Your Purchases with GSTR-2B**

```sql
-- Export your purchase data
SELECT
  v.gstin as vendor_gstin,
  pi.invoice_no,
  pi.invoice_date,
  pi.total as invoice_value,
  pi.cgst_amount,
  pi.sgst_amount,
  pi.igst_amount,
  (pi.cgst_amount + pi.sgst_amount + pi.igst_amount) as total_tax
FROM purchase_invoice pi
INNER JOIN vendor v ON v.id = pi.vendor_id
WHERE pi.invoice_date >= '2026-01-01'
  AND pi.invoice_date <= '2026-01-31'
  AND pi.status = 'APPROVED'
  AND v.gstin IS NOT NULL
ORDER BY v.gstin, pi.invoice_date;
```

**Compare**:
- ✅ Invoices present in both → **ITC can be claimed**
- ⚠️ Invoice in your system but NOT in GSTR-2B → **ITC cannot be claimed** (vendor didn't file)
- ⚠️ Invoice in GSTR-2B but NOT in your system → **Check if missing in data entry**

**Step 8: Calculate ITC Available**

```sql
-- Total ITC available (only for invoices verified in GSTR-2B)
SELECT
  SUM(cgst_amount) as cgst_itc,
  SUM(sgst_amount) as sgst_itc,
  SUM(igst_amount) as igst_itc,
  SUM(cgst_amount + sgst_amount + igst_amount) as total_itc
FROM purchase_invoice pi
INNER JOIN vendor v ON v.id = pi.vendor_id
WHERE pi.invoice_date >= '2026-01-01'
  AND pi.invoice_date <= '2026-01-31'
  AND pi.status = 'APPROVED'
  AND v.gstin IS NOT NULL
  -- Additional filter: Only invoices verified in GSTR-2B
  AND pi.tax_status = 'ITC_ELIGIBLE';  -- You may need to add this column
```

#### Week 3 of February (Filing GSTR-3B)

**Step 9: Prepare GSTR-3B Summary**

Calculate all values needed:

```
Table 3.1 - Outward Supplies (Sales):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Particulars                   Taxable Value  Tax Amount
───────────────────────────────────────────────────────
Taxable outward supplies      ₹10,00,000     ₹50,000
  (Your total sales)
Zero rated supplies                    -           -
Exempt supplies                        -           -
Non-GST supplies                       -           -
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total                        ₹10,00,000     ₹50,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
Table 4 - ITC Available:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Details                      IGST   CGST   SGST   Cess
───────────────────────────────────────────────────────
ITC Available (GSTR-2B)        -  ₹8,000 ₹8,000     -
ITC Reversed                   -       -      -     -
Ineligible ITC                 -       -      -     -
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Net ITC Available              -  ₹8,000 ₹8,000     -
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
Table 6.1 - Tax Payable:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Particulars              IGST   CGST   SGST   Cess
───────────────────────────────────────────────────
Tax payable (3.1)          - ₹25,000 ₹25,000     -
Less: ITC (4)              - (₹8,000)(₹8,000)    -
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tax Payable in Cash        - ₹17,000 ₹17,000     -
Tax Paid via TDS/TCS       -       -      -     -
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Net Tax Payable            - ₹17,000 ₹17,000     -
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: ₹34,000
```

**Step 10: File GSTR-3B**

1. **Login to GST Portal**
2. **Navigate**: Returns → GSTR-3B → February 2026
3. **Prepare Offline** (optional):
   - Download offline tool from GST portal
   - Fill Excel sheet
   - Upload JSON

4. **Fill Online**:
   - **Table 3.1**: Enter sales figures from GSTR-1
   - **Table 4**: Enter ITC from GSTR-2B (auto-populated, verify)
   - **Table 5**: Enter outward supplies liable to reverse charge (usually 0)
   - **Table 6.1**: System auto-calculates tax payable

5. **Make Payment**:
   - Generate challan (PMT-06)
   - Pay via:
     - Net Banking
     - NEFT/RTGS
     - Credit/Debit Card
     - Over the Counter (authorized banks)
   - Save CPIN (Challan Identification Number)

6. **Offset Liability**:
   - After payment, go back to GSTR-3B
   - Click "Offset Liability"
   - System automatically uses ITC and cash payment
   - Verify final liability = 0

7. **File Return**:
   - Submit using DSC or EVC
   - Download ARN

**Due Date**: 20th February 2026

---

## Claiming ITC

### ITC Claim Process

#### 1. Eligible Purchase Invoices Only

**Requirements**:
```
✅ Vendor GSTIN present
✅ Valid tax invoice
✅ Goods received (GRN created)
✅ Invoice appears in GSTR-2B
✅ HSN code on invoice (4-digit if turnover > ₹5 Cr)
✅ Payment made within 180 days (for ITC to sustain)
```

#### 2. ITC Reconciliation

**Monthly Task**:
```
Your Purchase Data
       ↓
Compare with GSTR-2B
       ↓
┌──────────────────┬──────────────────┐
│   Match Found    │  Mismatch Found  │
├──────────────────┼──────────────────┤
│ Claim ITC        │ Investigate:     │
│                  │ - Vendor error?  │
│                  │ - Your error?    │
│                  │ - Not filed yet? │
└──────────────────┴──────────────────┘
```

**Update System**:
```sql
-- Mark invoices as ITC eligible/ineligible
UPDATE purchase_invoice
SET tax_status = 'ITC_ELIGIBLE',
    itc_claim_date = CURRENT_DATE
WHERE id IN (
  -- IDs of invoices verified in GSTR-2B
);

UPDATE purchase_invoice
SET tax_status = 'ITC_INELIGIBLE',
    itc_ineligible_reason = 'Not in GSTR-2B'
WHERE invoice_date >= '2026-01-01'
  AND invoice_date <= '2026-01-31'
  AND id NOT IN (
    -- IDs of invoices verified in GSTR-2B
  );
```

#### 3. ITC Utilization Order

**Mandatory Order** (per GST law):
```
Step 1: Use IGST credit first
  ├── Against IGST liability
  ├── Against CGST liability (remaining)
  └── Against SGST liability (remaining)

Step 2: Use CGST credit
  └── Against CGST liability only

Step 3: Use SGST credit
  └── Against SGST liability only

Note: CGST and SGST cannot cross-utilize
```

**Example**:
```
Liability:
CGST: ₹10,000
SGST: ₹10,000

ITC Available:
IGST: ₹5,000
CGST: ₹8,000
SGST: ₹6,000

Utilization:
Step 1: IGST ₹5,000
  - Use ₹5,000 against CGST liability
  - CGST liability now = ₹5,000

Step 2: CGST ₹8,000
  - Use ₹5,000 against CGST liability
  - CGST liability now = ₹0
  - Remaining CGST ITC = ₹3,000 (carried forward)

Step 3: SGST ₹6,000
  - Use ₹6,000 against SGST liability
  - SGST liability now = ₹4,000

Cash Payment Required:
CGST: ₹0
SGST: ₹4,000
Total: ₹4,000
```

#### 4. ITC Not Available

**Common Ineligible Cases**:
```
❌ Personal consumption
❌ Exempt supplies (if you sell exempt goods)
❌ Food/beverages/outdoor catering (unless business need)
❌ Works contract services for construction of immovable property
❌ Goods/services used for personal use
❌ Lost/stolen/destroyed goods (unless due to natural calamity)
❌ Vendor not filed return (not in GSTR-2B)
❌ Payment not made within 180 days
```

---

## SQL Queries for Report Generation

### 1. GSTR-1: B2B Sales Report

```sql
-- B2B Sales with HSN Code (Table 4 + Table 12)
SELECT
  c.gstin as customer_gstin,
  c.name as customer_name,
  c.state as place_of_supply,
  s.bill_no as invoice_number,
  s.bill_date as invoice_date,
  s.total as invoice_value,

  -- HSN-wise breakdown
  p.hsn_code,
  p.category as hsn_description,
  SUM(si.qty) as total_quantity,
  SUM(si.total) as taxable_value,

  -- Tax breakdown
  -- Assuming you store CGST/SGST separately in sale_item
  -- If not, calculate: tax_amount / 2 for CGST and SGST
  SUM(si.total * p.tax_pcnt / 100) as total_tax,
  SUM(si.total * p.tax_pcnt / 200) as cgst_amount,
  SUM(si.total * p.tax_pcnt / 200) as sgst_amount,
  0 as igst_amount,  -- If intrastate

  p.tax_pcnt as gst_rate

FROM sale s
INNER JOIN customer c ON c.id = s.customer_id
INNER JOIN sale_item si ON si.sale_id = s.id
INNER JOIN product p ON p.id = si.product_id
WHERE s.bill_date >= '2026-01-01'
  AND s.bill_date <= '2026-01-31'
  AND c.gstin IS NOT NULL
  AND c.gstin != ''
GROUP BY
  c.gstin, c.name, c.state, s.bill_no, s.bill_date, s.total,
  p.hsn_code, p.category, p.tax_pcnt
ORDER BY s.bill_date, s.bill_no;
```

### 2. GSTR-1: B2C Large Sales (> ₹2.5 Lakhs)

```sql
-- B2C Large invoices (Table 6C)
SELECT
  COALESCE(c.state, 'Local') as place_of_supply,
  s.bill_no,
  s.bill_date,
  s.total as invoice_value,

  -- Calculate taxable value and tax
  SUM(si.total) as taxable_value,
  SUM(si.total * p.tax_pcnt / 100) as tax_amount,
  p.tax_pcnt as gst_rate

FROM sale s
LEFT JOIN customer c ON c.id = s.customer_id
INNER JOIN sale_item si ON si.sale_id = s.id
INNER JOIN product p ON p.id = si.product_id
WHERE s.bill_date >= '2026-01-01'
  AND s.bill_date <= '2026-01-31'
  AND (c.gstin IS NULL OR c.gstin = '')  -- B2C
  AND s.total > 250000  -- > 2.5 lakhs
GROUP BY c.state, s.bill_no, s.bill_date, s.total, p.tax_pcnt
ORDER BY s.bill_date;
```

### 3. GSTR-1: B2C Small Sales Summary

```sql
-- B2C Small consolidated (Table 7)
SELECT
  COALESCE(c.state, 'Local') as place_of_supply,
  p.tax_pcnt as gst_rate,
  COUNT(DISTINCT s.id) as invoice_count,
  SUM(si.total) as taxable_value,
  SUM(si.total * p.tax_pcnt / 100) as tax_amount

FROM sale s
LEFT JOIN customer c ON c.id = s.customer_id
INNER JOIN sale_item si ON si.sale_id = s.id
INNER JOIN product p ON p.id = si.product_id
WHERE s.bill_date >= '2026-01-01'
  AND s.bill_date <= '2026-01-31'
  AND (c.gstin IS NULL OR c.gstin = '')  -- B2C
  AND s.total <= 250000  -- <= 2.5 lakhs
GROUP BY c.state, p.tax_pcnt
ORDER BY c.state, p.tax_pcnt;
```

### 4. GSTR-1: HSN-wise Summary (Table 12)

```sql
-- HSN Summary for all outward supplies
SELECT
  p.hsn_code,
  p.category as hsn_description,
  'NOS' as uqc,  -- Unit Quantity Code - update based on your needs
  SUM(si.qty) as total_quantity,
  SUM(si.total) as total_taxable_value,
  SUM(si.total * p.tax_pcnt / 100) as total_tax_amount,
  p.tax_pcnt as gst_rate

FROM sale s
INNER JOIN sale_item si ON si.sale_id = s.id
INNER JOIN product p ON p.id = si.product_id
WHERE s.bill_date >= '2026-01-01'
  AND s.bill_date <= '2026-01-31'
GROUP BY p.hsn_code, p.category, p.tax_pcnt
ORDER BY p.hsn_code;
```

### 5. GSTR-3B: Sales Summary by Tax Rate

```sql
-- Table 3.1: Outward supplies (taxable) - Rate-wise
SELECT
  p.tax_pcnt as gst_rate,
  SUM(si.total) as taxable_value,
  SUM(si.total * p.tax_pcnt / 200) as cgst_amount,
  SUM(si.total * p.tax_pcnt / 200) as sgst_amount,
  SUM(si.total * p.tax_pcnt / 100) as total_tax

FROM sale s
INNER JOIN sale_item si ON si.sale_id = s.id
INNER JOIN product p ON p.id = si.product_id
WHERE s.bill_date >= '2026-01-01'
  AND s.bill_date <= '2026-01-31'
GROUP BY p.tax_pcnt
ORDER BY p.tax_pcnt;
```

### 6. GSTR-3B: ITC Available (from Purchases)

```sql
-- Table 4: ITC Available
SELECT
  -- Using purchase invoice item tax breakdown
  SUM(pii.cgst_amount) as cgst_itc,
  SUM(pii.sgst_amount) as sgst_itc,
  SUM(pii.igst_amount) as igst_itc,
  SUM(pii.cgst_amount + pii.sgst_amount + pii.igst_amount) as total_itc,
  COUNT(DISTINCT pi.id) as invoice_count

FROM purchase_invoice pi
INNER JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
INNER JOIN vendor v ON v.id = pi.vendor_id
WHERE pi.invoice_date >= '2026-01-01'
  AND pi.invoice_date <= '2026-01-31'
  AND pi.status = 'APPROVED'
  AND v.gstin IS NOT NULL
  AND v.gstin != ''
  -- Only claim if verified in GSTR-2B
  AND pi.tax_status = 'ITC_ELIGIBLE';
```

### 7. Purchase Reconciliation Report

```sql
-- Export for GSTR-2B reconciliation
SELECT
  v.gstin as vendor_gstin,
  v.name as vendor_name,
  pi.invoice_no,
  pi.invoice_date,
  pi.grno as grn_number,
  pi.grdate as grn_date,
  pi.total - COALESCE(pi.tax_amount, 0) as taxable_value,
  pii.cgst_amount,
  pii.sgst_amount,
  pii.igst_amount,
  pi.total as total_invoice_value,
  pi.payment_status,
  pi.tax_status,

  -- HSN details
  p.hsn_code,
  SUM(pii.qty) as quantity,
  SUM(pii.total) as item_taxable_value

FROM purchase_invoice pi
INNER JOIN vendor v ON v.id = pi.vendor_id
INNER JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
INNER JOIN product p ON p.id = pii.product_id
WHERE pi.invoice_date >= '2026-01-01'
  AND pi.invoice_date <= '2026-01-31'
  AND pi.status != 'CANCELLED'
GROUP BY
  v.gstin, v.name, pi.invoice_no, pi.invoice_date,
  pi.grno, pi.grdate, pi.total, pi.tax_amount,
  pii.cgst_amount, pii.sgst_amount, pii.igst_amount,
  pi.payment_status, pi.tax_status, p.hsn_code
ORDER BY v.gstin, pi.invoice_date;
```

### 8. Vendor-wise ITC Summary

```sql
-- ITC claimed from each vendor
SELECT
  v.gstin,
  v.name,
  COUNT(DISTINCT pi.id) as invoice_count,
  SUM(pi.total - COALESCE(pi.tax_amount, 0)) as total_taxable_value,
  SUM(pii.cgst_amount) as total_cgst_itc,
  SUM(pii.sgst_amount) as total_sgst_itc,
  SUM(pii.igst_amount) as total_igst_itc,
  SUM(pii.cgst_amount + pii.sgst_amount + pii.igst_amount) as total_itc

FROM vendor v
INNER JOIN purchase_invoice pi ON pi.vendor_id = v.id
INNER JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
WHERE pi.invoice_date >= '2026-01-01'
  AND pi.invoice_date <= '2026-01-31'
  AND pi.tax_status = 'ITC_ELIGIBLE'
GROUP BY v.gstin, v.name
ORDER BY total_itc DESC;
```

---

## Common Issues and Solutions

### Issue 1: Invoices Missing in GSTR-2B

**Problem**: Your purchase invoices not appearing in GSTR-2B

**Possible Reasons**:
1. Vendor hasn't filed GSTR-1 yet
2. Vendor filed after 11th (may appear next month)
3. Vendor entered wrong GSTIN (yours)
4. Invoice date in different month

**Solution**:
```
1. Contact vendor immediately
2. Ask vendor to verify:
   - Your GSTIN entered correctly
   - Invoice details match
   - GSTR-1 filed on time
3. If vendor error:
   - Vendor can amend in next GSTR-1
   - You can claim ITC in month when it appears
4. Document communication for audit
```

**System Action**:
```sql
-- Mark invoice for follow-up
UPDATE purchase_invoice
SET tax_status = 'ITC_PENDING',
    notes = 'Not in GSTR-2B - Vendor follow-up needed'
WHERE id = XXX;
```

### Issue 2: HSN Code Mismatch

**Problem**: HSN codes in your invoices don't match vendor invoices

**Solution**:
```
1. Verify correct HSN code from official HSN list
2. Update product master:
```

```sql
UPDATE product
SET hsn_code = '3004'  -- Correct HSN
WHERE id = XXX;
```

```
3. For past invoices: Accept vendor's HSN code
4. For future: Request vendor to use correct HSN
```

### Issue 3: Tax Rate Mismatch

**Problem**: Your system shows different tax rate than vendor invoice

**Solution**:
```
1. Check vendor invoice physically
2. If vendor correct: Update your system
```

```sql
-- Correct the tax rate
UPDATE purchase_invoice_item
SET tax_pcnt = 5.0,  -- Correct rate
    cgst_pcnt = 2.5,
    sgst_pcnt = 2.5,
    cgst_amount = (qty * ptr_value * 2.5 / 100),
    sgst_amount = (qty * ptr_value * 2.5 / 100)
WHERE id = XXX;

-- Recalculate invoice total
UPDATE purchase_invoice
SET tax_amount = (
  SELECT SUM(cgst_amount + sgst_amount + igst_amount)
  FROM purchase_invoice_item
  WHERE invoice_id = XXX
),
total = (
  SELECT SUM(total) FROM purchase_invoice_item WHERE invoice_id = XXX
)
WHERE id = XXX;
```

### Issue 4: Payment Not Made Within 180 Days

**Problem**: ITC claimed but payment not made within 180 days

**Impact**: ITC must be reversed + interest

**Solution**:
```
1. Identify such invoices:
```

```sql
SELECT
  pi.invoice_no,
  pi.invoice_date,
  pi.total,
  pi.payment_status,
  (pi.cgst_amount + pi.sgst_amount) as itc_claimed,
  (CURRENT_DATE - pi.invoice_date) as days_pending
FROM purchase_invoice pi
WHERE pi.payment_status != 'PAID'
  AND (CURRENT_DATE - pi.invoice_date) > 180
  AND pi.tax_status = 'ITC_ELIGIBLE';
```

```
2. Reverse ITC in next GSTR-3B (Table 4B)
3. Make payment immediately to re-claim
4. Pay interest on reversed ITC
```

### Issue 5: Duplicate Invoices

**Problem**: Same invoice entered twice

**Solution**:
```sql
-- Find duplicates
SELECT invoice_no, vendor_id, COUNT(*)
FROM purchase_invoice
WHERE invoice_date >= '2026-01-01'
GROUP BY invoice_no, vendor_id
HAVING COUNT(*) > 1;

-- Cancel duplicate (don't delete for audit trail)
UPDATE purchase_invoice
SET status = 'CANCELLED',
    notes = 'Duplicate entry - Cancelled'
WHERE id = XXX;  -- ID of duplicate invoice
```

---

## Monthly Compliance Checklist

### Week 1: Data Entry & Verification
- [ ] All January sales invoices entered in system
- [ ] All January purchase invoices entered in system
- [ ] HSN codes verified for all products
- [ ] Vendor GSTIN verified for all purchase invoices
- [ ] Customer GSTIN verified for B2B sales
- [ ] GRN created for all purchases
- [ ] Run data validation queries

### Week 2: GSTR-1 Filing (Due: 11th)
- [ ] Generate B2B sales report
- [ ] Generate B2C sales summary
- [ ] Generate HSN-wise summary
- [ ] Verify totals match system
- [ ] Login to GST portal
- [ ] File GSTR-1 before 11th
- [ ] Download and save ARN
- [ ] Save filed GSTR-1 JSON for records

### Week 3: ITC Reconciliation (After 14th)
- [ ] Download GSTR-2B from portal (available 14th)
- [ ] Export purchase data from system
- [ ] Reconcile invoice-by-invoice
- [ ] Mark ITC eligible/ineligible in system
- [ ] Follow up with vendors for missing invoices
- [ ] Calculate total ITC available
- [ ] Prepare ITC summary for GSTR-3B

### Week 3: GSTR-3B Filing (Due: 20th)
- [ ] Generate sales summary by tax rate
- [ ] Verify ITC calculation
- [ ] Calculate tax liability
- [ ] Generate PMT-06 challan if tax payable
- [ ] Make payment via net banking
- [ ] Save CPIN (payment reference)
- [ ] Login to GST portal
- [ ] File GSTR-3B before 20th
- [ ] Offset liability using ITC + payment
- [ ] Download and save ARN
- [ ] Save filed GSTR-3B JSON for records

### Week 4: Post-Filing
- [ ] Update system with filed returns
- [ ] Archive reports and documents
- [ ] Update ITC ledger
- [ ] Prepare summary for management
- [ ] Review any errors/warnings from portal
- [ ] Plan corrections for next month if needed

---

## Best Practices

### 1. Data Entry Discipline

**DO**:
✅ Enter all invoices within 7 days
✅ Verify HSN codes before saving
✅ Enter correct tax rates automatically from HSN
✅ Maintain vendor master with GSTIN
✅ Create GRN for every purchase

**DON'T**:
❌ Backdate invoices
❌ Skip HSN codes
❌ Guess tax rates
❌ Enter invoices without GSTIN (for ITC claim)

### 2. Vendor Management

**Good Practices**:
```
1. Verify vendor GSTIN before first purchase
2. Check vendor GST registration status on portal
3. Request vendors to file GSTR-1 on time
4. Reconcile monthly with vendors
5. Keep vendor invoice copies for 6 years
```

**Vendor Checklist**:
```
✅ GSTIN verified on GST portal
✅ Registration status: Active
✅ Files GSTR-1 regularly (check GSTR-2B)
✅ HSN codes on invoices (4-digit minimum)
✅ Correct tax rates applied
```

### 3. System Enhancements

**Recommended Additions to System**:

```sql
-- Add ITC tracking fields to purchase_invoice table
ALTER TABLE purchase_invoice
ADD COLUMN tax_status VARCHAR(20) DEFAULT 'PENDING',
  -- Values: PENDING, ITC_ELIGIBLE, ITC_INELIGIBLE, ITC_CLAIMED
ADD COLUMN itc_claim_date DATE,
ADD COLUMN itc_ineligible_reason VARCHAR(200),
ADD COLUMN gstr2b_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN payment_made_date DATE;

-- Add index for faster queries
CREATE INDEX idx_purchase_invoice_tax_status
  ON purchase_invoice(tax_status, invoice_date);
```

**Add Validation**:
```sql
-- Prevent saving purchase invoice without HSN code
CREATE OR REPLACE FUNCTION check_hsn_code_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM purchase_invoice_item pii
    INNER JOIN product p ON p.id = pii.product_id
    WHERE pii.invoice_id = NEW.id
      AND (p.hsn_code IS NULL OR p.hsn_code = '')
  ) THEN
    RAISE EXCEPTION 'Product must have HSN code for purchase invoice';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_purchase_hsn
  BEFORE UPDATE OR INSERT ON purchase_invoice
  FOR EACH ROW EXECUTE FUNCTION check_hsn_code_purchase();
```

### 4. Monthly Review Meeting

**Agenda**:
```
1. Review GST filings (GSTR-1, GSTR-3B)
2. ITC claimed vs available
3. Vendor reconciliation issues
4. Tax rate changes (if any)
5. Pending ITC follow-ups
6. Compliance status
```

**Reports to Review**:
```
- Month-wise sales summary
- Month-wise purchase summary
- ITC summary
- Vendor-wise ITC
- Exception report (missing HSN, GSTIN, etc.)
```

---

## Quick Reference

### Important Dates

| Date | Activity |
|------|----------|
| 10th | Last date to enter previous month data |
| 11th | GSTR-1 filing due |
| 14th | GSTR-2B available for download |
| 20th | GSTR-3B filing + Payment due |

### Key Portal Links

- **GST Portal**: https://www.gst.gov.in
- **Login**: Services → Login → Username/Password
- **Returns**: Services → Returns → Returns Dashboard
- **Payments**: Services → Payments → Create Challan
- **ITC Ledger**: Services → Ledgers → Electronic Credit Ledger
- **GSTR-2B**: Returns → GSTR-2B

### Support

- **GST Helpdesk**: 1800-103-4786
- **Email**: helpdesk@gst.gov.in
- **FAQs**: https://tutorial.gst.gov.in/

---

## Summary

### Monthly GST Process Flow

```
Week 1: Preparation
  ├── Enter all invoices (sales & purchases)
  ├── Verify HSN codes, GSTIN
  └── Run validation reports

Week 2: GSTR-1 Filing (by 11th)
  ├── Generate sales reports
  ├── File GSTR-1 on portal
  └── Save ARN

Week 3: ITC Reconciliation (after 14th)
  ├── Download GSTR-2B
  ├── Reconcile purchases
  ├── Mark ITC eligible/ineligible
  └── Follow up vendors

Week 3: GSTR-3B Filing (by 20th)
  ├── Calculate tax liability
  ├── Make payment (if needed)
  ├── File GSTR-3B
  └── Save ARN

Week 4: Closure
  ├── Update records
  ├── Archive documents
  └── Prepare next month
```

### ITC Claim Summary

```
✅ Eligibility Check:
  ├── Valid invoice with GSTIN
  ├── Goods received (GRN)
  ├── HSN code on invoice
  ├── Appears in GSTR-2B
  └── Payment within 180 days

✅ Claim Process:
  ├── Reconcile with GSTR-2B
  ├── Mark eligible invoices
  ├── Calculate ITC
  ├── Enter in GSTR-3B Table 4
  └── Offset against liability

✅ Maintain:
  ├── Invoice copies (6 years)
  ├── GSTR-2B reports
  ├── Payment proof
  └── Reconciliation records
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-06
**Next Review**: Monthly or when GST rules change
**Maintained By**: Accounts/Finance Team

---

**END OF GUIDE**
