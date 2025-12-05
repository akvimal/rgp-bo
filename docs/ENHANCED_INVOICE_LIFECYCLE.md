# Enhanced Purchase Invoice Lifecycle Management

## Overview
This feature enhancement adds complete lifecycle management for purchase invoices, including:
- Document upload with OCR integration
- Item type management (Regular/Return/Supplied)
- Payment tracking and reconciliation
- Tax credit reconciliation with GSTR-1/2A
- Purchase effectiveness metrics
- Invoice closure workflow

## Implementation Status

### ✅ Phase 1: Database Schema (COMPLETED)

#### Files Created/Modified:
1. **Migration Scripts**
   - `sql/migrations/006_enhanced_invoice_lifecycle.sql` - Main migration
   - `sql/migrations/006_rollback.sql` - Rollback script

2. **Entity Files Updated**
   - `api-v2/src/entities/purchase-invoice.entity.ts` - Added 16 new fields
   - `api-v2/src/entities/purchase-invoice-item.entity.ts` - Added 9 new fields
   - `api-v2/src/entities/vendor-payment.entity.ts` - Added 10 new fields

3. **New Entity Files Created**
   - `api-v2/src/entities/purchase-invoice-tax-credit.entity.ts`
   - `api-v2/src/entities/purchase-effectiveness.entity.ts`
   - `api-v2/src/entities/purchase-invoice-document.entity.ts`

#### Database Changes Summary:

**purchase_invoice table:**
- `doc_type` - INVOICE or DELIVERY_CHALLAN
- `payment_status` - UNPAID, PARTIAL, PAID
- `tax_status` - PENDING, FILED, CREDITED, RECONCILED
- `lifecycle_status` - OPEN, CLOSED
- `paid_amount` - Total amount paid
- Tax tracking: `cgst_amount`, `sgst_amount`, `igst_amount`, `total_tax_credit`
- Tax reconciliation: `tax_filing_month`, `tax_reconciled_on`, `tax_reconciled_by`
- Closure tracking: `closed_on`, `closed_by`, `closure_notes`

**purchase_invoice_item table:**
- `item_type` - REGULAR, RETURN, SUPPLIED
- `challan_ref` - Delivery challan reference
- `return_reason` - Reason for return
- Tax breakdown: `cgst_pcnt`, `sgst_pcnt`, `igst_pcnt`, `cgst_amount`, `sgst_amount`, `igst_amount`

**vendor_payment table:**
- `payment_type` - ADVANCE, PARTIAL, FULL
- `payment_against` - INVOICE, DELIVERY_CHALLAN
- `payment_status` - PENDING, COMPLETED, FAILED
- Payment details: `bank_name`, `cheque_no`, `utr_no`, `payment_proof_doc_id`
- Reconciliation: `reconciled`, `reconciled_on`, `reconciled_by`, `notes`

**New Tables:**
1. `purchase_invoice_tax_credit` - GST tax reconciliation tracking
2. `purchase_effectiveness` - ROI and disposition metrics
3. `purchase_invoice_document` - OCR and document management

---

## Next Steps

### 🔄 Phase 2: DTOs and Validation (IN PROGRESS)

#### Files to Update:
1. **DTOs to Create/Update:**
   - `api-v2/src/modules/app/purchases/dto/create-invoice.dto.ts`
   - `api-v2/src/modules/app/purchases/dto/create-invoice-item.dto.ts`
   - `api-v2/src/modules/app/purchases/dto/create-payment.dto.ts`
   - `api-v2/src/modules/app/purchases/dto/create-tax-credit.dto.ts` (NEW)
   - `api-v2/src/modules/app/purchases/dto/update-invoice.dto.ts`

2. **Enums to Create:**
   - `api-v2/src/modules/app/purchases/enums/doc-type.enum.ts`
   - `api-v2/src/modules/app/purchases/enums/item-type.enum.ts`
   - `api-v2/src/modules/app/purchases/enums/payment-status.enum.ts`
   - `api-v2/src/modules/app/purchases/enums/tax-status.enum.ts`
   - `api-v2/src/modules/app/purchases/enums/lifecycle-status.enum.ts`

