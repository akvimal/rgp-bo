# GST 2025 Changes - Impact Analysis for RGP Back Office

**Date**: 2025-12-06
**Effective From**: September 22, 2025
**Status**: Action Required

---

## Executive Summary

The GST Council has implemented significant rate reductions for medicines and medical supplies (effective September 22, 2025). This document analyzes the impact on the RGP Back Office system and provides actionable recommendations.

### Key Changes
1. **0% GST** on 36 critical life-saving drugs (cancer, rare disorders, etc.)
2. **5% GST** on most medicines (reduced from 12%)
3. **No Cess** on medicines
4. **4-digit HSN codes** mandatory on invoices for businesses with turnover > ₹5 crores for ITC claims

---

## Current System Implementation

### What's Already Built

#### ✅ Strong Foundation
1. **HSN Tax Master Table** (`hsn_tax_master`)
   - Location: `sql/migrations/007_create_hsn_tax_master.sql`
   - Supports 4-8 digit HSN codes
   - Tracks CGST, SGST, IGST rates separately
   - Time-based effective dates for rate changes
   - Automated functions for tax lookup

2. **Product-HSN Integration**
   - Products have HSN code field (`product.hsn_code`)
   - Supports variable length HSN codes
   - Entity: `api-v2/src/entities/product.entity.ts`

3. **Invoice Tax Breakdown**
   - Purchase invoice items store CGST/SGST/IGST separately
   - Fields: `cgstpcnt`, `sgstpcnt`, `igstpcnt`, `cgstamount`, `sgstamount`, `igstamount`
   - Entity: `api-v2/src/entities/purchase-invoice-item.entity.ts:82-98`

4. **Tax Calculation Functions**
   - `get_hsn_tax_rate()`: Get rates by HSN code
   - `get_product_tax_rate()`: Get rates by product ID
   - Location: `sql/migrations/007_create_hsn_tax_master.sql:57-117`

### ⚠️ Current Limitations

1. **Outdated Tax Rates**
   - Current data shows 12% GST for most medicines (CGST 6% + SGST 6%)
   - Location: `sql/migrations/008_populate_pharmacy_hsn_codes.sql`
   - **Needs Update**: Should be 5% (CGST 2.5% + SGST 2.5%) for most medicines

2. **Missing Critical Drug List**
   - No data for 36 critical drugs that are now 0% GST
   - **Action Required**: Identify and add these HSN codes

3. **HSN Code Visibility**
   - HSN codes NOT displayed on purchase invoice forms
   - Frontend: `frontend/src/app/secured/purchases/invoices/components/invoice-item-form.component.html`
   - **Impact**: Users cannot verify correct HSN codes for ITC claims

4. **Tax Display**
   - Only shows combined "Tax%" field
   - Does NOT show CGST/SGST breakdown on UI
   - **Impact**: Difficult to verify tax calculations and ITC claims

---

## GST Rate Changes - Detailed Impact

### 1. Medicines (Chapter 30)

#### Before GST 2.0 (Old Rates - Currently in System)
```
HSN 30049011-30049099: CGST 6% + SGST 6% = 12% Total
```

#### After GST 2.0 (New Rates - Effective Sep 22, 2025)
```
Most Medicines:        CGST 2.5% + SGST 2.5% = 5% Total
36 Critical Drugs:     CGST 0% + SGST 0% = 0% Total (Exempt)
```

#### Financial Impact Example
- **Old Price** (with 12% GST): ₹1,120
- **New Price** (with 5% GST): ₹1,050
- **Savings per unit**: ₹70 (6.25% reduction)

For critical drugs with 0% GST:
- **Old Price** (with 12% GST): ₹1,120
- **New Price** (with 0% GST): ₹1,000
- **Savings per unit**: ₹120 (10.7% reduction)

### 2. Surgical Items (Chapter 30)
**Status**: Remains at 12% GST (CGST 6% + SGST 6%)
- No change required

### 3. Medical Devices (Chapter 90)
**Status**: Remains at 12% GST (CGST 6% + SGST 6%)
- No change required

### 4. Other Categories (Cosmetics, FMCG, etc.)
**Status**: No changes announced
- Cosmetics remain at 18% (CGST 9% + SGST 9%)
- Soaps/Detergents remain at 18%

---

## HSN Code Requirements for ITC (Input Tax Credit)

### Current GST Regulations (2025)

