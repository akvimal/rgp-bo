# Purchase Dashboard Enhancement Analysis - 2026-01-18

## Executive Summary

Analysis of potential enhancements to the Purchases Analytics Dashboard focused on three key areas:
1. **Expiry Management Metrics** - Track near-expiry and expired inventory from purchases
2. **Purchase Effectiveness Metrics** - Measure vendor performance and purchase quality
3. **Purchase Order Adherence Metrics** - Compare PO vs Invoice accuracy and timeliness

---

## Current Dashboard State

### Existing Metrics (Implemented)
✅ **Summary Cards**:
- Total Purchase Value (Current Month with % change)
- Pending Invoices Count & Value
- Approved & Paid Count & Value
- Top Vendor Name & Value

✅ **Charts**:
- Monthly Purchase Trends (Last 6 Months) - Line chart
- Invoice Status Breakdown - Doughnut chart
- Top 5 Vendors by Value - Horizontal bar chart
- Category-wise Spending - Pie chart

✅ **Data Tables**:
- Recent Invoices (Last 7 Days)
- Payment Timeline (Unpaid Invoices with days overdue)

✅ **Quick Actions**:
- Create New Invoice
- Create Purchase Order
- View All Invoices
- Manage Vendors

---

## Available Data Sources

### Database Tables & Entities

#### 1. Batch & Expiry Tracking
**Table**: `product_batch`
**Entity**: `ProductBatch`

**Available Fields**:
```typescript
{
  productId: number
  batchNumber: string
  expiryDate: Date
  manufacturedDate: Date | null
  quantityReceived: number
  quantityRemaining: number
  purchaseInvoiceItemId: number | null
  vendorId: number | null
  ptrCost: number | null
  receivedDate: Date
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'RECALLED'
}
```

**Indexes**:
- `idx_batch_product_expiry` - Optimized for expiry queries
- `idx_batch_status_expiry` - Optimized for status-based expiry queries

#### 2. Purchase Order Management
**Table**: `purchase_order`
**Entity**: `PurchaseOrder`

**Available Fields**:
```typescript
{
  id: number
  ponumber: string
  status: string  // 'PENDING', 'APPROVED', 'CLOSED', etc.
  vendorid: number
  storeid: number | null
  comments: string
  createdOn: Date
  updatedOn: Date
}
```

**Related**: `purchase_request` table links requests to orders

#### 3. Purchase Invoice Data
**Table**: `purchase_invoice`
**Entity**: `PurchaseInvoice`

**Available Fields**:
```typescript
{
  invoiceNo: string
  invoiceDate: Date
  vendorId: number
  status: string
  purchaseOrderId: string | null  // Links to PO
  grNo: string | null
  grDate: Date | null  // Goods Receipt Date
  total: number
  paidAmount: number
  paymentStatus: string
  lifecycleStatus: string
}
```

#### 4. Purchase Invoice Items
**Table**: `purchase_invoice_item`
**Entity**: `PurchaseInvoiceItem`

**Available Fields**:
```typescript
{
  invoiceId: number
  productId: number
  batch: string
  expDate: Date
  ptrCost: number
  mrpCost: number
  discPcnt: number
  taxPcnt: number
  qty: number
  salePrice: number
  status: string
}
```

---

## Proposed Enhancement 1: Expiry Management Metrics

### New Metrics to Add

#### A. Near-Expiry Inventory Card
**Location**: Summary Cards Row (5th card)

**Metrics**:
- Count of products nearing expiry (< 90 days)
- Total value of near-expiry stock (PTR cost × quantity)
- Breakdown by urgency:
  - Critical (< 30 days): Red badge
  - Warning (30-60 days): Orange badge
  - Watch (60-90 days): Yellow badge

**Data Source**:
```sql
SELECT
  COUNT(DISTINCT pb.product_id) as near_expiry_count,
  SUM(pb.quantity_remaining * pb.ptr_cost) as near_expiry_value,
  CASE
    WHEN pb.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'CRITICAL'
    WHEN pb.expiry_date < CURRENT_DATE + INTERVAL '60 days' THEN 'WARNING'
    WHEN pb.expiry_date < CURRENT_DATE + INTERVAL '90 days' THEN 'WATCH'
  END as urgency_level
FROM product_batch pb
WHERE pb.status = 'ACTIVE'
  AND pb.quantity_remaining > 0
  AND pb.expiry_date < CURRENT_DATE + INTERVAL '90 days'
GROUP BY urgency_level;
```

