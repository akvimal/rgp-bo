# Smart Purchase Order Implementation Roadmap

**Status**: Phase 1 & 2 Complete (Multi-Store Foundation + Entities)
**Date**: 2025-12-07
**Next**: Phase 3 (Backend Services) → Phase 4 (Frontend UI)

---

## Executive Summary

This document provides a complete roadmap for finishing the **Smart Purchase Order** system that intelligently suggests products for ordering based on:
- **Low Stock Items** - Products below reorder limits (store-specific)
- **Sales Intents** - Pending customer/internal purchase requests
- **Manual Additions** - User can search and add any product
- **Last Vendor Info** - Shows preferred/last vendor for each product

---

## ✅ What's Already Complete

### Phase 1: Multi-Store Foundation
- ✅ Database tables: `tenant`, `store`, `product_store_config`
- ✅ `store_id` added to: `sales_intent`, `purchase_order`, `purchase_invoice`, `sale`
- ✅ Migration: `sql/migrations/016_multi_store_architecture.sql`
- ✅ Default tenant "RGP Pharmacy" (ID: 1)
- ✅ Default store "Main Store" (ID: 1)

### Phase 2: TypeORM Entities
- ✅ `api-v2/src/entities/tenant.entity.ts`
- ✅ `api-v2/src/entities/store.entity.ts` (updated, replaced old orphaned entity)
- ✅ `api-v2/src/entities/product-store-config.entity.ts`
- ✅ `api-v2/src/entities/sales-intent.entity.ts` (added store relation)
- ✅ `api-v2/src/entities/purchase-order.entity.ts` (added store relation)
- ✅ `api-v2/src/entities/purchase-invoice.entity.ts` (added store relation)
- ✅ `api-v2/src/entities/sale.entity.ts` (added store relation)

**Current System State**:
- All existing functionality works
- All data linked to "Main Store" (ID: 1)
- Ready for store-aware features

---

## 🚧 Phase 3: Backend Services (Remaining)

### 3.1 Create Smart PO Suggestions DTO

**File**: `api-v2/src/modules/app/purchases/dto/po-suggestion.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export enum SuggestionReason {
    LOW_STOCK = 'LOW_STOCK',
    SALES_INTENT = 'SALES_INTENT',
    MANUAL = 'MANUAL'
}

export class POSuggestionItemDto {
    @ApiProperty()
    productId: number;

    @ApiProperty()
    productName: string;

    @ApiProperty()
    currentStock: number;

    @ApiProperty()
    reorderLimit: number;

    @ApiProperty()
    suggestedQuantity: number;

    @ApiProperty({ enum: SuggestionReason })
    reason: SuggestionReason;

    @ApiProperty()
    priority: string; // For SALES_INTENT items

    @ApiProperty()
    lastVendorId?: number;

    @ApiProperty()
    lastVendorName?: string;

    @ApiProperty()
    preferredVendorId?: number;

    @ApiProperty()
    preferredVendorName?: string;

    @ApiProperty()
    lastPurchaseDate?: Date;

    @ApiProperty()
    lastPurchasePrice?: number;

    @ApiProperty()
    salesIntentIds?: number[]; // If from sales intent
}

export class POSuggestionsResponseDto {
    @ApiProperty({ type: [POSuggestionItemDto] })
    lowStockItems: POSuggestionItemDto[];

    @ApiProperty({ type: [POSuggestionItemDto] })
    salesIntentItems: POSuggestionItemDto[];

    @ApiProperty()
    storeId: number;

    @ApiProperty()
    storeName: string;

    @ApiProperty()
    totalSuggestions: number;
}
```

---

### 3.2 Update Purchase Service

**File**: `api-v2/src/modules/app/purchases/purchase.service.ts`

**Add method**:

