# Multi-Product Sales Intent - Implementation Guide

## Overview
Enable sales intents to support multiple products in a single intent, similar to how purchase invoices handle line items.

## Current Status: 50% Complete

### ✅ Completed (Backend Foundation)

1. **Database Schema** (`sql/migrations/017_add_sales_intent_items.sql`)
   - Created `sales_intent_item` table
   - Migrated existing data
   - Added summary columns

2. **Backend Entities**
   - Created `SalesIntentItem` entity (`api-v2/src/entities/sales-intent-item.entity.ts`)
   - Updated `SalesIntent` entity with OneToMany relationship

3. **Backend DTOs**
   - Created `SalesIntentItemDto` (`api-v2/src/modules/app/sales-intent/dto/sales-intent-item.dto.ts`)
   - Updated `CreateSalesIntentDto` to support items array (backward compatible)

4. **Backend Module**
   - Registered `SalesIntentItem` entity in `SalesIntentModule`

---

## 🔄 Remaining Work

### 1. Update Backend Service (`api-v2/src/modules/app/sales-intent/sales-intent.service.ts`)

The service needs to handle both old single-product format AND new multi-product format for backward compatibility.

#### In `create()` method:
```typescript
async create(dto: CreateSalesIntentDto, userId: number): Promise<SalesIntent> {
    return await this.dataSource.transaction(async (manager) => {
        // Generate intent number
        const intentNo = await this.generateIntentNumber();

        // Create the parent intent
        const intent = manager.create(SalesIntent, {
            intentno: intentNo,
            intenttype: dto.intenttype,
            priority: dto.priority || 'MEDIUM',
            customername: dto.customername,
            customermobile: dto.customermobile,
            advanceamount: dto.advanceamount || 0,
            requestnotes: dto.requestnotes,
            internalnotes: dto.internalnotes,
            status: 'PENDING',
            fulfillmentstatus: 'NOT_STARTED',
            createdby: userId,
            // Keep old fields populated for backward compatibility
            productname: dto.productname || (dto.items?.[0]?.productname),
            prodid: dto.prodid || dto.items?.[0]?.prodid,
            requestedqty: dto.requestedqty || (dto.items?.[0]?.requestedqty),
            estimatedcost: dto.estimatedcost || (dto.items?.[0]?.estimatedcost),
        });

        const savedIntent = await manager.save(SalesIntent, intent);

        // Handle items array (NEW way)
        if (dto.items && dto.items.length > 0) {
            const items = dto.items.map(item => manager.create(SalesIntentItem, {
                intentid: savedIntent.id,
                prodid: item.prodid,
                productname: item.productname,
                requestedqty: item.requestedqty,
                estimatedcost: item.estimatedcost,
                itemnotes: item.itemnotes,
                createdby: userId
            }));

            await manager.save(SalesIntentItem, items);

            // Update summary columns
            savedIntent.totalitems = items.length;
            savedIntent.totalestimatedcost = items.reduce(
                (sum, item) => sum + ((item.estimatedcost || 0) * item.requestedqty),
                0
            );
            await manager.save(SalesIntent, savedIntent);
        }
        // Handle old single-product way (backward compatibility)
        else if (dto.productname && dto.requestedqty) {
            const item = manager.create(SalesIntentItem, {
                intentid: savedIntent.id,
                prodid: dto.prodid,
                productname: dto.productname,
                requestedqty: dto.requestedqty,
                estimatedcost: dto.estimatedcost,
                createdby: userId
            });

            await manager.save(SalesIntentItem, item);

            savedIntent.totalitems = 1;
            savedIntent.totalestimatedcost = (dto.estimatedcost || 0) * dto.requestedqty;
            await manager.save(SalesIntent, savedIntent);
        }

        return savedIntent;
    });
}
```

#### In `findOne()` method:
Load items with the intent:
```typescript
async findOne(id: number): Promise<SalesIntent> {
    return await this.salesIntentRepository.findOne({
        where: { id },
        relations: ['items', 'product', 'customer']  // Add 'items' relation
    });
}
```

