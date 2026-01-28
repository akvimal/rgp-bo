# Products Analytics Dashboard - Implementation Plan

**Date**: 2026-01-18
**Priority**: HIGH
**Estimated Effort**: 4-6 hours
**Status**: ✅ DTO Created, 🔄 In Progress

---

## Executive Summary

Create a comprehensive Products Analytics Dashboard to provide real-time insights into:
- Inventory health and stock levels
- Product performance and profitability
- Category-wise analysis
- Pricing trends and margin distribution
- Stock alerts and near-expiry warnings

---

## Dashboard Metrics Overview

### Summary Cards (Row 1)
1. **Total Active Products** - Count of active products with icon
2. **Total Stock Value** - Inventory value at cost (₹)
3. **Average Margin** - Overall profitability percentage
4. **Low Stock Alerts** - Count of products below reorder level

### Charts (Row 2)
1. **Top 10 Products by Revenue** - Horizontal bar chart (last 30 days)
2. **Category Performance** - Pie chart (revenue distribution)
3. **Stock Status Distribution** - Doughnut chart (In Stock, Low Stock, Out of Stock, Expired)
4. **Margin Distribution by Category** - Bar chart (min/avg/max margins)

### Data Tables (Row 3)
1. **Top Sellers** - Last 30 days with revenue, qty sold, margin
2. **Low Stock Alerts** - Products needing reorder with days until stockout
3. **Near-Expiry Products** - Leverage existing batch data (30/60/90 days)
4. **Recent Price Changes** - Last 30 days with old/new prices and change %

### Quick Actions
- Add New Product
- Update Prices
- View Full Inventory
- Manage HSN Codes

---

## Backend Implementation

### 1. DTO Structure (✅ COMPLETED)

**File**: `api-v2/src/modules/app/products/dto/product-analytics.dto.ts`

Created DTOs:
- `ProductSummaryDto` - 8 summary metrics
- `TopProductDto` - Top products by revenue
- `CategoryPerformanceDto` - Category-level analysis
- `StockStatusDto` - Stock status distribution
- `MarginDistributionDto` - Margin analysis by category
- `LowStockAlertDto` - Products needing reorder
- `PriceChangeDto` - Recent price changes
- `ProductAnalyticsDto` - Main response container

### 2. Analytics Service

**File**: `api-v2/src/modules/app/products/product-analytics.service.ts` (NEW)

**Methods to Implement**:

```typescript
@Injectable()
export class ProductAnalyticsService {

  // Main orchestrator
  async getAnalytics(): Promise<ProductAnalyticsDto>

  // Summary metrics
  private async getSummary(): Promise<ProductSummaryDto>

  // Top products by revenue (last 30 days)
  private async getTopProducts(): Promise<TopProductDto[]>

  // Category performance
  private async getCategoryPerformance(): Promise<CategoryPerformanceDto[]>

  // Stock status distribution
  private async getStockStatus(): Promise<StockStatusDto[]>

  // Margin distribution
  private async getMarginDistribution(): Promise<MarginDistributionDto[]>

  // Low stock alerts
  private async getLowStockAlerts(): Promise<LowStockAlertDto[]>

  // Recent price changes
  private async getRecentPriceChanges(): Promise<PriceChangeDto[]>
}
```

**Key SQL Queries**:

#### A. Summary Metrics
```sql
-- Total active products
SELECT COUNT(*) FROM product WHERE active = true AND archive = false;

-- Total stock value (at PTR cost)
SELECT SUM(pb.quantity_remaining * pb.ptr_cost)
FROM product_batch pb
WHERE pb.status = 'ACTIVE';

-- Average margin from product_price2
SELECT AVG(margin_pcnt) FROM product_price2 WHERE active = true;

-- Low stock count (using product_sale_agg_view)
SELECT COUNT(*)
FROM product_items_view piv
JOIN product_sale_agg_view psav ON psav.product_id = piv.product_id
WHERE piv.balance < (psav.avg_sales_qty * 7); -- 7 days of stock

-- Near-expiry count (reuse from batch service)
SELECT COUNT(DISTINCT product_id) FROM product_batch
WHERE expiry_date < CURRENT_DATE + INTERVAL '90 days'
  AND status = 'ACTIVE';
```

#### B. Top Products by Revenue
```sql
SELECT
  p.id as product_id,
  p.title as product_title,
  p.category,
  SUM(si.qty * si.price) as total_revenue,
  SUM(si.qty) as qty_sold,
  AVG(si.price) as average_price,
  AVG((si.price - si.ptr_cost) / si.ptr_cost * 100) as margin_percentage
FROM sale_item si
JOIN product p ON p.id = si.product_id
JOIN sale s ON s.id = si.sale_id
WHERE s.bill_dt >= CURRENT_DATE - INTERVAL '30 days'
  AND s.active = true
GROUP BY p.id, p.title, p.category
ORDER BY total_revenue DESC
LIMIT 10;
```