```typescript
async getSmartPOSuggestions(storeId: number): Promise<POSuggestionsResponseDto> {
    const logger = new Logger('PurchaseService');

    try {
        // 1. Get store details
        const store = await this.dataSource.getRepository(Store).findOne({
            where: { id: storeId, active: true }
        });

        if (!store) {
            throw new NotFoundException(`Store with ID ${storeId} not found`);
        }

        // 2. Get low stock items for this store
        const lowStockItems = await this.getLowStockItemsForStore(storeId);

        // 3. Get pending sales intents for this store
        const intentItems = await this.getSalesIntentItemsForStore(storeId);

        return {
            lowStockItems,
            salesIntentItems: intentItems,
            storeId: store.id,
            storeName: store.storeName,
            totalSuggestions: lowStockItems.length + intentItems.length
        };

    } catch (error) {
        logger.error(`Error getting smart PO suggestions for store ${storeId}:`, error.stack);
        throw error;
    }
}

private async getLowStockItemsForStore(storeId: number): Promise<POSuggestionItemDto[]> {
    // Query to find products below reorder limit
    const query = `
        SELECT
            p.id as product_id,
            p.title as product_name,
            psc.reorder_limit,
            psc.preferred_vendor_id,
            psc.optimal_stock_level,
            COALESCE(stock.current_balance, 0) as current_stock,
            CASE
                WHEN psc.optimal_stock_level IS NOT NULL
                THEN psc.optimal_stock_level - COALESCE(stock.current_balance, 0)
                ELSE psc.reorder_limit * 2 - COALESCE(stock.current_balance, 0)
            END as suggested_quantity,
            last_purchase.vendor_id as last_vendor_id,
            last_purchase.vendor_name as last_vendor_name,
            last_purchase.purchase_date as last_purchase_date,
            last_purchase.purchase_price as last_purchase_price,
            pref_vendor.name as preferred_vendor_name
        FROM product p
        INNER JOIN product_store_config psc
            ON psc.product_id = p.id
            AND psc.store_id = $1
            AND psc.active = TRUE
            AND psc.is_available_in_store = TRUE
        LEFT JOIN LATERAL (
            -- Get current stock balance for this store
            -- This is placeholder - needs actual stock aggregation by store
            SELECT 0 as current_balance
        ) stock ON TRUE
        LEFT JOIN LATERAL (
            -- Get last purchase for this product from this store
            SELECT
                pi.vendor_id,
                v.name as vendor_name,
                pi.invoice_date as purchase_date,
                pii.ptr_cost as purchase_price
            FROM purchase_invoice_item pii
            JOIN purchase_invoice pi ON pi.id = pii.invoice_id AND pi.store_id = $1
            JOIN vendor v ON v.id = pi.vendor_id
            WHERE pii.product_id = p.id
            ORDER BY pi.invoice_date DESC
            LIMIT 1
        ) last_purchase ON TRUE
        LEFT JOIN vendor pref_vendor ON pref_vendor.id = psc.preferred_vendor_id
        WHERE p.active = TRUE
          AND COALESCE(stock.current_balance, 0) < psc.reorder_limit
        ORDER BY (psc.reorder_limit - COALESCE(stock.current_balance, 0)) DESC
        LIMIT 100;
    `;

    const results = await this.dataSource.query(query, [storeId]);

    return results.map(row => ({
        productId: row.product_id,
        productName: row.product_name,
        currentStock: row.current_stock,
        reorderLimit: row.reorder_limit,
        suggestedQuantity: Math.max(row.suggested_quantity, 1),
        reason: SuggestionReason.LOW_STOCK,
        priority: null,
        lastVendorId: row.last_vendor_id,
        lastVendorName: row.last_vendor_name,
        preferredVendorId: row.preferred_vendor_id,
        preferredVendorName: row.preferred_vendor_name,
        lastPurchaseDate: row.last_purchase_date,
        lastPurchasePrice: row.last_purchase_price
    }));
}

private async getSalesIntentItemsForStore(storeId: number): Promise<POSuggestionItemDto[]> {
    const intents = await this.dataSource.getRepository(SalesIntent).find({
        where: {
            storeid: storeId,
            status: IntentStatus.PENDING,
            active: true
        },
        relations: ['product'],
        order: {
            priority: 'DESC',
            createdon: 'ASC'
        }
    });

    // Group intents by product
    const productIntentMap = new Map<number, { intents: SalesIntent[], totalQty: number }>();

    for (const intent of intents) {
        const existing = productIntentMap.get(intent.prodid);
        if (existing) {
            existing.intents.push(intent);
            existing.totalQty += intent.requestedqty;
        } else {
            productIntentMap.set(intent.prodid, {
                intents: [intent],
                totalQty: intent.requestedqty
            });
        }
    }

    // Get last vendor for each product
    const suggestions: POSuggestionItemDto[] = [];

    for (const [productId, data] of productIntentMap) {
        const firstIntent = data.intents[0];

        // Get last vendor for this product from this store
        const lastPurchase = await this.dataSource.query(`
            SELECT
                pi.vendor_id,
                v.name as vendor_name,
                pi.invoice_date as purchase_date,
                pii.ptr_cost as purchase_price
            FROM purchase_invoice_item pii
            JOIN purchase_invoice pi ON pi.id = pii.invoice_id AND pi.store_id = $1
            JOIN vendor v ON v.id = pi.vendor_id
            WHERE pii.product_id = $2
            ORDER BY pi.invoice_date DESC
            LIMIT 1
        `, [storeId, productId]);

        suggestions.push({
            productId: productId,
            productName: firstIntent.productname,
            currentStock: null, // Not needed for intent-based suggestions
            reorderLimit: null,
            suggestedQuantity: data.totalQty,
            reason: SuggestionReason.SALES_INTENT,
            priority: firstIntent.priority,
            lastVendorId: lastPurchase[0]?.vendor_id,
            lastVendorName: lastPurchase[0]?.vendor_name,
            lastPurchaseDate: lastPurchase[0]?.purchase_date,
            lastPurchasePrice: lastPurchase[0]?.purchase_price,
            salesIntentIds: data.intents.map(i => i.id)
        });
    }

    return suggestions;
}
```