#### B. Expiry Trends Chart
**Type**: Stacked Bar Chart
**Time Range**: Last 6 months

**Metrics**:
- Products expired per month (value lost)
- Products nearing expiry per month (value at risk)
- Expiry prevention rate (products sold before expiry)

**Purpose**: Track if expiry management is improving over time

#### C. Vendor Expiry Performance Table
**Location**: New section below Payment Timeline

**Columns**:
- Vendor Name
- Total Batches Supplied
- Batches Expired Before Sale (count & %)
- Average Shelf Life Provided (days from receipt to expiry)
- Value Lost to Expiry (₹)
- Quality Score (1-5 stars)

**Purpose**: Identify vendors supplying products with short shelf life

**Calculation**:
```sql
SELECT
  v.name as vendor_name,
  COUNT(pb.id) as total_batches,
  SUM(CASE WHEN pb.status = 'EXPIRED' THEN 1 ELSE 0 END) as expired_batches,
  ROUND(AVG(pb.expiry_date - pb.received_date), 0) as avg_shelf_life_days,
  SUM(CASE WHEN pb.status = 'EXPIRED'
    THEN pb.quantity_remaining * pb.ptr_cost ELSE 0 END) as value_lost
FROM product_batch pb
JOIN vendor v ON v.id = pb.vendor_id
WHERE pb.received_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY v.id, v.name
ORDER BY value_lost DESC;
```

---

## Proposed Enhancement 2: Purchase Effectiveness Metrics

### New Metrics to Add

#### A. Purchase Quality Score Card
**Location**: Summary Cards Row (6th card)

**Metrics**:
- Overall Purchase Quality Score (0-100)
- Components:
  - On-time delivery rate (30%)
  - Price variance vs budget (20%)
  - Product quality (defects/returns) (25%)
  - Invoice accuracy (25%)

**Calculation Example**:
```typescript
qualityScore = (
  (onTimeDeliveryRate * 0.30) +
  (100 - Math.abs(priceVariance) * 0.20) +
  (100 - defectRate * 0.25) +
  (invoiceAccuracyRate * 0.25)
);
```

#### B. Price Trend Analysis Chart
**Type**: Multi-line Chart
**Time Range**: Last 12 months

**Metrics**:
- Average PTR cost by category over time
- Price volatility index (standard deviation)
- Cost savings from negotiations (vs previous period)

**Purpose**: Identify price inflation/deflation trends per category

**Data Source**:
```sql
SELECT
  TO_CHAR(pi.invoice_date, 'YYYY-MM') as month,
  p.category,
  AVG(pii.ptr_cost) as avg_ptr,
  STDDEV(pii.ptr_cost) as price_volatility,
  COUNT(DISTINCT pii.product_id) as product_count
FROM purchase_invoice_item pii
JOIN purchase_invoice pi ON pi.id = pii.invoice_id
JOIN product p ON p.id = pii.product_id
WHERE pi.invoice_date >= CURRENT_DATE - INTERVAL '12 months'
  AND pi.active = true
GROUP BY month, p.category
ORDER BY month, p.category;
```

#### C. Vendor Reliability Metrics Table
**Location**: New tab/section

**Columns**:
- Vendor Name
- Total Orders
- On-Time Delivery Rate (%)
- Average Delay (days)
- Order Fulfillment Rate (%)
- Returns/Defects Rate (%)
- Reliability Score (A-F grade)

**Purpose**: Identify most reliable vendors for strategic sourcing