#### In `findAll()` method:
```typescript
async findAll(criteria: any): Promise<SalesIntent[]> {
    return await this.salesIntentRepository.find({
        where: criteria,
        relations: ['items'],  // Add 'items' relation
        order: { createdon: 'DESC' }
    });
}
```

---

### 2. Update Frontend Model (`frontend/src/app/secured/sales/intent/intent.model.ts`)

Add items array to the interface:

```typescript
export interface SalesIntentItem {
    id?: number;
    prodid?: number;
    productname: string;
    requestedqty: number;
    estimatedcost?: number;
    itemnotes?: string;
}

export interface SalesIntent {
    id?: number;
    intentno?: string;
    intenttype: string;
    priority: string;

    // OLD: Single product fields (deprecated but kept for compatibility)
    prodid?: number;
    productname?: string;
    requestedqty?: number;
    estimatedcost?: number;

    // NEW: Multiple products support
    items?: SalesIntentItem[];
    totalitems?: number;
    totalestimatedcost?: number;

    // Customer info
    customerid?: number;
    customername?: string;
    customermobile?: string;
    advanceamount?: number;

    // Status and notes
    status?: string;
    fulfillmentstatus?: string;
    requestnotes?: string;
    internalnotes?: string;

    // Relations
    product?: any;
    customer?: any;
    purchaseorderid?: number;

    // Audit
    createdon?: Date;
    fulfilledon?: Date;
}

export interface CreateSalesIntentDto {
    intenttype: string;
    priority?: string;

    // NEW: Support items array
    items?: SalesIntentItem[];

    // OLD: Single product (for backward compatibility)
    prodid?: number;
    productname?: string;
    requestedqty?: number;
    estimatedcost?: number;

    // Customer
    customerid?: number;
    customername?: string;
    customermobile?: string;
    advanceamount?: number;

    // Notes
    requestnotes?: string;
    internalnotes?: string;
}

export interface UpdateSalesIntentDto extends CreateSalesIntentDto {
    id: number;
}
```

---

### 3. Update Frontend Form Component (`frontend/src/app/secured/sales/intent/intent-form.component.ts`)

Add items management:

```typescript
export class IntentFormComponent implements OnInit {
    // ... existing fields ...

    // Items management
    intentItems: SalesIntentItem[] = [];
    currentItem: SalesIntentItem = this.getEmptyItem();

    getEmptyItem(): SalesIntentItem {
        return {
            productname: '',
            requestedqty: 1,
            estimatedcost: 0
        };
    }

    addItem() {
        if (!this.currentItem.productname || this.currentItem.requestedqty < 1) {
            this.errorMessage = 'Please fill product details before adding';
            return;
        }

        // Add selected product info
        if (this.selectedProduct) {
            this.currentItem.prodid = this.selectedProduct.id;
        }

        this.intentItems.push({ ...this.currentItem });
        this.currentItem = this.getEmptyItem();
        this.selectedProduct = null;
        this.productSearchTerm = '';
    }

    removeItem(index: number) {
        this.intentItems.splice(index, 1);
    }

    editItem(index: number) {
        this.currentItem = { ...this.intentItems[index] };
        this.intentItems.splice(index, 1);
    }

    getTotalEstimatedCost(): number {
        return this.intentItems.reduce(
            (sum, item) => sum + ((item.estimatedcost || 0) * item.requestedqty),
            0
        );
    }

    submit() {
        if (!this.form.valid) {
            this.errorMessage = 'Please fill all required fields correctly';
            return;
        }

        if (this.intentItems.length === 0 && !this.form.value.productname) {
            this.errorMessage = 'Please add at least one product';
            return;
        }

        const formData = this.form.value;

        const dto: CreateSalesIntentDto | UpdateSalesIntentDto = {
            intenttype: formData.intenttype,
            priority: formData.priority,
            customername: formData.customername || undefined,
            customermobile: formData.customermobile || undefined,
            advanceamount: formData.advanceamount || 0,
            requestnotes: formData.requestnotes || undefined,
            internalnotes: formData.internalnotes || undefined,
            customerid: this.selectedCustomer?.id || undefined,

            // Send items array
            items: this.intentItems.length > 0 ? this.intentItems : undefined,

            // Backward compatibility: if no items, send old format
            productname: this.intentItems.length === 0 ? formData.productname : undefined,
            requestedqty: this.intentItems.length === 0 ? formData.requestedqty : undefined,
            estimatedcost: this.intentItems.length === 0 ? formData.estimatedcost : undefined,
            prodid: this.intentItems.length === 0 && this.selectedProduct?.id ? this.selectedProduct.id : undefined
        };

        // ... rest of submit logic ...
    }

    populateForm(data: SalesIntent) {
        this.form.patchValue({
            id: data.id,
            intenttype: data.intenttype,
            priority: data.priority,
            customername: data.customername || '',
            customermobile: data.customermobile || '',
            advanceamount: data.advanceamount || 0,
            requestnotes: data.requestnotes || '',
            internalnotes: data.internalnotes || ''
        });

        // Load items if available
        if (data.items && data.items.length > 0) {
            this.intentItems = [...data.items];
        }

        this.selectedCustomer = data.customer;
    }
}
```