**Add imports**:
```typescript
import { NotFoundException } from '@nestjs/common';
import { Store } from 'src/entities/store.entity';
import { IntentStatus } from 'src/entities/sales-intent.entity';
import { POSuggestionsResponseDto, POSuggestionItemDto, SuggestionReason } from './dto/po-suggestion.dto';
```

---

### 3.3 Update Purchase Controller

**File**: `api-v2/src/modules/app/purchases/purchase-order.controller.ts`

**Add endpoint**:

```typescript
@Get('/suggestions')
@ApiOperation({ summary: 'Get smart PO suggestions for a store' })
@ApiResponse({ status: 200, description: 'Returns low stock items and sales intent items', type: POSuggestionsResponseDto })
async getSmartPOSuggestions(
    @Query('storeId') storeId: number
) {
    return this.service.getSmartPOSuggestions(storeId);
}
```

**Add imports**:
```typescript
import { Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { POSuggestionsResponseDto } from './dto/po-suggestion.dto';
```

---

## 🚧 Phase 4: Frontend UI (Remaining)

###  4.1 Create Smart PO Component

**File**: `frontend/src/app/secured/purchases/requests/components/purchase-order-smart-create.component.ts`

```typescript
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PurchaseOrderService } from '../purchase-order.service';
import { VendorsService } from '../../vendors/vendors.service';

export interface POSuggestionItem {
    productId: number;
    productName: string;
    currentStock: number;
    reorderLimit: number;
    suggestedQuantity: number;
    reason: 'LOW_STOCK' | 'SALES_INTENT' | 'MANUAL';
    priority?: string;
    lastVendorId?: number;
    lastVendorName?: string;
    preferredVendorId?: number;
    preferredVendorName?: string;
    lastPurchasePrice?: number;
    salesIntentIds?: number[];
    isSelected?: boolean;
    quantity?: number;
}

@Component({
    selector: 'app-purchase-order-smart-create',
    templateUrl: './purchase-order-smart-create.component.html',
    styleUrls: ['./purchase-order-smart-create.component.scss']
})
export class PurchaseOrderSmartCreateComponent implements OnInit {

    storeId: number = 1; // Default to Main Store
    storeName: string = 'Main Store';

    lowStockItems: POSuggestionItem[] = [];
    salesIntentItems: POSuggestionItem[] = [];
    selectedItems: Map<number, POSuggestionItem> = new Map();

    vendors: any[] = [];
    loading: boolean = false;
    errorMessage: string | null = null;
    successMessage: string | null = null;

    form: FormGroup = new FormGroup({
        vendorId: new FormControl('', Validators.required),
        comments: new FormControl('')
    });

    constructor(
        private poService: PurchaseOrderService,
        private vendorService: VendorsService,
        private router: Router
    ) {}

    ngOnInit() {
        this.loadSuggestions();
        this.loadVendors();
    }

    loadSuggestions() {
        this.loading = true;
        this.poService.getSmartSuggestions(this.storeId).subscribe({
            next: (data: any) => {
                this.lowStockItems = data.lowStockItems.map((item: any) => ({
                    ...item,
                    isSelected: false,
                    quantity: item.suggestedQuantity
                }));
                this.salesIntentItems = data.salesIntentItems.map((item: any) => ({
                    ...item,
                    isSelected: false,
                    quantity: item.suggestedQuantity
                }));
                this.storeName = data.storeName;
                this.loading = false;
            },
            error: (error) => {
                this.errorMessage = 'Failed to load suggestions: ' + error.message;
                this.loading = false;
            }
        });
    }

    loadVendors() {
        this.vendorService.findAll().subscribe({
            next: (data: any) => this.vendors = data,
            error: (error) => console.error('Failed to load vendors:', error)
        });
    }

    toggleItemSelection(item: POSuggestionItem) {
        item.isSelected = !item.isSelected;
        if (item.isSelected) {
            this.selectedItems.set(item.productId, item);
            // Auto-suggest vendor if available
            if (item.preferredVendorId && !this.form.value.vendorId) {
                this.form.patchValue({ vendorId: item.preferredVendorId });
            } else if (item.lastVendorId && !this.form.value.vendorId) {
                this.form.patchValue({ vendorId: item.lastVendorId });
            }
        } else {
            this.selectedItems.delete(item.productId);
        }
    }

    updateQuantity(item: POSuggestionItem, quantity: number) {
        item.quantity = quantity;
        if (this.selectedItems.has(item.productId)) {
            this.selectedItems.set(item.productId, item);
        }
    }

    getSelectedCount(): number {
        return this.selectedItems.size;
    }

    getTotalQuantity(): number {
        return Array.from(this.selectedItems.values())
            .reduce((sum, item) => sum + (item.quantity || 0), 0);
    }

    onCreatePO() {
        if (!this.form.valid) {
            this.errorMessage = 'Please select a vendor';
            return;
        }

        if (this.selectedItems.size === 0) {
            this.errorMessage = 'Please select at least one product';
            return;
        }

        this.loading = true;
        this.errorMessage = null;

        const payload = {
            storeId: this.storeId,
            vendorId: parseInt(this.form.value.vendorId),
            items: Array.from(this.selectedItems.values()).map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                salesIntentIds: item.salesIntentIds || []
            })),
            comments: this.form.value.comments
        };

        this.poService.createSmartPO(payload).subscribe({
            next: (result: any) => {
                this.successMessage = `Purchase Order created successfully with ${this.selectedItems.size} products`;
                this.loading = false;
                setTimeout(() => {
                    this.router.navigate(['/secure/purchases/orders', result.id]);
                }, 1500);
            },
            error: (error) => {
                this.errorMessage = 'Failed to create PO: ' + (error.error?.message || error.message);
                this.loading = false;
            }
        });
    }

    getReasonBadgeClass(reason: string): string {
        switch (reason) {
            case 'LOW_STOCK': return 'bg-danger';
            case 'SALES_INTENT': return 'bg-primary';
            case 'MANUAL': return 'bg-secondary';
            default: return 'bg-secondary';
        }
    }

    getPriorityBadgeClass(priority: string): string {
        switch (priority) {
            case 'URGENT': return 'bg-danger';
            case 'HIGH': return 'bg-warning';
            case 'MEDIUM': return 'bg-info';
            case 'LOW': return 'bg-secondary';
            default: return 'bg-secondary';
        }
    }
}
```