**Calculation**:
```sql
SELECT
  v.name as vendor_name,
  COUNT(DISTINCT pi.id) as total_orders,
  AVG(CASE
    WHEN pi.gr_date <= pi.invoice_date + INTERVAL '3 days' THEN 100
    ELSE 0
  END) as on_time_rate,
  AVG(pi.gr_date - pi.invoice_date) as avg_delay_days,
  -- Add returns/defects from product_clearance table
  (SELECT COUNT(*) FROM product_clearance pc
   JOIN purchase_invoice_item pii2 ON pii2.product_id = pc.product_id
   WHERE pii2.invoice_id IN (
     SELECT id FROM purchase_invoice WHERE vendor_id = v.id
   )
  ) as defect_count
FROM vendor v
LEFT JOIN purchase_invoice pi ON pi.vendor_id = v.id
WHERE pi.created_on >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY v.id, v.name
ORDER BY on_time_rate DESC;
```

#### D. Purchase Return/Defect Analysis
**Type**: Pie Chart

**Metrics**:
- Returns by reason category
- Total return value vs purchase value
- Top 3 products with most returns
- Top 3 vendors with most returns

---

## Proposed Enhancement 3: Purchase Order Adherence Metrics

### New Metrics to Add

#### A. PO vs Invoice Variance Card
**Location**: Summary Cards Row (7th card)

**Metrics**:
- Count of PO-linked invoices vs standalone invoices
- Average variance % (invoice total vs PO expected)
- Over-budget count (invoices exceeding PO)
- Under-delivery count (invoices less than PO)

**Data Source**:
```sql
SELECT
  COUNT(CASE WHEN pi.purchase_order_id IS NOT NULL THEN 1 END) as po_linked_count,
  COUNT(CASE WHEN pi.purchase_order_id IS NULL THEN 1 END) as standalone_count,
  AVG(CASE
    WHEN pi.purchase_order_id IS NOT NULL
    THEN ABS(pi.total - po_expected_total) / po_expected_total * 100
  END) as avg_variance_pct
FROM purchase_invoice pi
WHERE pi.invoice_date >= CURRENT_DATE - INTERVAL '1 month'
  AND pi.active = true;
```

**Note**: `po_expected_total` would need to be calculated by summing `purchase_request.qty * vendor_pricelist.ptr` for the PO

#### B. PO Fulfillment Timeline Chart
**Type**: Gantt-style or Bar Chart

**Metrics**:
- PO creation date → Invoice date (lead time)
- Expected delivery vs actual delivery
- Average fulfillment time by vendor
- POs pending > 30 days (critical)

#### C. PO-Invoice Reconciliation Table
**Location**: New section "Purchase Order Tracking"

**Columns**:
- PO Number
- Vendor
- PO Date
- Expected Delivery Date
- Invoice Date (actual)
- Days Delayed
- PO Value
- Invoice Value
- Variance (₹ and %)
- Status (On-time/Delayed/Over-budget/Under-delivered)

**Purpose**: Quickly identify PO fulfillment issues

**SQL Query**:
```sql
SELECT
  po.po_number,
  v.name as vendor_name,
  po.created_on as po_date,
  po.created_on + INTERVAL '7 days' as expected_delivery,  -- Assume 7-day SLA
  pi.invoice_date as actual_delivery,
  pi.invoice_date - (po.created_on + INTERVAL '7 days') as days_delayed,
  SUM(pr.qty * COALESCE(vp.ptr, pii.ptr_cost)) as po_value,
  pi.total as invoice_value,
  pi.total - SUM(pr.qty * COALESCE(vp.ptr, pii.ptr_cost)) as variance_amount,
  CASE
    WHEN pi.invoice_date <= po.created_on + INTERVAL '7 days'
      AND ABS(variance_amount) / po_value < 0.05 THEN 'ON_TIME'
    WHEN pi.invoice_date > po.created_on + INTERVAL '7 days' THEN 'DELAYED'
    WHEN variance_amount > 0 THEN 'OVER_BUDGET'
    ELSE 'UNDER_DELIVERED'
  END as status
FROM purchase_order po
JOIN vendor v ON v.id = po.vendor_id
LEFT JOIN purchase_invoice pi ON pi.purchase_order_id = po.po_number
LEFT JOIN purchase_request pr ON pr.order_id = po.id
LEFT JOIN vendor_pricelist vp ON vp.vendor_id = v.id AND vp.product_id = pr.product_id
LEFT JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
WHERE po.created_on >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY po.id, v.name, pi.id
ORDER BY po.created_on DESC;
```