---

### 4. Update Frontend Form Template (`frontend/src/app/secured/sales/intent/intent-form.component.html`)

Add after the product details card:

```html
<!-- Items List Card (NEW) -->
<div class="card bg-light mb-3" *ngIf="intentItems.length > 0">
    <div class="card-body">
        <h6 class="card-subtitle mb-3 text-primary">
            <i class="bi bi-list-check"></i> Products Added ({{intentItems.length}})
        </h6>

        <div class="table-responsive">
            <table class="table table-sm table-bordered">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th style="width: 120px;">Quantity</th>
                        <th style="width: 120px;">Est. Cost</th>
                        <th style="width: 120px;">Total</th>
                        <th style="width: 100px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr *ngFor="let item of intentItems; let i = index">
                        <td>
                            <strong>{{item.productname}}</strong>
                            <span class="badge bg-secondary ms-2" *ngIf="item.prodid">ID: {{item.prodid}}</span>
                        </td>
                        <td class="text-end">{{item.requestedqty}}</td>
                        <td class="text-end">₹{{item.estimatedcost || 0 | number:'1.2-2'}}</td>
                        <td class="text-end"><strong>₹{{(item.estimatedcost || 0) * item.requestedqty | number:'1.2-2'}}</strong></td>
                        <td class="text-center">
                            <button type="button" class="btn btn-sm btn-outline-primary me-1" (click)="editItem(i)" [disabled]="isViewMode">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger" (click)="removeItem(i)" [disabled]="isViewMode">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>
                    <tr class="table-active">
                        <td colspan="3" class="text-end"><strong>Total Estimated Cost:</strong></td>
                        <td class="text-end"><strong>₹{{getTotalEstimatedCost() | number:'1.2-2'}}</strong></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</div>
```

Add "Add Product" button after quantity/cost fields:

```html
<div class="row mt-3" *ngIf="!isViewMode">
    <div class="col-12">
        <button type="button" class="btn btn-success" (click)="addItem()">
            <i class="bi bi-plus-circle"></i> Add Product to Intent
        </button>
        <small class="text-muted ms-2">
            You can add multiple products to this intent
        </small>
    </div>
</div>
```

---

### 5. Update Frontend Form Validation

Remove required validators from old single-product fields:

```typescript
// In form initialization
form: FormGroup = new FormGroup({
    id: new FormControl(''),
    intenttype: new FormControl('CUSTOMER_REQUEST', Validators.required),
    priority: new FormControl('MEDIUM', Validators.required),

    // Remove 'required' from these (they're optional now)
    productname: new FormControl('', Validators.maxLength(100)),
    requestedqty: new FormControl(1, Validators.min(1)),
    estimatedcost: new FormControl(0, Validators.min(0)),

    customername: new FormControl('', Validators.maxLength(100)),
    customermobile: new FormControl('', [Validators.maxLength(15), Validators.pattern('^[0-9]*$')]),
    advanceamount: new FormControl(0, Validators.min(0)),
    requestnotes: new FormControl(''),
    internalnotes: new FormControl('')
});
```