**Service Update**:

**File**: `frontend/src/app/secured/purchases/requests/purchase-order.service.ts`

```typescript
getSmartSuggestions(storeId: number) {
    return this.http.get(`${this.apiurl}/suggestions?storeId=${storeId}`);
}

createSmartPO(payload: any) {
    return this.http.post(`${this.apiurl}/smart-create`, payload);
}
```

---

### 4.2 Create Template

**File**: `frontend/src/app/secured/purchases/requests/components/purchase-order-smart-create.component.html`

```html
<div class="container-fluid">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h4>Smart Purchase Order - {{ storeName }}</h4>
        <button class="btn btn-outline-secondary btn-sm" routerLink="/secure/purchases/orders">
            <i class="bi bi-arrow-left"></i> Back
        </button>
    </div>

    <!-- Loading/Error States -->
    <div *ngIf="loading" class="alert alert-info">Loading suggestions...</div>
    <div *ngIf="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
    <div *ngIf="successMessage" class="alert alert-success">{{ successMessage }}</div>

    <div class="row">
        <!-- Left: Product Suggestions -->
        <div class="col-md-8">
            <!-- Low Stock Items -->
            <div class="card mb-3" *ngIf="lowStockItems.length > 0">
                <div class="card-header bg-danger text-white">
                    <h6 class="mb-0">📊 Low Stock Items ({{ lowStockItems.length }})</h6>
                </div>
                <div class="card-body p-2">
                    <div *ngFor="let item of lowStockItems"
                         class="border-bottom p-2 suggestion-item"
                         [class.selected]="item.isSelected"
                         (click)="toggleItemSelection(item)">
                        <div class="row align-items-center">
                            <div class="col-1">
                                <input type="checkbox" [checked]="item.isSelected">
                            </div>
                            <div class="col-5">
                                <strong>{{ item.productName }}</strong><br>
                                <small>Stock: {{ item.currentStock }} | Reorder: {{ item.reorderLimit }}</small>
                            </div>
                            <div class="col-3">
                                <label class="form-label small">Qty</label>
                                <input type="number"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="item.quantity"
                                       (click)="$event.stopPropagation()"
                                       (change)="updateQuantity(item, item.quantity)">
                            </div>
                            <div class="col-3">
                                <small *ngIf="item.preferredVendorName">
                                    Preferred: {{ item.preferredVendorName }}
                                </small>
                                <small *ngIf="!item.preferredVendorName && item.lastVendorName">
                                    Last: {{ item.lastVendorName }}
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sales Intent Items -->
            <div class="card mb-3" *ngIf="salesIntentItems.length > 0">
                <div class="card-header bg-primary text-white">
                    <h6 class="mb-0">💡 Sales Intents ({{ salesIntentItems.length }})</h6>
                </div>
                <div class="card-body p-2">
                    <div *ngFor="let item of salesIntentItems"
                         class="border-bottom p-2 suggestion-item"
                         [class.selected]="item.isSelected"
                         (click)="toggleItemSelection(item)">
                        <div class="row align-items-center">
                            <div class="col-1">
                                <input type="checkbox" [checked]="item.isSelected">
                            </div>
                            <div class="col-5">
                                <strong>{{ item.productName }}</strong>
                                <span class="badge ms-2" [ngClass]="getPriorityBadgeClass(item.priority)">
                                    {{ item.priority }}
                                </span>
                            </div>
                            <div class="col-3">
                                <label class="form-label small">Qty</label>
                                <input type="number"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="item.quantity"
                                       (click)="$event.stopPropagation()"
                                       (change)="updateQuantity(item, item.quantity)">
                            </div>
                            <div class="col-3">
                                <small *ngIf="item.lastVendorName">
                                    Last: {{ item.lastVendorName }}
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Right: PO Summary & Creation -->
        <div class="col-md-4">
            <div class="card sticky-top" style="top: 20px;">
                <div class="card-header">
                    <h6 class="mb-0">Purchase Order Summary</h6>
                </div>
                <div class="card-body">
                    <div class="alert alert-info">
                        <strong>{{ getSelectedCount() }}</strong> product(s) selected<br>
                        Total Quantity: <strong>{{ getTotalQuantity() }}</strong>
                    </div>

                    <form [formGroup]="form" (ngSubmit)="onCreatePO()">
                        <div class="mb-3">
                            <label class="form-label">Vendor *</label>
                            <select class="form-select" formControlName="vendorId">
                                <option value="">Select Vendor</option>
                                <option *ngFor="let vendor of vendors" [value]="vendor.id">
                                    {{ vendor.name }}
                                </option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Comments</label>
                            <textarea class="form-control"
                                      formControlName="comments"
                                      rows="3"></textarea>
                        </div>

                        <button type="submit"
                                class="btn btn-primary w-100"
                                [disabled]="!form.valid || getSelectedCount() === 0 || loading">
                            <i class="bi bi-cart-plus"></i> Create Purchase Order
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Styles**:

**File**: `frontend/src/app/secured/purchases/requests/components/purchase-order-smart-create.component.scss`

```scss
.suggestion-item {
    cursor: pointer;
    transition: all 0.2s;
    border-left: 4px solid transparent;

    &:hover {
        background-color: #f8f9fa;
    }

    &.selected {
        border-left-color: #0d6efd;
        background-color: #e7f1ff;
    }
}
```

---

### 4.3 Update Routing

**File**: `frontend/src/app/secured/purchases/purchases.module.ts`

**Add to routes**:

```typescript
{ path: 'orders/smart-create', component: PurchaseOrderSmartCreateComponent }
```

**Add to declarations**:

```typescript
PurchaseOrderSmartCreateComponent
```

**Add import**:

```typescript
import { PurchaseOrderSmartCreateComponent } from './requests/components/purchase-order-smart-create.component';
```

---

### 4.4 Add Navigation Button

**File**: `frontend/src/app/secured/purchases/requests/components/purchase-order.component.html`

**Update buttons section**:

```html
<div class="col-12 mt-2">
    <a (click)="add()"><button type="submit" class="btn btn-primary me-2">Add New</button></a>
    <a routerLink="/secure/purchases/orders/smart-create">
        <button type="button" class="btn btn-success me-2">
            <i class="bi bi-magic"></i> Smart Create (Low Stock + Intents)
        </button>
    </a>
    <a routerLink="/secure/purchases/orders/from-intents">
        <button type="button" class="btn btn-info">
            <i class="bi bi-cart-plus"></i> From Sales Intents Only
        </button>
    </a>
