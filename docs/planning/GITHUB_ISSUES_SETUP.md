# GitHub Issues & Project Board Setup Guide

This document provides a complete structure for setting up GitHub Issues and Project Board for the RGP Back Office system.

---

## 📋 Table of Contents

1. [Labels Setup](#labels-setup)
2. [Milestones Setup](#milestones-setup)
3. [Project Board Columns](#project-board-columns)
4. [Epic Issues](#epic-issues)
5. [Feature Issues](#feature-issues)
6. [Task Issues](#task-issues)

---

## 🏷️ Labels Setup

### Priority Labels
```
priority: critical    - Red (#d73a4a)      - Must be fixed immediately
priority: high        - Orange (#ff9800)   - Should be addressed soon
priority: medium      - Yellow (#fbca04)   - Normal priority
priority: low         - Green (#0e8a16)    - Nice to have
```

### Type Labels
```
type: feature         - Blue (#0052cc)     - New feature or capability
type: enhancement     - Light Blue (#84b6eb) - Improvement to existing feature
type: bug             - Red (#d73a4a)      - Something isn't working
type: docs            - Gray (#d4c5f9)     - Documentation only
type: refactor        - Purple (#5319e7)   - Code refactoring
type: security        - Dark Red (#b60205) - Security-related
type: performance     - Orange (#ff6b6b)   - Performance optimization
type: tech-debt       - Brown (#8b4513)    - Technical debt cleanup
```

### Status Labels
```
status: planning      - Light Gray (#c5def5)
status: ready         - Green (#0e8a16)
status: in-progress   - Yellow (#fbca04)
status: blocked       - Red (#d73a4a)
status: review        - Purple (#6f42c1)
status: testing       - Orange (#ff9800)
status: done          - Dark Green (#006b75)
```

### Module Labels
```
module: core          - Dark Blue (#001f3f)
module: sales         - Blue (#0074d9)
module: purchases     - Teal (#39cccc)
module: inventory     - Green (#2ecc40)
module: customers     - Light Blue (#7fdbff)
module: vendors       - Navy (#001f3f)
module: reports       - Purple (#b10dc9)
module: hr            - Pink (#f012be)
module: gst           - Orange (#ff851b)
module: api           - Yellow (#ffdc00)
module: frontend      - Aqua (#01ff70)
module: database      - Maroon (#85144b)
module: ai            - Fuchsia (#f012be)
```

### Size Labels (T-Shirt Sizing)
```
size: xs              - Very Light Gray (#f1f8ff) - < 2 hours
size: s               - Light Gray (#e1ecf4)      - 2-4 hours
size: m               - Medium Gray (#c5def5)     - 1-2 days
size: l               - Dark Gray (#6a737d)       - 3-5 days
size: xl              - Darker Gray (#24292e)     - 1-2 weeks
```

### Component Labels
```
component: backend    - Navy (#0366d6)
component: frontend   - Teal (#1b998b)
component: database   - Brown (#8b4513)
component: devops     - Gray (#586069)
component: testing    - Purple (#6f42c1)
```

### Special Labels
```
good-first-issue      - Green (#7057ff)
help-wanted          - Green (#008672)
wontfix              - White (#ffffff)
duplicate            - Light Gray (#cfd3d7)
breaking-change      - Red (#d93f0b)
needs-discussion     - Yellow (#fef2c0)
```

---

## 🎯 Milestones Setup

### Active Milestones

**Milestone 1: Core Stability & Security**
- Due Date: 2 months from now
- Description: Complete security hardening, error handling, and stability improvements
- Issues: 15-20

**Milestone 2: Enhanced Invoice Lifecycle**
- Due Date: 3 months from now
- Description: Complete the enhanced invoice lifecycle frontend implementation
- Issues: 25-30

**Milestone 3: GST Compliance Complete**
- Due Date: 4 months from now
- Description: Full GST reporting and compliance system
- Issues: 20-25

**Milestone 4: HR Management System**
- Due Date: 5 months from now
- Description: Complete HR module with attendance, leave, and performance
- Issues: 30-35

**Milestone 5: AI & Automation**
- Due Date: 6 months from now
- Description: AI-powered features and workflow automation
- Issues: 15-20

**Milestone 6: Multi-Tenant Architecture**
- Due Date: 8 months from now
- Description: Support for multiple businesses and stores
- Issues: 35-40

---

## 📊 Project Board Columns

```
1. 📥 Backlog          - New issues, not yet prioritized
2. 📋 To Do            - Prioritized and ready to start
3. 🔍 In Analysis      - Requirements gathering, planning
4. 👨‍💻 In Progress      - Actively being worked on
5. 🔬 In Review        - Code review, PR open
6. 🧪 Testing          - QA, integration testing
7. 🚫 Blocked          - Waiting on dependencies
8. ✅ Done             - Completed and deployed
```

---

## 🌟 EPIC ISSUES

### Epic #1: Security & Stability Hardening
```markdown
**Title:** [EPIC] Security & Stability Hardening

**Labels:** `type: feature`, `priority: critical`, `module: core`, `size: xl`

**Milestone:** Core Stability & Security

**Description:**
Comprehensive security and stability improvements across the entire application.

**Goals:**
- ✅ Phase 1: SQL Injection Prevention (COMPLETED)
- ✅ Phase 2: Race Condition Handling (COMPLETED)
- ✅ Phase 3: Transaction Atomicity (COMPLETED)
- ✅ Phase 4: Error Handling Infrastructure (COMPLETED)
- 🔄 Phase 5: Apply error handling to all services
- ⏳ Phase 6: Security audit and penetration testing
- ⏳ Phase 7: Performance optimization and monitoring

**Acceptance Criteria:**
- [ ] All 16 services implement standard error handling pattern
- [ ] Zero SQL injection vulnerabilities
- [ ] No race conditions in critical workflows
- [ ] All multi-step operations use transactions
- [ ] Comprehensive error logging with sensitive data redaction
- [ ] Security audit passed
- [ ] Performance benchmarks met

**Related Issues:** #2, #3, #4, #5, #6, #7, #8

**Dependencies:** None

**Estimated Effort:** 8-10 weeks
```

---

### Epic #2: Enhanced Purchase Invoice Lifecycle
```markdown
**Title:** [EPIC] Enhanced Purchase Invoice Lifecycle Management

**Labels:** `type: feature`, `priority: high`, `module: purchases`, `size: xl`

**Milestone:** Enhanced Invoice Lifecycle

**Description:**
Complete lifecycle management for purchase invoices from creation to closure, including OCR, payment tracking, and tax reconciliation.

**Current Status:**
- ✅ Database Schema (100%)
- ✅ Backend API (100%)
- ✅ Testing Scripts (90%)
- ❌ Frontend UI (0%)

**Goals:**
- ✅ Enhanced database schema with lifecycle fields
- ✅ 21 new REST API endpoints
- 🔄 Frontend UI for all lifecycle features
- ⏳ OCR integration for invoice document upload
- ⏳ Payment reconciliation interface
- ⏳ Tax credit management UI
- ⏳ Effectiveness dashboard

**Acceptance Criteria:**
- [ ] Users can upload invoice documents with OCR extraction
- [ ] Item types (Regular/Return/Supplied) fully functional
- [ ] Payment tracking shows real-time status
- [ ] Tax credit reconciliation with GSTR-2A
- [ ] Invoice closure workflow implemented
- [ ] Purchase effectiveness metrics displayed
- [ ] End-to-end testing completed

**Related Issues:** #9, #10, #11, #12, #13, #14, #15, #16

**Dependencies:** Epic #3 (GST Compliance)

**Estimated Effort:** 12-14 weeks
```

---

### Epic #3: GST Compliance & Reporting
```markdown
**Title:** [EPIC] GST Compliance & Tax Reporting System

**Labels:** `type: feature`, `priority: critical`, `module: gst`, `size: xl`

**Milestone:** GST Compliance Complete

**Description:**
Complete GST compliance system with all statutory reports, ITC management, and filing capabilities.

**Current Status:**
- ✅ Backend GST Report API (100%)
- ✅ Database ITC tracking fields (100%)
- 🔄 Frontend GST Reports (Partial)
- ❌ GSTR-2A/2B Reconciliation UI (0%)

**Goals:**
- ✅ GSTR-1 report generation (B2B, B2C, HSN)
- ✅ GSTR-3B monthly return calculation
- ✅ ITC tracking and eligibility management
- 🔄 GSTR-2A/2B verification interface
- ⏳ Tax payment integration
- ⏳ Return filing workflow
- ⏳ Reconciliation dashboard

**Acceptance Criteria:**
- [ ] All GSTR-1 reports generate correctly
- [ ] GSTR-3B auto-calculated and exportable
- [ ] ITC claims tracked with 180-day rule
- [ ] GSTR-2A mismatches identified and flagged
- [ ] Payment risk dashboard functional
- [ ] Monthly closing workflow implemented
- [ ] Audit trail for all tax operations

**Related Issues:** #17, #18, #19, #20, #21, #22, #23

**Dependencies:** Epic #2 (Enhanced Invoice Lifecycle)

**Estimated Effort:** 10-12 weeks
```

---

### Epic #4: HR Management System
```markdown
**Title:** [EPIC] HR Management & Performance Tracking

**Labels:** `type: feature`, `priority: high`, `module: hr`, `size: xl`

**Milestone:** HR Management System

**Description:**
Comprehensive HR management system with shift scheduling, attendance tracking, leave management, and performance scoring.

**Current Status:**
- ✅ Database Schema (100%)
- ✅ Backend API (100%)
- ✅ Frontend Components (80%)
- ❌ Performance Dashboard (0%)
- ❌ Advanced Analytics (0%)

**Goals:**
- ✅ Shift management and scheduling
- ✅ Attendance tracking with photo capture
- ✅ Leave request and approval workflow
- ✅ Leave balance management
- 🔄 Performance scoring system
- ⏳ HR analytics dashboard
- ⏳ Payroll integration hooks

**Acceptance Criteria:**
- [ ] Shift schedules created and assigned
- [ ] Employees can clock in/out with photo
- [ ] Leave requests approved/rejected by managers
- [ ] Leave balances auto-calculated
- [ ] Performance scores tracked monthly
- [ ] Leaderboards display top performers
- [ ] HR audit trail complete
- [ ] Reports exported to Excel/PDF

**Related Issues:** #24, #25, #26, #27, #28, #29, #30

**Dependencies:** None

**Estimated Effort:** 14-16 weeks
```

---

### Epic #5: AI-Powered Sales Intelligence
```markdown
**Title:** [EPIC] AI-Powered Sales Intelligence & Automation

**Labels:** `type: feature`, `priority: medium`, `module: ai`, `module: sales`, `size: l`

**Milestone:** AI & Automation

**Description:**
AI-powered features for sales assistance, product recommendations, and intelligent automation.

**Current Status:**
- ✅ Sales Intent API with multi-product support (100%)
- ✅ Anthropic Claude integration (100%)
- ✅ Error handling and retry logic (100%)
- ⏳ Frontend chat interface (0%)
- ⏳ Advanced recommendations (0%)

**Goals:**
- ✅ Natural language product search
- ✅ Multi-product intent parsing
- 🔄 Conversational sales assistant UI
- ⏳ Smart product recommendations
- ⏳ Inventory optimization suggestions
- ⏳ Price optimization AI
- ⏳ Customer behavior predictions

**Acceptance Criteria:**
- [ ] Users can search products using natural language
- [ ] AI suggests related/complementary products
- [ ] Chat interface integrated in POS
- [ ] Recommendations improve sales conversion
- [ ] AI learns from historical sales patterns
- [ ] Price suggestions based on demand/competition
- [ ] Customer purchase predictions available

**Related Issues:** #31, #32, #33, #34, #35

**Dependencies:** None

**Estimated Effort:** 10-12 weeks
```

---

### Epic #6: Multi-Tenant Architecture
```markdown
**Title:** [EPIC] Multi-Tenant Store & Business Architecture

**Labels:** `type: feature`, `priority: medium`, `module: core`, `size: xl`

**Milestone:** Multi-Tenant Architecture

**Description:**
Enable the system to support multiple businesses, each with multiple stores, with complete data isolation and role-based access.

**Current Status:**
- 🔄 Basic multi-store support exists
- ❌ Full tenant isolation (0%)
- ❌ Tenant management UI (0%)

**Goals:**
- ⏳ Tenant registration and onboarding
- ⏳ Complete data isolation by tenant
- ⏳ Cross-store inventory transfer
- ⏳ Centralized reporting across stores
- ⏳ Store-specific configurations
- ⏳ Tenant billing and subscription management

**Acceptance Criteria:**
- [ ] Multiple businesses can use the system
- [ ] Complete data isolation between tenants
- [ ] Store managers access only their store data
- [ ] Business owners see all stores in their business
- [ ] Cross-store inventory transfers tracked
- [ ] Consolidated reports available
- [ ] Subscription billing automated

**Related Issues:** #36, #37, #38, #39, #40, #41

**Dependencies:** Epic #1 (Security Hardening)

**Estimated Effort:** 16-20 weeks
```

---

## 📝 FEATURE ISSUES (Sample - Top Priority)

### Feature #2: Apply Phase 4 Error Handling to All Services
```markdown
**Title:** Apply Phase 4 Error Handling Pattern to All Services

**Labels:** `type: enhancement`, `priority: high`, `module: core`, `component: backend`, `size: l`

**Milestone:** Core Stability & Security

**Epic:** #1 (Security & Stability Hardening)

**Description:**
Apply the comprehensive error handling pattern established in Phase 4 to all 16 backend services (~124 methods total).

**Context:**
- ✅ Infrastructure complete: `http-exception.filter.ts`
- ✅ Custom exception classes created
- ❌ Pattern not yet applied to all services

**Services to Update (Priority Order):**
1. sale.service.ts (HIGH - customer facing)
2. purchase-invoice.service.ts (HIGH - financial)
3. customer.service.ts (MEDIUM)
4. product.service.ts (MEDIUM)
5. stock.service.ts (MEDIUM)
6. vendor.service.ts (MEDIUM)
7. user.service.ts (MEDIUM)
8. role.service.ts (LOW)
9. report.service.ts (LOW)
10. document.service.ts (LOW)
11. file.service.ts (LOW)
12. lookup.service.ts (LOW)
13. backup.service.ts (LOW)
14. gst-report.service.ts (MEDIUM)
15. sales-intent.service.ts (MEDIUM - AI integration)
16. download.service.ts (LOW)

**Acceptance Criteria:**
- [ ] All services use try-catch blocks consistently
- [ ] Business exceptions thrown using custom classes
- [ ] HttpExceptions re-thrown without modification
- [ ] Generic errors logged and converted to HTTP 500
- [ ] Sensitive data redacted in all error messages
- [ ] All error scenarios tested
- [ ] Documentation updated

**Tasks:**
- [ ] #50: Update sale.service.ts error handling
- [ ] #51: Update purchase-invoice.service.ts error handling
- [ ] #52: Update customer.service.ts error handling
- [ ] #53: Update product.service.ts error handling
- [ ] #54: Update stock.service.ts error handling
- [ ] #55: Update remaining 11 services

**Estimated Effort:** 3-4 weeks (2-3 services per week)

**Dependencies:** None (infrastructure complete)

**References:**
- Implementation guide: `docs/guides/PHASE4_ERROR_HANDLING_GUIDE.md`
- Infrastructure PR: #42
```

---

### Feature #9: Invoice Document Upload with OCR
```markdown
**Title:** Invoice Document Upload with OCR Integration

**Labels:** `type: feature`, `priority: high`, `module: purchases`, `component: backend`, `component: frontend`, `size: l`

**Milestone:** Enhanced Invoice Lifecycle

**Epic:** #2 (Enhanced Purchase Invoice Lifecycle)

**Description:**
Enable users to upload invoice PDF/image documents and automatically extract data using OCR.

**Current Status:**
- ✅ Backend API endpoints created
- ✅ Entity definitions complete
- ❌ OCR integration (0%)
- ❌ Frontend upload UI (0%)

**Goals:**
- Automatic extraction of invoice number, date, vendor, amounts
- Support for PDF and image formats (JPG, PNG)
- Manual correction interface for OCR errors
- Document attachment to purchase invoice records
- Document versioning and history

**Acceptance Criteria:**
- [ ] Users can drag-and-drop invoice documents
- [ ] OCR extracts invoice metadata with >85% accuracy
- [ ] Extracted data pre-fills invoice form
- [ ] Users can manually correct OCR errors
- [ ] Documents stored securely with encryption
- [ ] Multiple documents can be attached to one invoice
- [ ] Document preview available
- [ ] Audit trail for document uploads

**Technical Requirements:**
- [ ] Integrate OCR service (Tesseract or cloud service)
- [ ] File size limit: 10MB per document
- [ ] Supported formats: PDF, JPG, PNG, TIFF
- [ ] Secure file storage with access control
- [ ] Thumbnail generation for preview

**Tasks:**
- [ ] #60: Research and select OCR service
- [ ] #61: Implement backend OCR processing
- [ ] #62: Create document upload API endpoint
- [ ] #63: Build frontend file upload component
- [ ] #64: Create OCR correction interface
- [ ] #65: Add document preview functionality
- [ ] #66: Implement document security and access control
- [ ] #67: Write integration tests

**Estimated Effort:** 4-5 weeks

**Dependencies:**
- File storage service configured
- Purchase invoice API complete

**References:**
- Documentation: `docs/INVOICE_DOCUMENT_UPLOAD_OCR.md`
```

---

### Feature #10: Payment Tracking & Reconciliation UI
```markdown
**Title:** Payment Tracking & Reconciliation User Interface

**Labels:** `type: feature`, `priority: high`, `module: purchases`, `component: frontend`, `size: m`

**Milestone:** Enhanced Invoice Lifecycle

**Epic:** #2 (Enhanced Purchase Invoice Lifecycle)

**Description:**
Build frontend UI for tracking multiple payments against purchase invoices and reconciling payment status.

**Current Status:**
- ✅ Backend API complete (6 endpoints)
- ❌ Frontend UI (0%)

**Goals:**
- Record multiple payments for a single invoice
- Display payment history timeline
- Show outstanding balance in real-time
- Payment reconciliation workflow
- Payment reminders for due invoices

**Acceptance Criteria:**
- [ ] Users can add new payments with amount, date, method
- [ ] Payment history displayed in chronological order
- [ ] Invoice status updates automatically (UNPAID → PARTIAL → PAID)
- [ ] Outstanding balance calculated correctly
- [ ] Payment types supported: ADVANCE, PARTIAL, FULL
- [ ] Payment reconciliation report available
- [ ] Overdue payments highlighted with alerts
- [ ] Export payment records to Excel

**UI Components Needed:**
1. Payment form modal
2. Payment history timeline
3. Payment summary card
4. Reconciliation dashboard
5. Payment reminder alerts

**Tasks:**
- [ ] #68: Create payment form component
- [ ] #69: Build payment history timeline component
- [ ] #70: Design payment summary dashboard
- [ ] #71: Implement reconciliation interface
- [ ] #72: Add payment reminder notifications
- [ ] #73: Create payment reports
- [ ] #74: Write E2E tests

**Estimated Effort:** 2-3 weeks

**Dependencies:**
- #9: Invoice Document Upload (optional)
- Backend payment API complete

**API Endpoints:**
- POST `/purchases/invoices/:id/payments`
- GET `/purchases/invoices/:id/payments`
- GET `/purchases/payments/reconciliation`
```

---

### Feature #17: GSTR-1 Report Generation Frontend
```markdown
**Title:** GSTR-1 Report Generation Frontend Interface

**Labels:** `type: feature`, `priority: critical`, `module: gst`, `module: reports`, `component: frontend`, `size: m`

**Milestone:** GST Compliance Complete

**Epic:** #3 (GST Compliance & Reporting)

**Description:**
Build user interface for generating GSTR-1 reports (B2B, B2C Large, B2C Small, HSN Summary).

**Current Status:**
- ✅ Backend API complete
- ✅ Report calculation logic complete
- ❌ Frontend UI (0%)

**Goals:**
- Generate all GSTR-1 report tables
- Export to Excel and JSON formats
- Filter by date range, customer type
- Preview before export
- Save report configurations

**Acceptance Criteria:**
- [ ] Users select month/quarter for GSTR-1
- [ ] B2B sales report (Table 4) displays correctly
- [ ] B2C Large sales report (Table 5) shows >2.5L invoices
- [ ] B2C Small sales report (Table 7) consolidated by state
- [ ] HSN Summary (Table 12) shows product-wise breakdown
- [ ] Reports exportable to Excel with proper formatting
- [ ] JSON export compatible with GST portal
- [ ] Report validation checks implemented
- [ ] Error summary displayed if data incomplete

**UI Components Needed:**
1. Report period selector (month/quarter picker)
2. Report type selector (B2B/B2C/HSN)
3. Data table with sorting and filtering
4. Export button with format options
5. Validation status indicators
6. Report configuration save/load

**Tasks:**
- [ ] #75: Create GSTR-1 report container component
- [ ] #76: Build B2B sales report table
- [ ] #77: Build B2C Large sales report table
- [ ] #78: Build B2C Small sales report table
- [ ] #79: Build HSN Summary table
- [ ] #80: Implement Excel export functionality
- [ ] #81: Implement JSON export for GST portal
- [ ] #82: Add report validation logic
- [ ] #83: Create report preview mode
- [ ] #84: Write integration tests

**Estimated Effort:** 3-4 weeks

**Dependencies:**
- Backend GST report API complete
- HSN codes populated for all products

**API Endpoints:**
- GET `/reports/gst/gstr1/b2b?month=2025-01`
- GET `/reports/gst/gstr1/b2c-large?month=2025-01`
- GET `/reports/gst/gstr1/b2c-small?month=2025-01`
- GET `/reports/gst/gstr1/hsn-summary?month=2025-01`
```

---

### Feature #24: Shift Management System
```markdown
**Title:** Shift Management & Scheduling System

**Labels:** `type: feature`, `priority: high`, `module: hr`, `component: backend`, `component: frontend`, `size: m`

**Milestone:** HR Management System

**Epic:** #4 (HR Management & Performance Tracking)

**Description:**
Complete shift management system allowing admins to create shifts and assign users to work schedules.

**Current Status:**
- ✅ Database schema complete
- ✅ Backend API complete
- 🔄 Frontend UI (50% - needs enhancement)

**Goals:**
- Create shift templates (Morning, Evening, Night)
- Assign users to shifts
- View shift coverage by day/week/month
- Shift swap requests
- Shift overlap detection

**Acceptance Criteria:**
- [ ] Admins can create shift templates with start/end times
- [ ] Users can be assigned to single or recurring shifts
- [ ] Shift calendar view shows coverage
- [ ] Overlap warnings if user assigned to multiple shifts
- [ ] Shift swap workflow implemented
- [ ] Shift reports exportable
- [ ] Mobile-responsive shift calendar

**UI Components Needed:**
1. Shift template form
2. User assignment interface
3. Weekly/monthly calendar view
4. Shift coverage dashboard
5. Shift swap request modal

**Tasks:**
- [ ] #85: Enhance shift creation form
- [ ] #86: Build shift assignment interface
- [ ] #87: Create shift calendar component
- [ ] #88: Implement shift coverage dashboard
- [ ] #89: Add shift swap workflow
- [ ] #90: Create shift reports
- [ ] #91: Add mobile responsive calendar
- [ ] #92: Write E2E tests

**Estimated Effort:** 2-3 weeks

**Dependencies:**
- User management complete
- HR database schema migrated
```

---

### Feature #31: AI Sales Assistant Chat Interface
```markdown
**Title:** AI Sales Assistant Conversational Chat Interface

**Labels:** `type: feature`, `priority: medium`, `module: ai`, `module: sales`, `component: frontend`, `size: m`

**Milestone:** AI & Automation

**Epic:** #5 (AI-Powered Sales Intelligence)

**Description:**
Build conversational chat interface for the AI-powered sales assistant in the POS system.

**Current Status:**
- ✅ Backend sales intent API complete
- ✅ Multi-product support implemented
- ❌ Frontend chat UI (0%)

**Goals:**
- Natural language product search
- Conversational interface for sales queries
- Product recommendations display
- Quick add to cart from chat
- Context-aware responses

**Acceptance Criteria:**
- [ ] Chat interface embedded in POS screen
- [ ] Users can type natural language queries
- [ ] AI responds with product suggestions
- [ ] Product cards clickable to add to cart
- [ ] Conversation history maintained during session
- [ ] Loading states during AI processing
- [ ] Error handling for API failures
- [ ] Typing indicators for better UX
- [ ] Mobile-responsive chat layout

**UI Components Needed:**
1. Chat message bubbles (user/assistant)
2. Product suggestion cards
3. Quick action buttons (Add to Cart)
4. Message input with send button
5. Typing indicator
6. Error/retry mechanism
7. Chat history panel

**Tasks:**
- [ ] #95: Design chat UI mockups
- [ ] #96: Build chat container component
- [ ] #97: Create message bubble components
- [ ] #98: Implement product card components
- [ ] #99: Add typing indicators and loading states
- [ ] #100: Integrate with sales intent API
- [ ] #101: Add error handling and retry logic
- [ ] #102: Implement conversation history
- [ ] #103: Add quick actions (add to cart)
- [ ] #104: Make chat mobile responsive
- [ ] #105: Write E2E tests

**Estimated Effort:** 3-4 weeks

**Dependencies:**
- Sales intent API complete
- Product catalog API available
- Cart management system

**API Endpoints:**
- POST `/sales-intent/query` (existing)
- GET `/products/search` (existing)
```

---

## 🔧 TASK ISSUES (Sample)

### Task #50: Update sale.service.ts Error Handling
```markdown
**Title:** Update sale.service.ts with Phase 4 Error Handling Pattern

**Labels:** `type: enhancement`, `priority: high`, `module: sales`, `component: backend`, `size: s`

**Milestone:** Core Stability & Security

**Parent:** #2 (Apply Phase 4 Error Handling)

**Description:**
Apply the Phase 4 error handling pattern to all methods in `sale.service.ts`.

**Methods to Update:**
1. `create()` - Create new sale with transaction
2. `findAll()` - Get all sales
3. `findOne()` - Get sale by ID
4. `update()` - Update sale
5. `remove()` - Delete/archive sale
6. `findByBillNumber()` - Search by bill number
7. `findByDate()` - Sales by date range
8. `calculateTotal()` - Internal calculation

**Implementation Checklist:**
- [ ] Wrap all database operations in try-catch
- [ ] Use `BusinessException` for business rule violations
- [ ] Use `StockException` for stock-related errors
- [ ] Re-throw HttpExceptions without modification
- [ ] Log all errors with context
- [ ] Add error tests for each method
- [ ] Update JSDoc comments with @throws annotations

**Code Pattern:**
```typescript
async create(dto: CreateSaleDto, userId: number): Promise<Sale> {
  try {
    // Validate business rules
    if (!dto.items || dto.items.length === 0) {
      throw new BusinessException('Sale must have at least one item');
    }

    // Check stock availability
    for (const item of dto.items) {
      const stock = await this.checkStock(item.productId, item.quantity);
      if (!stock) {
        throw new StockException(
          `Insufficient stock for product ${item.productId}`
        );
      }
    }

    // Perform operation in transaction
    return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const sale = await manager.save(Sale, dto);
      // ... rest of transaction
      return sale;
    });

  } catch (error) {
    if (error instanceof HttpException) throw error;
    this.logger.error('Error creating sale:', error.stack);
    throw new HttpException('Failed to create sale', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

**Testing Requirements:**
- [ ] Test successful sale creation
- [ ] Test stock validation error
- [ ] Test business rule violations
- [ ] Test transaction rollback on error
- [ ] Test error logging

**Estimated Effort:** 4-6 hours

**Dependencies:** None

**References:**
- Guide: `docs/guides/PHASE4_ERROR_HANDLING_GUIDE.md`
- Filter: `api-v2/src/core/http-exception.filter.ts`
- Exceptions: `api-v2/src/core/exceptions/business.exception.ts`
```

---

### Task #60: Research and Select OCR Service
```markdown
**Title:** Research OCR Services for Invoice Document Processing

**Labels:** `type: research`, `priority: high`, `module: purchases`, `size: xs`

**Milestone:** Enhanced Invoice Lifecycle

**Parent:** #9 (Invoice Document Upload with OCR)

**Description:**
Research and evaluate OCR services for extracting data from invoice documents (PDF/images).

**Evaluation Criteria:**
1. **Accuracy:** >85% for structured invoices
2. **Languages:** English, Hindi support
3. **Formats:** PDF, JPG, PNG, TIFF
4. **Pricing:** Cost per document/API call
5. **Latency:** Response time <5 seconds
6. **Integration:** API ease of use, SDKs available
7. **Support:** Documentation, community

**Options to Evaluate:**

**Option 1: Tesseract OCR (Open Source)**
- Pros: Free, self-hosted, privacy
- Cons: Lower accuracy, requires training
- Cost: $0
- Setup complexity: High

**Option 2: Google Cloud Vision API**
- Pros: High accuracy, good documentation
- Cons: Paid per call, data privacy concerns
- Cost: $1.50 per 1000 documents
- Setup complexity: Medium

**Option 3: AWS Textract**
- Pros: Structured data extraction, form detection
- Cons: Higher cost, AWS dependency
- Cost: $1.50-$15 per 1000 pages (depending on features)
- Setup complexity: Medium

**Option 4: Azure Computer Vision**
- Pros: Good OCR, invoice-specific features
- Cons: Microsoft dependency
- Cost: $1.50 per 1000 transactions
- Setup complexity: Medium

**Option 5: OCR.space (Cloud)**
- Pros: Simple API, free tier
- Cons: Rate limits, lower accuracy
- Cost: Free tier: 25,000/month, Paid: $60/month
- Setup complexity: Low

**Deliverables:**
- [ ] Comparison matrix (accuracy, cost, features)
- [ ] Proof-of-concept test with sample invoices
- [ ] Recommendation with justification
- [ ] Cost projection for 1000 invoices/month

**Estimated Effort:** 4-6 hours

**Acceptance Criteria:**
- [ ] At least 3 services tested with real invoice samples
- [ ] Accuracy comparison documented
- [ ] Cost analysis for projected usage
- [ ] Security and privacy assessment
- [ ] Final recommendation documented

**Dependencies:** None
```

---

### Task #68: Create Payment Form Component
```markdown
**Title:** Create Payment Recording Form Component

**Labels:** `type: feature`, `priority: high`, `module: purchases`, `component: frontend`, `size: xs`

**Milestone:** Enhanced Invoice Lifecycle

**Parent:** #10 (Payment Tracking & Reconciliation UI)

**Description:**
Build Angular component for recording payments against purchase invoices.

**Component Specification:**

**File:** `frontend/src/app/secured/purchases/components/payment-form.component.ts`

**Inputs:**
- `@Input() invoiceId: number` - Invoice to record payment for
- `@Input() outstandingBalance: number` - Remaining amount to pay

**Outputs:**
- `@Output() paymentAdded: EventEmitter<VendorPayment>` - Emitted when payment saved

**Form Fields:**
1. Payment Date (required, date picker, default: today)
2. Payment Amount (required, number, max: outstanding balance)
3. Payment Type (required, dropdown: ADVANCE/PARTIAL/FULL)
4. Payment Method (required, dropdown: CASH/CHEQUE/BANK_TRANSFER/UPI)
5. Reference Number (optional, text)
6. Notes (optional, textarea)

**Validation Rules:**
- [ ] Payment amount > 0
- [ ] Payment amount <= outstanding balance
- [ ] Payment date <= today
- [ ] If payment type = FULL, amount must equal outstanding balance
- [ ] Reference number required for CHEQUE/BANK_TRANSFER

**UI Requirements:**
- [ ] Modal dialog overlay
- [ ] Responsive layout (mobile + desktop)
- [ ] Real-time validation with error messages
- [ ] Outstanding balance displayed prominently
- [ ] Submit and Cancel buttons
- [ ] Loading state during API call
- [ ] Success notification on save

**Acceptance Criteria:**
- [ ] Form validates all required fields
- [ ] Payment amount cannot exceed outstanding balance
- [ ] FULL payment auto-fills outstanding amount
- [ ] Success notification displays after save
- [ ] Form resets after successful submit
- [ ] Error messages displayed clearly
- [ ] Mobile responsive (320px min width)

**Tasks:**
- [ ] Create component structure
- [ ] Build reactive form with validation
- [ ] Style modal dialog
- [ ] Integrate with payment API
- [ ] Add loading states
- [ ] Write unit tests
- [ ] Test on mobile devices

**API Integration:**
```typescript
POST /purchases/invoices/:id/payments
{
  "payment_date": "2025-01-09",
  "amount": 50000,
  "payment_type": "PARTIAL",
  "payment_method": "BANK_TRANSFER",
  "reference_number": "TXN123456",
  "notes": "Payment for Invoice #123"
}
```

**Estimated Effort:** 6-8 hours

**Dependencies:**
- Payment API endpoint available
- Invoice service with getOutstandingBalance() method

**Testing Checklist:**
- [ ] Unit tests for form validation
- [ ] Integration test for API call
- [ ] E2E test for complete payment flow
- [ ] Mobile responsiveness test
```

---

### Task #75: Create GSTR-1 Report Container Component
```markdown
**Title:** Create GSTR-1 Report Container Component

**Labels:** `type: feature`, `priority: critical`, `module: gst`, `component: frontend`, `size: s`

**Milestone:** GST Compliance Complete

**Parent:** #17 (GSTR-1 Report Generation Frontend)

**Description:**
Build main container component for GSTR-1 report generation with period selection and report type navigation.

**Component Specification:**

**File:** `frontend/src/app/secured/reports/gst/gstr1-report.component.ts`

**Features:**
1. Month/Quarter picker
2. Report type tabs (B2B, B2C Large, B2C Small, HSN)
3. Export buttons (Excel, JSON)
4. Validation status indicator
5. Loading states

**Component Structure:**
```
gstr1-report/
├── gstr1-report.component.ts       # Container
├── gstr1-report.component.html     # Template
├── gstr1-report.component.scss     # Styles
├── components/
│   ├── b2b-report.component.ts     # B2B table
│   ├── b2c-large-report.component.ts
│   ├── b2c-small-report.component.ts
│   └── hsn-summary.component.ts
└── models/
    └── gstr1.model.ts               # TypeScript interfaces
```

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  GSTR-1 Report                          │
├─────────────────────────────────────────┤
│  Period: [Jan 2025 ▼]  [Generate]      │
│                                         │
│  ┌─────┬──────────┬──────────┬────┐    │
│  │ B2B │ B2C Large│ B2C Small│HSN │    │
│  └─────┴──────────┴──────────┴────┘    │
│                                         │
│  ┌───────────────────────────────┐     │
│  │  Report Data Table            │     │
│  │  (active tab content)         │     │
│  └───────────────────────────────┘     │
│                                         │
│  [Export Excel] [Export JSON]          │
│  Validation: ✓ 0 errors                │
└─────────────────────────────────────────┘
```

**State Management:**
```typescript
interface Gstr1State {
  selectedPeriod: string;        // "2025-01"
  activeTab: 'B2B' | 'B2C_LARGE' | 'B2C_SMALL' | 'HSN';
  isLoading: boolean;
  validationErrors: string[];
  reportData: any;               // Tab-specific data
}
```

**Acceptance Criteria:**
- [ ] Month picker shows last 12 months
- [ ] Quarter picker available (Q1-Q4)
- [ ] Tab navigation works smoothly
- [ ] Generate button triggers API call
- [ ] Loading spinner during data fetch
- [ ] Validation errors displayed clearly
- [ ] Export buttons enabled only when data loaded
- [ ] Responsive on mobile and desktop

**Tasks:**
- [ ] Create component boilerplate
- [ ] Implement period selector
- [ ] Add tab navigation
- [ ] Integrate with report API
- [ ] Add export functionality
- [ ] Implement validation display
- [ ] Style with Bootstrap
- [ ] Write unit tests

**API Calls:**
```typescript
// Fetch report data
GET /reports/gst/gstr1/b2b?month=2025-01

// Export to Excel
GET /reports/gst/gstr1/export/excel?month=2025-01&type=B2B

// Export to JSON
GET /reports/gst/gstr1/export/json?month=2025-01
```

**Estimated Effort:** 8-10 hours

**Dependencies:**
- GST report API complete
- Export service implemented

**Testing Checklist:**
- [ ] Unit tests for period selection
- [ ] Unit tests for tab switching
- [ ] Integration test for API calls
- [ ] E2E test for full report generation
- [ ] Mobile responsiveness test
```

---

## 📊 GitHub Project Board Views

### View 1: By Status (Default)
```
Columns: Backlog → To Do → In Progress → Review → Testing → Done
Filter: All issues
Sort: Priority (Critical → Low)
```

### View 2: By Module
```
Group By: Module label
Filter: type: feature OR type: enhancement
Sort: Priority
```

### View 3: By Epic
```
Group By: Epic (parent issue)
Filter: Exclude epics themselves
Sort: Status
```

### View 4: Sprint Planning
```
Filter: status: ready OR status: in-progress
Sort: Priority, then Size
Layout: Table view with columns:
- Title
- Type
- Module
- Priority
- Size
- Assignee
- Status
```

### View 5: Bug Tracking
```
Filter: type: bug
Group By: Priority
Sort: Created date (newest first)
```

---

## 🚀 Quick Start Checklist

### Step 1: Create Labels
```bash
# Use GitHub CLI or web interface
gh label create "priority: critical" --color d73a4a
gh label create "type: feature" --color 0052cc
gh label create "module: core" --color 001f3f
gh label create "size: m" --color c5def5
# ... (repeat for all labels)
```

### Step 2: Create Milestones
- Go to Issues → Milestones → New Milestone
- Create all 6 milestones with due dates

### Step 3: Create Epic Issues
- Create issues #1-#6 using epic templates above
- Add labels, milestones, descriptions

### Step 4: Create Feature Issues
- Create feature issues under each epic
- Link to parent epic in description
- Add proper labels and milestones

### Step 5: Create Task Issues
- Create task issues under each feature
- Use task lists in parent features
- Link using "Parent:" reference

### Step 6: Set Up Project Board
- Create new project (Projects → New Project)
- Choose "Board" layout
- Create columns as specified
- Add automation rules (optional)

### Step 7: Add Issues to Project
- Add all issues to project board
- Set initial status (most to "Backlog")
- Assign priorities

---

## 📈 Metrics to Track

### Velocity Metrics
- Issues completed per week
- Story points (size) completed per sprint
- Average time in each status column

### Quality Metrics
- Bug count by module
- Bug fix time (reported → resolved)
- Test coverage percentage

### Progress Metrics
- Epic completion percentage
- Milestone progress
- Features vs. bugs ratio

---

## 🔄 Workflow Automation (GitHub Actions)

### Auto-label PRs
```yaml
# .github/workflows/label-pr.yml
name: Auto Label PR
on: pull_request
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/labeler@v4
```

### Auto-close linked issues
```yaml
# Use keywords in PR description:
# "Closes #50" or "Fixes #68"
```

### Stale issue management
```yaml
# .github/workflows/stale.yml
name: Close Stale Issues
on:
  schedule:
    - cron: '0 0 * * *'
jobs:
  stale:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/stale@v8
        with:
          stale-issue-message: 'This issue is stale'
          days-before-stale: 60
          days-before-close: 7
```

---

## 📝 Issue Template (.github/ISSUE_TEMPLATE/)

### Feature Template
```markdown
---
name: Feature Request
about: Propose a new feature
labels: type: feature
---

## Description
<!-- Clear description of the feature -->

## Problem Statement
<!-- What problem does this solve? -->

## Proposed Solution
<!-- How should this work? -->

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Additional Context
<!-- Screenshots, mockups, references -->
```

### Bug Template
```markdown
---
name: Bug Report
about: Report a bug
labels: type: bug
---

## Bug Description
<!-- What's broken? -->

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
<!-- What should happen? -->

## Actual Behavior
<!-- What actually happens? -->

## Environment
- Browser/OS:
- Version:

## Screenshots
<!-- If applicable -->
```

---

**Last Updated:** 2025-01-09
**Total Estimated Issues:** ~150-200
**Estimated Timeline:** 12-18 months for all epics

---

## Next Steps

1. Review this document
2. Adjust priorities based on business needs
3. Create labels in GitHub
4. Create milestones with target dates
5. Start creating epic issues (#1-#6)
6. Break down epics into feature issues
7. Set up project board with views
8. Begin sprint planning with team

**Questions?** Review the issue templates and adjust to your team's workflow!