---

### 6. Update Intent List to Show Item Count

In `intent-list.component.html`, add a column:

```html
<td>
    <span class="badge bg-info" *ngIf="intent.totalitems > 1">
        {{intent.totalitems}} Products
    </span>
    <span *ngIf="!intent.totalitems || intent.totalitems === 1">
        {{intent.productname}}
    </span>
</td>
```

---

## Testing Steps

### 1. Test API Backend
```bash
# Rebuild API
docker-compose up -d --build api

# Check logs
docker logs rgp-bo-api-1

# Test with curl or Postman
curl -X POST http://localhost:3000/sales-intent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "intenttype": "CUSTOMER_REQUEST",
    "priority": "HIGH",
    "items": [
      {
        "productname": "Paracetamol 500mg",
        "requestedqty": 100,
        "estimatedcost": 5.00
      },
      {
        "productname": "Aspirin 75mg",
        "requestedqty": 50,
        "estimatedcost": 3.50
      }
    ],
    "customername": "John Doe",
    "customermobile": "9876543210"
  }'
```

### 2. Test Frontend
```bash
# Rebuild frontend
docker-compose up -d --build frontend

# Open browser
http://localhost:8000
# Navigate to Sales > Intent > New Intent
# Try adding multiple products
```

### 3. Verify Database
```bash
docker exec -it rgp-db psql -U rgpapp -d rgpdb

# Check intents
SELECT id, intentno, totalitems, totalestimatedcost FROM sales_intent;

# Check items
SELECT * FROM sales_intent_item WHERE intent_id = 1;
```

---

## Rollback Plan

If issues arise, the old single-product way still works because:
1. Old columns (`productname`, `prodid`, `requestedqty`) are still in `sales_intent` table
2. DTOs accept both formats
3. Service creates an item for old format too

To fully rollback:
```sql
-- Drop new table
DROP TABLE sales_intent_item CASCADE;

-- Remove new columns
ALTER TABLE sales_intent DROP COLUMN total_items;
ALTER TABLE sales_intent DROP COLUMN total_estimated_cost;
```

---

## Next Steps After Implementation

1. Update intent list view to show multiple products
2. Update intent detail view to show items table
3. Add ability to convert intent to Purchase Order (handle multiple items)
4. Add bulk actions (approve multiple items, etc.)
5. Add item-level status tracking

---

## Files Modified/Created

### Backend
- ✅ `sql/migrations/017_add_sales_intent_items.sql`
- ✅ `api-v2/src/entities/sales-intent-item.entity.ts`
- ✅ `api-v2/src/entities/sales-intent.entity.ts` (updated)
- ✅ `api-v2/src/modules/app/sales-intent/dto/sales-intent-item.dto.ts`
- ✅ `api-v2/src/modules/app/sales-intent/dto/create-sales-intent.dto.ts` (updated)
- ✅ `api-v2/src/modules/app/sales-intent/sales-intent.module.ts` (updated)
- ⏳ `api-v2/src/modules/app/sales-intent/sales-intent.service.ts` (needs update)

### Frontend
- ⏳ `frontend/src/app/secured/sales/intent/intent.model.ts` (needs update)
- ⏳ `frontend/src/app/secured/sales/intent/intent-form.component.ts` (needs update)
- ⏳ `frontend/src/app/secured/sales/intent/intent-form.component.html` (needs update)
- ⏳ `frontend/src/app/secured/sales/intent/intent-list.component.html` (optional update)

---

## Estimated Time to Complete

- Backend Service Updates: 30 minutes
- Frontend Model & Component: 1 hour
- Frontend Template: 45 minutes
- Testing & Bug Fixes: 45 minutes
- **Total: ~3 hours**

---

## Notes

- The implementation maintains backward compatibility
- Existing single-product intents will continue to work
- The UI allows mixing old and new approaches during transition
- Data migration was automatic (existing intents converted to use items table)