</div>
```

---

## Testing Plan

### Backend Testing

1. **Test Suggestions Endpoint**:
```bash
curl http://localhost:3000/purchaseorders/suggestions?storeId=1
```

Expected Response:
```json
{
  "lowStockItems": [...],
  "salesIntentItems": [...],
  "storeId": 1,
  "storeName": "Main Store",
  "totalSuggestions": 5
}
```

2. **Add Sample Product Configurations**:
```sql
-- Add reorder limits for some products
INSERT INTO product_store_config (store_id, product_id, reorder_limit, optimal_stock_level, is_available_in_store, created_by)
SELECT 1, id, 10, 50, TRUE, 1
FROM product
LIMIT 10;
```

### Frontend Testing

1. Navigate to http://localhost:8000/secure/purchases/orders/smart-create
2. Verify suggestions load
3. Select products
4. Choose vendor
5. Create PO
6. Verify PO created successfully

---

## Deployment Steps

1. **Run Migration** (already done): `sql/migrations/016_multi_store_architecture.sql`
2. **Rebuild API**: `docker-compose up -d --build api`
3. **Rebuild Frontend**: `docker-compose up -d --build frontend`
4. **Add Product Configurations**: Use SQL to populate `product_store_config`
5. **Test**: Access Smart PO Creation UI

---

## Next Session Checklist

- [ ] Create `po-suggestion.dto.ts`
- [ ] Update `purchase.service.ts` with smart suggestions methods
- [ ] Update `purchase-order.controller.ts` with /suggestions endpoint
- [ ] Create Smart PO frontend component
- [ ] Update routing
- [ ] Test end-to-end
- [ ] Add product configurations for testing
- [ ] Document user guide

---

**Estimated Remaining Time**: 1.5-2 hours for full implementation
**Priority**: Backend services (Phase 3) should be completed first, then frontend (Phase 4)