#### C. Category Performance
```sql
SELECT
  p.category,
  COUNT(DISTINCT p.id) as product_count,
  COALESCE(SUM(si.qty * si.price), 0) as total_revenue,
  COALESCE(SUM(pb.quantity_remaining * pb.ptr_cost), 0) as stock_value,
  AVG(pp.margin_pcnt) as average_margin
FROM product p
LEFT JOIN sale_item si ON si.product_id = p.id
  AND si.sale_id IN (SELECT id FROM sale WHERE bill_dt >= CURRENT_DATE - INTERVAL '30 days')
LEFT JOIN product_batch pb ON pb.product_id = p.id AND pb.status = 'ACTIVE'
LEFT JOIN product_price2 pp ON pp.product_id = p.id AND pp.active = true
WHERE p.active = true
GROUP BY p.category
ORDER BY total_revenue DESC;
```

#### D. Stock Status Distribution
```sql
WITH stock_levels AS (
  SELECT
    p.id,
    COALESCE(SUM(pb.quantity_remaining), 0) as current_stock,
    COALESCE(psav.avg_sales_qty * 7, 0) as reorder_level
  FROM product p
  LEFT JOIN product_batch pb ON pb.product_id = p.id AND pb.status = 'ACTIVE'
  LEFT JOIN product_sale_agg_view psav ON psav.product_id = p.id
  WHERE p.active = true
  GROUP BY p.id, psav.avg_sales_qty
)
SELECT
  CASE
    WHEN current_stock = 0 THEN 'Out of Stock'
    WHEN current_stock < reorder_level THEN 'Low Stock'
    WHEN current_stock >= reorder_level THEN 'In Stock'
  END as status,
  COUNT(*) as count
FROM stock_levels
GROUP BY status;
```

#### E. Margin Distribution by Category
```sql
SELECT
  p.category,
  MIN(pp.margin_pcnt) as min_margin,
  AVG(pp.margin_pcnt) as avg_margin,
  MAX(pp.margin_pcnt) as max_margin,
  COUNT(DISTINCT p.id) as product_count
FROM product p
JOIN product_price2 pp ON pp.product_id = p.id AND pp.active = true
WHERE p.active = true
GROUP BY p.category
ORDER BY avg_margin DESC;
```

#### F. Low Stock Alerts
```sql
SELECT
  p.id as product_id,
  p.title as product_title,
  p.category,
  COALESCE(SUM(pb.quantity_remaining), 0) as current_stock,
  COALESCE(psav.avg_sales_qty * 7, 0) as reorder_level,
  COALESCE(psav.avg_sales_qty, 0) as avg_monthly_sales,
  CASE
    WHEN psav.avg_sales_qty > 0
    THEN FLOOR(COALESCE(SUM(pb.quantity_remaining), 0) / (psav.avg_sales_qty / 30))
    ELSE 999
  END as days_until_stockout
FROM product p
LEFT JOIN product_batch pb ON pb.product_id = p.id AND pb.status = 'ACTIVE'
LEFT JOIN product_sale_agg_view psav ON psav.product_id = p.id
WHERE p.active = true
GROUP BY p.id, p.title, p.category, psav.avg_sales_qty
HAVING COALESCE(SUM(pb.quantity_remaining), 0) < COALESCE(psav.avg_sales_qty * 7, 0)
ORDER BY days_until_stockout ASC
LIMIT 20;
```

#### G. Recent Price Changes
```sql
SELECT
  p.id as product_id,
  p.title as product_title,
  pp.base_price as old_price,
  pp.sale_price as new_price,
  ((pp.sale_price - pp.base_price) / pp.base_price * 100) as change_percentage,
  pp.eff_date as effective_date,
  pp.reason
FROM product_price2 pp
JOIN product p ON p.id = pp.product_id
WHERE pp.eff_date >= CURRENT_DATE - INTERVAL '30 days'
  AND pp.active = true
ORDER BY pp.eff_date DESC
LIMIT 20;
```

### 3. Analytics Controller

**File**: `api-v2/src/modules/app/products/product-analytics.controller.ts` (NEW)

```typescript
@ApiTags('Product Analytics')
@Controller('analytics/products')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ProductAnalyticsController {
  constructor(
    private readonly analyticsService: ProductAnalyticsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get comprehensive product analytics' })
  @ApiResponse({
    status: 200,
    description: 'Returns product analytics including summary, performance, and alerts',
    type: ProductAnalyticsDto,
  })
  async getAnalytics(): Promise<ProductAnalyticsDto> {
    return this.analyticsService.getAnalytics();
  }
}
```

### 4. Module Configuration