### 📋 Phase 3: Service Layer Updates (PENDING)

#### Files to Update:
1. `api-v2/src/modules/app/purchases/purchase-invoice.service.ts`
   - Add validation for item types
   - Add payment status calculation
   - Add tax status tracking
   - Add lifecycle management methods

2. `api-v2/src/modules/app/purchases/purchase-invoice-items.controller.ts`
   - Add item type validation
   - Validate challan_ref for SUPPLIED items
   - Validate return_reason for RETURN items

### 🎨 Phase 4: Frontend Components (PENDING)

#### Components to Create/Update:
1. **Invoice Form Component**
   - Add doc_type selection (Invoice/Delivery Challan)
   - Add tax amount fields

2. **Invoice Items Component**
   - Add item_type dropdown
   - Conditional fields (challan_ref, return_reason)
   - Color coding for item types
   - Update totals calculation (exclude RETURN items)

3. **Payment Management Component** (NEW)
   - Payment recording form
   - Payment history display
   - Payment proof upload
   - Reconciliation tracking

4. **Tax Credit Reconciliation Component** (NEW)
   - GST filing details form
   - GSTR-1/2A upload
   - Mismatch handling
   - Status timeline

5. **Purchase Effectiveness Dashboard** (NEW)
   - KPI cards (sold, expired, ROI)
   - Disposition charts
   - Item-wise effectiveness table

6. **Invoice Closure Component** (NEW)
   - Closure checklist
   - Final notes
   - Status display

### 🧪 Phase 5: Testing (PENDING)

#### Tests to Create:
1. **Database Migration Tests**
   - Test migration execution
   - Test rollback
   - Verify data integrity

2. **Service Layer Tests**
   - Test item type validation
   - Test payment status calculation
   - Test tax calculation
   - Test lifecycle transitions

3. **Integration Tests**
   - Complete invoice lifecycle flow
   - Multi-payment scenarios
   - Tax reconciliation flow
   - Return item handling

### 📊 Phase 6: Reporting (PENDING)

#### Reports to Build:
1. Invoice Aging Report
2. Tax Credit Summary Report
3. Purchase Effectiveness Report
4. Vendor Performance Report
5. Stock Wastage Report

---

## Running the Migration

### Prerequisites
- PostgreSQL database running
- Backup of existing data (migration creates backups automatically)
- Application services stopped

### Execution Steps

```bash
# 1. Connect to database
docker exec -it rgp-db psql -U rgpapp -d rgpdb

# 2. Run migration
\i /path/to/sql/migrations/006_enhanced_invoice_lifecycle.sql

# 3. Verify migration
-- Check new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'purchase_invoice'
AND column_name IN ('doc_type', 'payment_status', 'tax_status');

-- Check new tables
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('purchase_invoice_tax_credit', 'purchase_effectiveness', 'purchase_invoice_document');

# 4. If needed, rollback
\i /path/to/sql/migrations/006_rollback.sql
```

### Post-Migration Steps

1. **Update Application Code**
   - DTOs updated with new fields
   - Services updated with validation
   - Frontend updated with new UI

2. **Test in Development**
   - Create test invoice with different item types
   - Test payment recording
   - Test tax reconciliation

3. **Data Migration** (if needed)
   - Populate `item_type` for existing items (default: REGULAR)
   - Calculate `payment_status` from existing payments
   - Initialize effectiveness records for active invoices

---

## API Endpoints (To Be Created)

### Invoice Document Management
```
POST   /api/purchase-invoices/:id/documents          # Upload document
POST   /api/purchase-invoices/documents/:id/ocr      # Trigger OCR
GET    /api/purchase-invoices/:id/documents          # List documents
POST   /api/purchase-invoices/:id/auto-populate      # Auto-fill from OCR
```