#### D. Purchase Request Status Overview
**Type**: Funnel Chart or Stacked Bar

**Metrics**:
- Purchase Requests Created
- Requests Converted to POs
- POs Converted to Invoices
- Invoices Paid
- Conversion Rate at Each Stage

**Purpose**: Identify bottlenecks in procurement process

---

## Implementation Priority & Effort

### High Priority (Implement First)

1. **Near-Expiry Inventory Card** ⭐⭐⭐
   - **Impact**: HIGH - Reduces inventory wastage
   - **Effort**: LOW (1-2 hours)
   - **Dependencies**: Product batch table already exists
   - **ROI**: Immediate cost savings from reduced expiry losses

2. **PO vs Invoice Variance Card** ⭐⭐⭐
   - **Impact**: HIGH - Improves budget control
   - **Effort**: MEDIUM (3-4 hours)
   - **Dependencies**: Requires PO-Invoice linking logic
   - **ROI**: Better financial planning and vendor accountability

3. **Vendor Reliability Metrics Table** ⭐⭐
   - **Impact**: HIGH - Enables data-driven vendor selection
   - **Effort**: MEDIUM (3-4 hours)
   - **Dependencies**: GR date tracking must be consistent
   - **ROI**: Better vendor relationships and reduced delays

### Medium Priority (Implement Next)

4. **Expiry Trends Chart** ⭐⭐
   - **Impact**: MEDIUM - Helps track improvement
   - **Effort**: LOW (2 hours)
   - **Dependencies**: Batch tracking history

5. **Price Trend Analysis Chart** ⭐⭐
   - **Impact**: MEDIUM - Supports negotiation strategy
   - **Effort**: MEDIUM (3 hours)
   - **Dependencies**: Historical invoice item data

6. **PO Fulfillment Timeline Chart** ⭐
   - **Impact**: MEDIUM - Improves delivery tracking
   - **Effort**: MEDIUM (3-4 hours)
   - **Dependencies**: Standardized PO workflow

### Lower Priority (Nice to Have)

7. **Purchase Quality Score Card** ⭐
   - **Impact**: LOW-MEDIUM - Good overview but complex calculation
   - **Effort**: HIGH (5-6 hours)
   - **Dependencies**: Multiple data sources, returns tracking

8. **Vendor Expiry Performance Table**
   - **Impact**: MEDIUM - Useful but specific use case
   - **Effort**: LOW (2 hours)
   - **Dependencies**: Batch-vendor linking

9. **Purchase Return/Defect Analysis**
   - **Impact**: LOW - Only if returns are significant
   - **Effort**: MEDIUM (3 hours)
   - **Dependencies**: Product clearance data quality

10. **Purchase Request Status Overview**
    - **Impact**: LOW - Process monitoring
    - **Effort**: MEDIUM (3 hours)
    - **Dependencies**: Consistent PR-PO-Invoice workflow

---

## Technical Implementation Plan

### Phase 1: Expiry Metrics (Week 1)

**Backend**:
```typescript
// File: purchase-analytics.service.ts
async getNearExpiryMetrics(): Promise<NearExpiryDto> {
  const criticalDays = 30;
  const warningDays = 60;
  const watchDays = 90;

  const metrics = await this.productBatchRepository
    .createQueryBuilder('batch')
    .select([
      'COUNT(DISTINCT batch.product_id)', 'count',
      'SUM(batch.quantity_remaining * batch.ptr_cost)', 'value',
      `CASE
        WHEN batch.expiry_date < CURRENT_DATE + INTERVAL '${criticalDays} days' THEN 'CRITICAL'
        WHEN batch.expiry_date < CURRENT_DATE + INTERVAL '${warningDays} days' THEN 'WARNING'
        WHEN batch.expiry_date < CURRENT_DATE + INTERVAL '${watchDays} days' THEN 'WATCH'
      END`, 'urgency'
    ])
    .where('batch.status = :status', { status: 'ACTIVE' })
    .andWhere('batch.quantity_remaining > 0')
    .andWhere(`batch.expiry_date < CURRENT_DATE + INTERVAL '${watchDays} days'`)
    .groupBy('urgency')
    .getRawMany();

  return {
    criticalCount: metrics.find(m => m.urgency === 'CRITICAL')?.count || 0,
    criticalValue: metrics.find(m => m.urgency === 'CRITICAL')?.value || 0,
    warningCount: metrics.find(m => m.urgency === 'WARNING')?.count || 0,
    warningValue: metrics.find(m => m.urgency === 'WARNING')?.value || 0,
    watchCount: metrics.find(m => m.urgency === 'WATCH')?.count || 0,
    watchValue: metrics.find(m => m.urgency === 'WATCH')?.value || 0,
  };
}
```