**File**: `api-v2/src/modules/app/products/product.module.ts` (MODIFY)

Add to imports/exports:
- `ProductAnalyticsService` → providers
- `ProductAnalyticsController` → controllers
- Import `StockModule` for batch data access

---

## Frontend Implementation

### 1. Analytics Service Interface

**File**: `frontend/src/app/secured/products/services/product-analytics.service.ts` (NEW)

```typescript
export interface ProductSummary {
  totalActiveProducts: number;
  totalStockValue: number;
  averageMargin: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryCount: number;
  nearExpiryCount: number;
  deadStockCount: number;
}

export interface TopProduct {
  productId: number;
  productTitle: string;
  category: string;
  totalRevenue: number;
  qtySold: number;
  averagePrice: number;
  marginPercentage: number;
}

// ... other interfaces matching DTOs

export interface ProductAnalytics {
  summary: ProductSummary;
  topProducts: TopProduct[];
  categoryPerformance: CategoryPerformance[];
  stockStatus: StockStatus[];
  marginDistribution: MarginDistribution[];
  lowStockAlerts: LowStockAlert[];
  recentPriceChanges: PriceChange[];
}

@Injectable({ providedIn: 'root' })
export class ProductAnalyticsService {
  private apiUrl = `${environment.apiHost}/analytics/products`;

  constructor(private http: HttpClient) {}

  getAnalytics(): Observable<ProductAnalytics> {
    return this.http.get<ProductAnalytics>(this.apiUrl);
  }
}
```

### 2. Dashboard Component

**Files**:
- `frontend/src/app/secured/products/dashboard/products-dashboard.component.ts` (NEW)
- `frontend/src/app/secured/products/dashboard/products-dashboard.component.html` (NEW)
- `frontend/src/app/secured/products/dashboard/products-dashboard.component.scss` (NEW)

**Component Structure**:
```typescript
@Component({
  selector: 'app-products-dashboard',
  templateUrl: './products-dashboard.component.html',
  styleUrls: ['./products-dashboard.component.scss']
})
export class ProductsDashboardComponent implements OnInit {
  analytics: ProductAnalytics | null = null;
  loading = true;
  error: string | null = null;

  // Chart configurations (similar to purchases dashboard)
  public barChartOptions: ChartConfiguration['options'] = { /* ... */ };
  public pieChartOptions: ChartConfiguration['options'] = { /* ... */ };
  public doughnutChartOptions: ChartConfiguration['options'] = { /* ... */ };

  // Chart data
  public topProductsData: ChartData<'bar'> = { labels: [], datasets: [] };
  public categoryPerformanceData: ChartData<'pie'> = { labels: [], datasets: [] };
  public stockStatusData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  public marginDistributionData: ChartData<'bar'> = { labels: [], datasets: [] };

  constructor(
    private analyticsService: ProductAnalyticsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void { /* ... */ }
  prepareChartData(): void { /* ... */ }
  formatCurrency(value: number): string { /* ... */ }
  navigateToProductList(): void { /* ... */ }
  navigateToNewProduct(): void { /* ... */ }
  navigateToPricing(): void { /* ... */ }
  navigateToHSN(): void { /* ... */ }
  navigateToNearExpiry(): void { /* ... */ }
  // ... other methods
}
```

### 3. Template Structure

**Layout**:
```html
<!-- Summary Cards Row -->
<div class="row mb-4">
  <div class="col-xl-3 col-md-6 mb-4">
    <!-- Total Active Products Card -->
  </div>
  <div class="col-xl-3 col-md-6 mb-4">
    <!-- Total Stock Value Card -->
  </div>
  <div class="col-xl-3 col-md-6 mb-4">
    <!-- Average Margin Card -->
  </div>
  <div class="col-xl-3 col-md-6 mb-4">
    <!-- Low Stock Alerts Card -->
  </div>
</div>

<!-- Charts Row -->
<div class="row mb-4">
  <div class="col-xl-6 mb-4">
    <!-- Top 10 Products Chart -->
  </div>
  <div class="col-xl-6 mb-4">
    <!-- Category Performance Chart -->
  </div>
</div>

<div class="row mb-4">
  <div class="col-xl-6 mb-4">
    <!-- Stock Status Distribution Chart -->
  </div>
  <div class="col-xl-6 mb-4">
    <!-- Margin Distribution Chart -->
  </div>
</div>

<!-- Data Tables Row -->
<div class="row mb-4">
  <div class="col-xl-6 mb-4">
    <!-- Top Sellers Table -->
  </div>
  <div class="col-xl-6 mb-4">
    <!-- Low Stock Alerts Table -->
  </div>
</div>

<div class="row mb-4">
  <div class="col-xl-6 mb-4">
    <!-- Near-Expiry Products Table -->
  </div>
  <div class="col-xl-6 mb-4">
    <!-- Recent Price Changes Table -->
  </div>
</div>

<!-- Quick Actions -->
<div class="row mb-4">
  <div class="col-12">
    <!-- Quick Action Buttons -->
  </div>
</div>
```