### Payment Management
```
POST   /api/purchase-invoices/:id/payments           # Record payment
GET    /api/purchase-invoices/:id/payments           # Get payment history
PUT    /api/purchase-invoices/payments/:id           # Update payment
POST   /api/purchase-invoices/payments/:id/reconcile # Reconcile payment
```

### Tax Reconciliation
```
POST   /api/purchase-invoices/:id/tax-credit         # Create tax record
PUT    /api/purchase-invoices/:id/tax-credit         # Update tax status
GET    /api/tax-credit/pending                       # Pending reconciliations
GET    /api/tax-credit/report/:month                 # Monthly report
```

### Effectiveness Tracking
```
GET    /api/purchase-invoices/:id/effectiveness      # Invoice effectiveness
GET    /api/purchase-effectiveness/summary           # Overall summary
POST   /api/purchase-effectiveness/calculate         # Recalculate metrics
```

### Lifecycle Management
```
PUT    /api/purchase-invoices/:id/complete           # Complete invoice
PUT    /api/purchase-invoices/:id/close              # Close invoice
GET    /api/purchase-invoices/pending-closure        # Ready to close
```

---

## Development Roadmap

### Week 1-2: Foundation ✅ (COMPLETED)
- [x] Database schema design
- [x] Migration scripts
- [x] Entity updates

### Week 3: DTOs & Validation (CURRENT)
- [ ] Create enums
- [ ] Update DTOs
- [ ] Add validation rules

### Week 4: Service Layer
- [ ] Update service methods
- [ ] Add business logic
- [ ] Add lifecycle management

### Week 5-6: OCR Integration
- [ ] Choose OCR service
- [ ] Implement OCR processing
- [ ] Build auto-populate logic

### Week 7-8: Frontend Components
- [ ] Update invoice forms
- [ ] Create payment component
- [ ] Create tax reconciliation component

### Week 9-10: Effectiveness Tracking
- [ ] Build calculation service
- [ ] Create dashboard components
- [ ] Add reporting

### Week 11: Invoice Lifecycle
- [ ] Implement closure workflow
- [ ] Add notifications
- [ ] Status management

### Week 12: Testing & Polish
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Documentation
- [ ] Performance optimization

---

## Configuration

### Environment Variables (To Be Added)

```env
# OCR Service Configuration
OCR_SERVICE=google-vision  # or azure-form-recognizer, tesseract
OCR_API_KEY=your-api-key
OCR_ENDPOINT=https://vision.googleapis.com/v1

# Document Storage
DOC_STORAGE_PATH=/app/invoices
DOC_ENCRYPTION_KEY=your-encryption-key

# Tax Configuration
GST_API_ENABLED=false
GST_API_KEY=your-gst-api-key
```

---

## Security Considerations

1. **Document Storage**
   - Encrypt sensitive documents
   - Access control by user role
   - Audit all document access

2. **Payment Data**
   - Encrypt bank details
   - Restrict payment proof access
   - Log all payment modifications

3. **Tax Data**
   - Restrict GSTIN visibility
   - Encrypt tax reconciliation notes
   - Audit tax status changes

4. **Role-Based Access**
   - `invoice:create` - Admin, Purchase Manager
   - `invoice:verify` - Admin, Store Head, Purchase Manager
   - `invoice:payment` - Admin, Accounts Manager
   - `invoice:tax_reconcile` - Admin, Tax Accountant
   - `invoice:close` - Admin only

---

## Support & Documentation

- **Architecture Decisions**: See `docs/ENHANCED_INVOICE_LIFECYCLE.md` (this file)
- **Database Schema**: See `sql/migrations/006_enhanced_invoice_lifecycle.sql`
- **API Documentation**: See Swagger at `/api` after implementation
- **User Guide**: To be created after frontend implementation

---

## Contributors

- Database Schema: Claude Code
- Entity Models: Claude Code
- Migration Scripts: Claude Code

---

**Last Updated**: 2025-12-05
**Version**: 1.0.0
**Status**: Phase 1 Complete - Database & Entities Ready