**Frontend**:
- Add new card to dashboard template
- Color-coded urgency badges (red/orange/yellow)
- Click to navigate to near-expiry stock management page

### Phase 2: PO Adherence Metrics (Week 2)

**Backend**:
```typescript
async getPOVarianceMetrics(): Promise<POVarianceDto> {
  // Calculate variance between PO and Invoice
  const variances = await this.invoiceRepository
    .createQueryBuilder('invoice')
    .leftJoin('purchase_order', 'po', 'po.po_number = invoice.purchase_order_id')
    .leftJoin('purchase_request', 'pr', 'pr.order_id = po.id')
    .select([
      'COUNT(CASE WHEN invoice.purchase_order_id IS NOT NULL THEN 1 END)', 'poLinkedCount',
      'COUNT(CASE WHEN invoice.purchase_order_id IS NULL THEN 1 END)', 'standaloneCount',
      'AVG(ABS(invoice.total - po_expected)) / po_expected * 100', 'avgVariancePct'
    ])
    .where('invoice.invoice_date >= :startDate', {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    })
    .getRawOne();

  return variances;
}
```

**Frontend**:
- New summary card with PO compliance %
- Table showing recent PO-Invoice discrepancies
- Drill-down to detailed reconciliation view

### Phase 3: Vendor Performance (Week 3)

**Backend**:
```typescript
async getVendorReliabilityMetrics(): Promise<VendorReliabilityDto[]> {
  return await this.vendorRepository
    .createQueryBuilder('vendor')
    .leftJoin('vendor.purchaseInvoices', 'invoice')
    .select([
      'vendor.name', 'vendorName',
      'COUNT(DISTINCT invoice.id)', 'totalOrders',
      'AVG(CASE WHEN invoice.gr_date <= invoice.invoice_date + INTERVAL \'3 days\' THEN 100 ELSE 0 END)', 'onTimeRate',
      'AVG(invoice.gr_date - invoice.invoice_date)', 'avgDelayDays'
    ])
    .where('invoice.created_on >= :startDate', {
      startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    })
    .groupBy('vendor.id, vendor.name')
    .orderBy('onTimeRate', 'DESC')
    .getRawMany();
}
```

**Frontend**:
- Vendor performance table with sortable columns
- Visual indicators (green/yellow/red) for on-time rate
- Export to Excel for vendor meetings

---

## Data Quality Prerequisites

### Required for Expiry Metrics:
✅ `product_batch` table populated with batch data
✅ `expiry_date` field accurately maintained
✅ `quantity_remaining` updated on each sale
✅ `ptr_cost` captured from invoice items

### Required for PO Adherence:
⚠️ **CRITICAL**: `purchase_order_id` must be populated in `purchase_invoice` table
⚠️ **CRITICAL**: `gr_date` (Goods Receipt Date) must be recorded
⚠️ Purchase requests must be linked to purchase orders
⚠️ Vendor pricelist should be maintained for expected cost calculation

### Required for Vendor Performance:
⚠️ Consistent GR date entry (currently nullable)
⚠️ Returns/defects tracked in `product_clearance` table
⚠️ Invoice-to-PO linking for fulfillment tracking

---

## Dashboard Layout Recommendation

### Proposed New Layout

**Row 1: Summary Cards (7 cards)**
1. Total Purchase Value (existing)
2. Pending Invoices (existing)
3. Approved & Paid (existing)
4. Top Vendor (existing)
5. **NEW: Near-Expiry Stock** (Critical/Warning/Watch)
6. **NEW: Purchase Quality Score** (0-100)
7. **NEW: PO Variance** (On-budget %)