| Annual Turnover (Previous FY) | HSN Code Requirement on Invoice | ITC Impact |
|-------------------------------|--------------------------------|------------|
| < ₹1.5 Crores | No HSN code required | Full ITC allowed |
| ₹1.5 - ₹5 Crores | 2-digit HSN (Chapter) | Full ITC allowed |
| > ₹5 Crores | **4-digit HSN** (Chapter + Heading) | **Mandatory for ITC** |

### Critical Compliance Points

1. **Mandatory Since April 1, 2021**
   - HSN codes must appear on tax invoices AND in GSTR-1 returns

2. **ITC Risk**
   - Wrong classification → ITC can be cancelled
   - Missing HSN code → ITC claim rejection
   - Accuracy is critical

3. **Penalties**
   - ₹50 per invoice for missing HSN code (Section 125, CGST Act)

### Implications for RGP Back Office

**Question**: What is your pharmacy's annual turnover?

- **If > ₹5 Crores**:
  - **MUST** use 4-digit HSN codes on all invoices
  - **CRITICAL**: Without proper HSN codes, ITC claims will be rejected
  - **Immediate action required** to update system and invoice templates

- **If ₹1.5 - ₹5 Crores**:
  - 2-digit HSN codes sufficient
  - Recommended to use 4-digit for better compliance

- **If < ₹1.5 Crores**:
  - HSN codes optional but recommended

---

## Required System Changes

### Priority 1: CRITICAL - Update Tax Rates (Immediate)

#### Action Items

1. **Update Medicine Tax Rates**
   ```sql
   -- Update all existing medicine HSN codes from 12% to 5%
   UPDATE hsn_tax_master
   SET cgst_rate = 2.5,
       sgst_rate = 2.5,
       igst_rate = 5.0,
       effective_from = '2025-09-22'
   WHERE tax_category = 'MEDICINE'
     AND effective_to = '2099-12-31';
   ```

2. **Close Old Tax Rates**
   ```sql
   -- Close previous 12% rates as of Sep 21, 2025
   UPDATE hsn_tax_master
   SET effective_to = '2025-09-21'
   WHERE tax_category = 'MEDICINE'
     AND cgst_rate = 6
     AND sgst_rate = 6;
   ```

3. **Add 36 Critical Drugs at 0% GST**
   - **Action Required**: Obtain list of 36 exempt drugs from GST notification
   - Create new entries with 0% tax rates
   - Example:
   ```sql
   INSERT INTO hsn_tax_master
   (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
    effective_from, tax_category)
   VALUES
   ('3004XXXX', 'Critical Drug Name', 0, 0, 0, '2025-09-22', 'MEDICINE_CRITICAL');
   ```

### Priority 2: HIGH - Invoice Display Updates

#### Frontend Changes Required

**File**: `frontend/src/app/secured/purchases/invoices/components/invoice-item-form.component.html`

1. **Add HSN Code Column** (Read-only display from product)
   ```html
   <th>HSN Code</th>
   ```
   ```html
   <td>{{selectedProduct?.hsn}}</td>
   ```

2. **Replace Tax% with CGST/SGST Breakdown**

   Current:
   ```html
   <th>Tax%</th>
   <input formControlName="taxpcnt">
   ```

   Recommended:
   ```html
   <th>CGST%</th>
   <th>SGST%</th>
   <input formControlName="cgstpcnt" readonly>
   <input formControlName="sgstpcnt" readonly>
   ```

3. **Auto-populate from HSN Master**
   - When product selected → fetch HSN tax rates automatically
   - Display CGST/SGST breakdown
   - Calculate tax amounts

### Priority 3: MEDIUM - Invoice Print Templates

**Files to Update**:
- Any PDF/print templates for purchase invoices
- Sales invoice templates

**Changes**:
1. Add HSN Code column to invoice line items
2. Show CGST/SGST breakdown in tax summary
3. Ensure 4-digit HSN codes are displayed for turnover > ₹5 Cr

### Priority 4: LOW - Reporting & Compliance

1. **GSTR-1 Preparation Report**
   - Create report showing HSN-wise sales summary
   - Required for GSTR-1 filing

2. **ITC Validation Report**
   - Verify all purchase invoices have valid HSN codes
   - Flag missing or invalid HSN codes

3. **Tax Rate Audit Report**
   - Compare product tax rates with HSN master
   - Identify discrepancies

---

## Implementation Roadmap

### Phase 1: Data Update (Immediate - 1 day)

**Status**: ⚠️ URGENT - Compliance Risk