### 4. Routing Configuration

**File**: `frontend/src/app/secured/products/products.module.ts` (MODIFY)

Update routes:
```typescript
const routes: Routes = [
  { path: '', component: ProductsComponent,
    children: [
      { path: '', redirectTo: 'dashboard'},  // ✅ Change default
      { path: 'dashboard', component: ProductsDashboardComponent },  // ✅ NEW
      { path: 'master', children: [
        { path: '', redirectTo: 'list'},
        { path: 'list', component: ProductListComponent, canActivate:[AuthGuard]},
        { path: 'new', component: ProductFormComponent, canActivate:[AuthGuard]},
        { path: 'edit/:id', component: ProductFormComponent, canActivate:[AuthGuard]}
      ]},
      { path: 'price', component: ProductPriceComponent, canActivate:[AuthGuard]},
      { path: 'hsn', children: [
        { path: '', component: HsnListComponent, canActivate:[AuthGuard]},
        { path: 'new', component: HsnFormComponent, canActivate:[AuthGuard]},
        { path: 'edit/:id', component: HsnFormComponent, canActivate:[AuthGuard]}
      ]}
  ]},
];
```

Add to declarations:
```typescript
declarations: [
  // ... existing
  ProductsDashboardComponent  // ✅ NEW
],
```

Add to imports:
```typescript
imports: [
  // ... existing
  NgChartsModule  // ✅ NEW (for charts)
],
```

### 5. Navigation Header

**File**: `frontend/src/app/secured/products/components/product-header.component.html` (MODIFY)

Add Dashboard tab:
```html
<ul class="nav">
  <li class="nav-item" [routerLinkActive]="['is-active']" *isNavAuth>
    <a class="nav-link" routerLink="/secure/products/dashboard">
      <i class="bi bi-speedometer2"></i> Dashboard
    </a>
  </li>
  <li class="nav-item" [routerLinkActive]="['is-active']" *isNavAuth>
    <a class="nav-link" routerLink="/secure/products/master">Master</a>
  </li>
  <!-- ... existing tabs -->
</ul>
```

---

## Data Sources & Dependencies

### Existing Services to Leverage
1. **ProductService** - Core product CRUD
2. **BatchAllocationService** - For near-expiry data
3. **Database Views**:
   - `product_items_view` - Stock balances
   - `product_sale_agg_view` - Sales aggregates
   - `price_view` - Current pricing with margins
   - `stock_view` - Comprehensive stock status

### New Dependencies
- `NgChartsModule` (already installed in frontend)
- No new backend dependencies needed

---

## Implementation Priority

### Phase 1: Core Analytics (High Priority)
1. ✅ Create DTOs
2. ⏳ Create ProductAnalyticsService
3. ⏳ Create ProductAnalyticsController
4. ⏳ Update ProductModule

### Phase 2: Frontend Dashboard (High Priority)
5. ⏳ Create frontend analytics service
6. ⏳ Create dashboard component (TS, HTML, SCSS)
7. ⏳ Update routing
8. ⏳ Add navigation tab

### Phase 3: Testing & Refinement (Medium Priority)
9. ⏳ Test all metrics accuracy
10. ⏳ Performance optimization
11. ⏳ UI/UX refinements
12. ⏳ Documentation

---

## Expected Business Impact

### Inventory Management
- **Better Stock Planning**: Reduce stockouts by 30-40%
- **Reduced Holding Costs**: Identify slow-movers and dead stock
- **Expiry Management**: Proactive alerts reduce wastage

### Profitability
- **Margin Optimization**: Identify low-margin products for repricing
- **Category Insights**: Focus on high-profit categories
- **Pricing Strategy**: Data-driven pricing decisions

### Operational Efficiency
- **Faster Decision Making**: All key metrics in one view
- **Reorder Automation**: Clear signals for purchase orders
- **Performance Tracking**: Monitor product and category performance

---

## Success Metrics

### Week 1
- Dashboard accessible and loading correctly
- All summary metrics displaying accurately
- Charts rendering with real data

### Month 1
- 50% reduction in stockout incidents
- 20% improvement in margin visibility
- User adoption: 80%+ of product managers using dashboard

---

## Next Steps

1. ✅ DTOs created
2. **NEXT**: Implement ProductAnalyticsService with all query methods
3. Create controller and wire up module
4. Build frontend components
5. Test with real data
6. Deploy and gather feedback

---

**Status**: Ready for implementation
**Priority**: HIGH - Complements purchases dashboard
**Estimated Completion**: 2026-01-18 (same day)