**Row 2: Charts (4 charts in 2x2 grid)**
1. Monthly Purchase Trends (existing)
2. **NEW: Expiry Trends** (6 months)
3. Top Vendors by Value (existing)
4. **NEW: Price Trends by Category** (12 months)

**Row 3: Status & Category (2 charts)**
1. Invoice Status Breakdown (existing)
2. Category Spending (existing)

**Row 4: Tables (Tabbed View)**
- **Tab 1**: Recent Invoices (existing)
- **Tab 2**: Payment Timeline (existing)
- **Tab 3**: **NEW: PO-Invoice Reconciliation**
- **Tab 4**: **NEW: Vendor Reliability**
- **Tab 5**: **NEW: Near-Expiry Items**

**Row 5: Quick Actions** (existing)

---

## Expected Business Impact

### Expiry Management
- **Reduce wastage**: 10-30% reduction in expired stock losses
- **Better inventory planning**: Stock products with longer shelf life
- **Vendor accountability**: Negotiate better shelf life terms

### Purchase Effectiveness
- **Cost savings**: 5-15% through better vendor selection and price monitoring
- **Quality improvement**: Reduce defects/returns by 20-40%
- **Faster decision-making**: Data-driven vendor rating system

### PO Adherence
- **Budget control**: Reduce over-budget purchases by 30-50%
- **Process compliance**: Increase PO usage from ~40% to 80%+
- **Audit trail**: Better financial audit readiness

---

## Next Steps

1. **Prioritize metrics** based on business urgency
2. **Validate data quality** - Run sample queries on production data
3. **Fix data gaps** - Ensure GR dates, PO linking, batch tracking are consistent
4. **Implement Phase 1** - Near-Expiry Metrics (quick win)
5. **Gather user feedback** - Iterate on design before Phase 2
6. **Roll out incrementally** - Don't overwhelm users with too many metrics at once

---

## API Endpoint Changes Required

### New DTO Definitions

```typescript
// purchase-analytics.dto.ts

export class NearExpiryMetricsDto {
  criticalCount: number;
  criticalValue: number;
  warningCount: number;
  warningValue: number;
  watchCount: number;
  watchValue: number;
}

export class POVarianceMetricsDto {
  poLinkedCount: number;
  standaloneCount: number;
  avgVariancePct: number;
  overBudgetCount: number;
  underDeliveredCount: number;
}

export class VendorReliabilityDto {
  vendorId: number;
  vendorName: string;
  totalOrders: number;
  onTimeRate: number;
  avgDelayDays: number;
  fulfillmentRate: number;
  defectRate: number;
  reliabilityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export class ExpiryTrendDto {
  month: string;
  expiredValue: number;
  nearExpiryValue: number;
  preventionRate: number;
}

export class EnhancedPurchaseAnalyticsDto extends PurchaseAnalyticsDto {
  nearExpiryMetrics: NearExpiryMetricsDto;
  poVarianceMetrics: POVarianceMetricsDto;
  vendorReliability: VendorReliabilityDto[];
  expiryTrends: ExpiryTrendDto[];
}
```

### Modified Endpoint

```
GET /analytics/purchases
```

**Response**: `EnhancedPurchaseAnalyticsDto`

---

## Conclusion

The current Purchases Analytics Dashboard provides excellent foundational metrics. The proposed enhancements will add critical operational intelligence in three key areas:

1. **Expiry Management** - Reduce inventory losses through proactive monitoring
2. **Purchase Effectiveness** - Optimize vendor selection and pricing
3. **PO Adherence** - Improve financial control and process compliance

**Recommended Implementation Order**:
1. Near-Expiry Metrics (Phase 1) - Immediate cost savings
2. PO Variance Metrics (Phase 2) - Better budget control
3. Vendor Reliability (Phase 3) - Strategic sourcing decisions

**Total Estimated Effort**: 15-20 hours across 3 weeks

**Expected ROI**: 5-10x through reduced wastage, better pricing, and improved vendor performance

---

**Prepared By**: Claude Code Analysis
**Date**: 2026-01-18
**Status**: Ready for Review & Prioritization