1. Create migration script for updated tax rates
2. Update existing medicine HSN codes to 5%
3. Add 36 critical drugs at 0%
4. Test tax calculation functions

**Files**:
- New: `sql/migrations/012_update_medicine_gst_rates_2025.sql`

### Phase 2: Invoice Display (High Priority - 2-3 days)

**Status**: 🔴 Required for ITC Claims

1. Update invoice item form to show HSN codes
2. Add CGST/SGST breakdown display
3. Auto-populate tax rates from HSN master
4. Update invoice list/display components

**Files**:
- `frontend/src/app/secured/purchases/invoices/components/invoice-item-form.component.html`
- `frontend/src/app/secured/purchases/invoices/components/invoice-item-form.component.ts`
- `frontend/src/app/secured/purchases/invoices/components/invoice-items.component.html`

### Phase 3: Backend Service Updates (Medium Priority - 2 days)

1. Update invoice service to fetch HSN tax rates
2. Validate HSN codes on invoice creation
3. Calculate CGST/SGST automatically

**Files**:
- `api-v2/src/modules/app/purchases/purchase-invoice.service.ts`
- `api-v2/src/modules/app/products/product.service.ts`

### Phase 4: Reporting (Low Priority - 3-5 days)

1. HSN-wise sales summary report
2. ITC validation report
3. Tax rate audit report

---

## Data Migration Strategy

### Option A: Immediate Full Migration (Recommended)

**Approach**: Update all HSN codes and create new effective date entries

**Pros**:
- Historically accurate (maintains old rates for old invoices)
- Future-proof for tax audits
- Correct ITC calculations

**Cons**:
- Requires careful date-based queries

**Implementation**:
```sql
-- Step 1: Close old rates
UPDATE hsn_tax_master
SET effective_to = '2025-09-21'
WHERE tax_category = 'MEDICINE' AND effective_to = '2099-12-31';

-- Step 2: Insert new rates
INSERT INTO hsn_tax_master (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
                            effective_from, tax_category)
SELECT hsn_code, hsn_description, 2.5, 2.5, 5.0, '2025-09-22', tax_category
FROM hsn_tax_master
WHERE tax_category = 'MEDICINE' AND effective_to = '2025-09-21';
```

### Option B: Retroactive Update (Not Recommended)

**Approach**: Update existing records directly

**Pros**:
- Simple, one-time update

**Cons**:
- ❌ Loses historical accuracy
- ❌ Old invoices will show wrong tax rates
- ❌ Tax audit issues

---

## Testing Checklist

### Before Deployment

- [ ] Verify HSN tax master has correct rates (5% for medicines, 0% for critical)
- [ ] Test tax calculation for new purchase invoice items
- [ ] Test tax calculation for old invoices (should use historical rates)
- [ ] Verify CGST/SGST breakdown displays correctly
- [ ] Test HSN code display on invoice forms
- [ ] Print sample invoice and verify HSN codes visible
- [ ] Test product creation with HSN code auto-tax-lookup
- [ ] Run ITC validation report

### After Deployment

- [ ] Monitor first few invoices for correct tax calculations
- [ ] Verify GSTR-1 filing has correct HSN codes
- [ ] Confirm ITC claims are not rejected
- [ ] User acceptance testing with pharmacy staff

---

## Compliance Verification

### GST Portal Verification Steps

1. **Login to GST Portal**: https://www.gst.gov.in
2. **Navigate to**: Services → Returns → GSTR-1
3. **Check**: HSN-wise summary of outward supplies (Table 12)
4. **Verify**:
   - All HSN codes are 4-digit (if turnover > ₹5 Cr)
   - Tax rates match notification (5% for medicines, 0% for critical drugs)
   - CGST/SGST breakdown is correct

### ITC Claim Verification

1. **Navigate to**: Services → Returns → GSTR-2B (Auto-drafted ITC statement)
2. **Verify**: All purchase invoices with valid HSN codes are included
3. **Check**: ITC amounts match invoice CGST/SGST

---

## Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Using outdated 12% tax rates | Customer overcharge, competitive disadvantage | **Immediate data migration** |
| Missing HSN codes on invoices | ITC claims rejected, ₹50/invoice penalty | **Add HSN display to invoice forms** |
| Wrong HSN classification | ITC cancellation, tax notices | **HSN validation at product creation** |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Historical invoices show wrong tax | Tax audit issues | Use effective-date-based tax lookup |
| Missing critical drug list | Lost savings opportunity | Obtain official notification, update database |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| UI changes confuse users | Training required | User manual, tooltips |

---

## Cost-Benefit Analysis

### Costs
- Development time: ~5-8 days
- Testing time: ~2 days
- User training: ~1 day

### Benefits
- **Customer Savings**: 6-10% on medicine prices → Competitive advantage
- **Compliance**: Avoid penalties (₹50/invoice)
- **ITC Claims**: Ensure full ITC without rejections
- **Audit-Ready**: Historical tax rate tracking

### ROI
For a pharmacy with 100 invoices/month:
- Penalty avoidance: ₹5,000/month = ₹60,000/year
- ITC claim efficiency: Significant (depends on purchase volume)
- Customer retention: Higher due to competitive pricing

**Recommendation**: Proceed with implementation immediately

---

## Critical Next Steps

### Immediate Actions (This Week)

1. ✅ **Obtain Official GST Notification**
   - Download notification listing 36 critical drugs
   - Verify exact HSN codes for 0% category

2. ⚠️ **Create Migration Script**
   - File: `sql/migrations/012_update_medicine_gst_rates_2025.sql`
   - Update medicine rates to 5%
   - Add critical drug HSN codes at 0%

3. ⚠️ **Update Invoice Forms**
   - Add HSN code display
   - Add CGST/SGST breakdown

### Short-term (This Month)

4. 🔧 **Update Backend Services**
   - Auto-fetch tax rates from HSN master
   - Validate HSN codes

5. 📊 **Create Compliance Reports**
   - HSN-wise summary (for GSTR-1)
   - ITC validation report

### Ongoing

6. 📚 **User Training**
   - Train staff on new invoice fields
   - Document HSN code selection process

7. 🔍 **Regular Audits**
   - Monthly HSN code validation
   - Quarterly tax rate verification against GST portal

---

## Additional Resources

### Official Sources

1. **GST Portal**: https://www.gst.gov.in
   - Latest notifications and circulars

2. **HSN Code Search**: https://www.cbic.gov.in/resources//htdocs-cbec/gst/hsn-code.pdf
   - Official HSN code reference

3. **CBIC (Central Board of Indirect Taxes and Customs)**
   - Policy updates and clarifications

### References from Web Research

- [ClearTax - GST on Medicines](https://cleartax.in/s/impact-of-gst-rate-on-pharmaceutical-industry)
- [Vaxova Drugs - Latest GST Update 2025](https://www.vaxovadrugs.in/latest-gst-update-2025-impact-on-pharma-sector-and-medicines/)
- [MyJar - GST On Medicine In 2025](https://www.myjar.app/blog/gst-on-medicine-rates-exemptions-and-billing-guide)
- [SAG Infotech - GST on Medicines](https://blog.saginfotech.com/gst-impact-medicine-prices)
- [TaxGuru - GST 2.0 Pharmaceutical Industry Impact](https://taxguru.in/goods-and-service-tax/gst-2-0-pharmaceutical-industry-impact-changes-challenges.html)
- [Mondaq - GST On Medicines](https://www.mondaq.com/india/sales-taxes-vat-gst/1612066/gst-on-medicines-rates-hsn-code-impacts-calculation)
- [OC Academy - Healthcare GST Rates](https://www.ocacademy.in/blogs/healthcare-gst-rates-affordability-india/)
- [IndiaFilings - GST Rate Medicines](https://www.indiafilings.com/learn/gst-rate-medicines/)
- [TheMunim - HSN Codes in GST](https://themunim.com/hsn-codes-in-gst/)
- [IndiaFilings - HSN Code on Invoice](https://www.indiafilings.com/learn/hsn-code-invoice/)
- [GetSwipe - HSN Codes in GSTR-1](https://getswipe.in/blog/article/mandatory-mentioning-of-hsn-code-in-gstr1)

---

## Document Control

**Version**: 1.0
**Author**: Claude Code
**Last Updated**: 2025-12-06
**Next Review**: Monthly (as GST notifications are issued)

**Change Log**:
- 2025-12-06: Initial analysis based on GST 2.0 changes effective Sep 22, 2025

---

## Appendix A: Sample Migration Script

See file: `sql/migrations/012_update_medicine_gst_rates_2025.sql` (to be created)

## Appendix B: Critical Drug HSN Codes

**Status**: Pending official notification download
- Need to obtain complete list of 36 critical drugs
- HSN codes to be populated

## Appendix C: UI Mockups

**Status**: To be created during Phase 2 implementation
- Invoice form with HSN display
- Tax breakdown display

---

**END OF DOCUMENT**
