# GitHub Issues - RGP Back Office Improvements
## Prioritized Development Backlog - 2026

---

## P0 - CRITICAL ISSUES (Fix Immediately) 🔴

### Issue #1: Implement Batch/Expiry Tracking with FIFO/FEFO Enforcement
**Priority**: P0 - CRITICAL
**Module**: Products
**Type**: Feature / Compliance
**Milestone**: Q1 2026 - Month 1
**Estimated Effort**: 8 story points (2 weeks)

**Description**:
Implement comprehensive batch and expiry date tracking for all products to ensure regulatory compliance and prevent sale of expired medicines. This is a CRITICAL compliance requirement for pharmacy operations.

**Problem Statement**:
- Currently no enforcement of First-In-First-Out (FIFO) or First-Expiry-First-Out (FEFO)
- Risk of selling expired medicines (regulatory violation + customer safety)
- No automated alerts for near-expiry products
- Stock reports don't show batch-wise breakdown

**Requirements**:

1. **Database Schema**
   - Add `batch_number` and `expiry_date` to `product_qtychange` table
   - Create `product_batch` table with fields:
     - id, product_id, batch_number, expiry_date, manufactured_date
     - quantity_received, quantity_remaining, ptr_cost
     - received_date, vendor_id, purchase_invoice_item_id
   - Add index on (product_id, expiry_date) for fast lookups

2. **Backend Implementation**
   - Create `ProductBatchService` with methods:
     - `createBatch()` - Record new batch on purchase
     - `getAvailableBatches()` - Get non-expired batches for a product
     - `allocateBatch()` - FEFO allocation logic for sales
     - `checkExpiry()` - Validate batch not expired
   - Update `SaleService` to:
     - Allocate from earliest expiring batch first (FEFO)
     - Block sale if only expired batches available
     - Record batch_id in sale_item table
   - Update `StockService` to show batch-wise stock levels

3. **Frontend Implementation**
   - Purchase Invoice: Add batch number and expiry date fields
   - POS/Sales: Display batch info when product selected
   - Stock View: Show batch-wise breakdown with expiry dates
   - Create "Near Expiry Dashboard":
     - Products expiring in 30/60/90 days
     - Quantity and value at risk
     - Actions: Discount, Return to Vendor, Donate

4. **Automated Alerts**
   - Daily cron job to identify near-expiry products
   - Email alerts to inventory manager
   - Visual indicators in POS (yellow for <90 days, red for <30 days)

5. **Reports**
   - Batch-wise stock report
   - Expiry analysis report
   - FEFO compliance report (verify all sales used oldest batches)

**Acceptance Criteria**:
- [ ] All purchase invoices capture batch number and expiry date
- [ ] POS blocks sale of expired products with clear error message
- [ ] Sales automatically allocate from earliest expiring batch (FEFO)
- [ ] Near-expiry dashboard shows products expiring in next 90 days
- [ ] Stock reports include batch-wise breakdown
- [ ] Automated daily email alerts for near-expiry items
- [ ] Unit tests for FEFO allocation logic (80% coverage)
- [ ] Integration tests for sale with expired batch blocking

**Technical Notes**:
- Use PostgreSQL CHECK constraint to prevent expiry_date < CURRENT_DATE
- Consider using database triggers for automated expiry validation
- Add database migration with rollback script

**Related Issues**:
- Depends on: None
- Blocks: #7 (Near-Expiry Alerts)
- Related: #8 (Stock Audit Trail)

**Labels**: `P0-critical`, `compliance`, `products`, `inventory`, `feature`

---

### Issue #2: Implement Immutable Stock Audit Trail
**Priority**: P0 - CRITICAL
**Module**: Inventory / Stock
**Type**: Security / Compliance
**Milestone**: Q1 2026 - Month 1
**Estimated Effort**: 5 story points (1 week)

**Description**:
Create an immutable audit log for all stock movements to detect shrinkage, theft, and wastage. Critical for loss prevention and financial accuracy.

**Problem Statement**:
- Current stock tracking doesn't log all movements with proper audit trail
- Can't trace who made stock adjustments and why
- Shrinkage and theft difficult to detect
- No accountability for stock discrepancies

**Requirements**:

1. **Database Schema**
   - Create `stock_audit_log` table:
     ```sql
     CREATE TABLE stock_audit_log (
       id SERIAL PRIMARY KEY,
       product_id INTEGER NOT NULL,
       batch_id INTEGER,
       movement_type VARCHAR(50) NOT NULL, -- PURCHASE, SALE, ADJUSTMENT, RETURN, DAMAGE, EXPIRY, TRANSFER
       quantity_before INTEGER NOT NULL,
       quantity_change INTEGER NOT NULL,
       quantity_after INTEGER NOT NULL,
       reference_type VARCHAR(50), -- SALE, PURCHASE_INVOICE, STOCK_ADJUSTMENT
       reference_id INTEGER,
       reason TEXT,
       created_by INTEGER NOT NULL,
       created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       ip_address VARCHAR(45),
       CONSTRAINT stock_audit_log_immutable CHECK (created_on IS NOT NULL)
     );
     CREATE INDEX idx_stock_audit_product ON stock_audit_log(product_id, created_on DESC);
     ```
   - Add trigger to prevent UPDATE/DELETE on stock_audit_log (immutable)

2. **Backend Implementation**
   - Create `StockAuditService`:
     - `logMovement()` - Record every stock change
     - `getAuditTrail()` - Retrieve history for a product
     - `getDiscrepancyReport()` - Expected vs actual stock
   - Update all services that change stock:
     - `SaleService.create()` - Log SALE movement
     - `PurchaseInvoiceService.createItem()` - Log PURCHASE
     - `StockService.adjustStock()` - Log ADJUSTMENT with mandatory reason
     - `ReturnService.processReturn()` - Log RETURN
   - Add database transaction wrapper to ensure audit log + stock change are atomic

3. **Frontend Implementation**
   - Stock Adjustment Form: Add mandatory "Reason" dropdown
     - Options: Damage, Expiry, Theft, Correction, Transfer
   - Product Detail Page: Add "Audit Trail" tab showing:
     - Date/Time, User, Movement Type, Quantity Change, Reason, Reference
   - Stock Discrepancy Report:
     - Compare system stock vs physical count
     - Highlight mismatches > 5%
   - User Activity Report: Show stock movements by user

4. **Automated Monitoring**
   - Daily job to detect anomalies:
     - Large negative adjustments (>100 units)
     - Multiple adjustments by same user
     - Stock movements outside business hours
   - Alert store manager via email

5. **Reports**
   - Stock Movement Report (by product, date range, user)
   - Shrinkage Analysis Report (adjustments vs sales ratio)
   - User Activity Report (who made what changes)

**Acceptance Criteria**:
- [ ] All stock changes logged to stock_audit_log table
- [ ] Audit log records are immutable (UPDATE/DELETE blocked)
- [ ] Stock adjustments require mandatory reason selection
- [ ] Product detail page shows complete audit trail
- [ ] Discrepancy report highlights mismatches
- [ ] Daily automated anomaly detection alerts sent
- [ ] Unit tests verify audit logging in all stock-changing operations
- [ ] Performance test: Audit logging doesn't slow down sales by >50ms

**Technical Notes**:
- Use database-level TRIGGER to enforce immutability
- Consider partitioning stock_audit_log by month for performance
- Implement soft deletes for products (never hard delete with audit trail)

**Related Issues**:
- Depends on: None
- Blocks: #25 (Stock Take/Physical Verification)
- Related: #1 (Batch Tracking)

**Labels**: `P0-critical`, `security`, `inventory`, `compliance`, `feature`

---

### Issue #3: Fix Purchase Return Transaction Atomicity
**Priority**: P0 - CRITICAL
**Module**: Purchases
**Type**: Bug / Data Integrity
**Milestone**: Q1 2026 - Month 1
**Estimated Effort**: 5 story points (1 week)

**Description**:
Ensure purchase returns update stock, accounts, and vendor payables atomically to prevent data inconsistencies and financial misstatements.

**Problem Statement**:
- Purchase returns may partially succeed (e.g., stock updated but accounts not)
- If transaction fails midway, data becomes inconsistent
- No proper rollback mechanism
- Can lead to inventory inaccuracies and financial reporting errors

**Requirements**:

1. **Backend Refactoring**
   - Wrap entire return process in SERIALIZABLE transaction:
     ```typescript
     async processPurchaseReturn(returnDto: PurchaseReturnDto, userId: number): Promise<PurchaseReturn> {
       return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
         // 1. Create purchase return record
         const purchaseReturn = await manager.save(PurchaseReturn, returnData);

         // 2. Update stock (deduct returned quantity)
         await manager.query(
           `UPDATE product SET quantity = quantity - $1 WHERE id = $2`,
           [returnDto.quantity, returnDto.productId]
         );

         // 3. Create stock audit log entry
         await manager.save(StockAuditLog, auditData);

         // 4. Update vendor payable (credit vendor account)
         await manager.query(
           `UPDATE vendor_payment SET amount_due = amount_due - $1 WHERE vendor_id = $2`,
           [returnDto.amount, returnDto.vendorId]
         );

         // 5. Update purchase invoice status
         await manager.query(
           `UPDATE purchase_invoice SET status = 'PARTIALLY_RETURNED' WHERE id = $1`,
           [returnDto.purchaseInvoiceId]
         );

         // All or nothing - if any step fails, entire transaction rolls back
         return purchaseReturn;
       });
     }
     ```

2. **Error Handling**
   - Catch transaction errors and return user-friendly messages
   - Log detailed error to server logs for debugging
   - Don't expose internal error details to frontend

3. **Validation**
   - Pre-transaction checks:
     - Return quantity ≤ purchased quantity
     - Product exists and not deleted
     - Vendor account exists
     - Invoice is in returnable status
   - Throw BusinessException with clear message if validation fails

4. **Frontend Updates**
   - Show loading indicator during return processing
   - Display success message with return ID
   - On error, show user-friendly message (not stack trace)
   - Refresh purchase invoice list to show updated status

5. **Testing**
   - Unit tests for each validation rule
   - Integration test: Verify rollback when stock update fails
   - Integration test: Verify rollback when vendor payment update fails
   - Load test: 10 concurrent returns don't cause deadlocks

**Acceptance Criteria**:
- [ ] Entire purchase return process wrapped in SERIALIZABLE transaction
- [ ] If any step fails, entire transaction rolls back (no partial updates)
- [ ] Pre-transaction validations prevent invalid returns
- [ ] Error messages are user-friendly, not technical
- [ ] Stock, vendor payables, and invoice status updated atomically
- [ ] Unit tests verify rollback behavior (80% coverage)
- [ ] Integration test confirms no orphaned records after failed return
- [ ] Load test passes with 10 concurrent returns

**Technical Notes**:
- SERIALIZABLE isolation level may cause deadlocks under high concurrency
- If deadlocks occur, implement retry logic with exponential backoff
- Consider using database-level stored procedure for complex logic

**Related Issues**:
- Depends on: None
- Blocks: None
- Related: #2 (Stock Audit Trail), #20 (GRN Implementation)

**Labels**: `P0-critical`, `bug`, `data-integrity`, `purchases`, `backend`

---

### Issue #4: Implement Payroll Processing Audit Trail
**Priority**: P0 - CRITICAL
**Module**: Payroll
**Type**: Compliance / Feature
**Milestone**: Q1 2026 - Month 1
**Estimated Effort**: 5 story points (1 week)

**Description**:
Create immutable audit log for all payroll processing runs with approval workflow to ensure compliance and transparency.

**Problem Statement**:
- No permanent record of payroll processing history
- Can't trace who approved/processed payroll
- Disputes can't be resolved without audit trail
- Compliance requirement for labor law audits

**Requirements**:

1. **Database Schema**
   - Create `payroll_run_audit` table:
     ```sql
     CREATE TABLE payroll_run_audit (
       id SERIAL PRIMARY KEY,
       payroll_run_id INTEGER NOT NULL,
       status VARCHAR(50) NOT NULL, -- DRAFT, PENDING_APPROVAL, APPROVED, PROCESSED, FAILED
       action VARCHAR(50) NOT NULL, -- CREATE, CALCULATE, APPROVE, PROCESS, CANCEL
       snapshot JSONB NOT NULL, -- Full payroll data snapshot
       performed_by INTEGER NOT NULL,
       performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       remarks TEXT,
       ip_address VARCHAR(45)
     );
     CREATE INDEX idx_payroll_audit_run ON payroll_run_audit(payroll_run_id, performed_at DESC);
     ```
   - Add trigger to prevent UPDATE/DELETE (immutable)

2. **Backend Implementation**
   - Create `PayrollAuditService`:
     - `logAction()` - Record every payroll action
     - `getRunHistory()` - Get audit trail for a payroll run
     - `createSnapshot()` - Serialize full payroll data to JSON
   - Update `PayrollService`:
     - `createPayrollRun()` - Log CREATE action
     - `calculatePayroll()` - Log CALCULATE with data snapshot
     - `approvePayroll()` - Log APPROVE with approver details
     - `processPayroll()` - Log PROCESS, mark as immutable after this
   - Add approval workflow:
     - Payroll clerk creates/calculates (status: DRAFT)
     - Submit for approval (status: PENDING_APPROVAL)
     - Manager approves (status: APPROVED)
     - System processes (status: PROCESSED)

3. **Frontend Implementation**
   - Payroll Run List: Show status badges (Draft, Pending, Approved, Processed)
   - Payroll Detail Page:
     - "Audit Trail" tab showing all actions with timestamps, users
     - "Submit for Approval" button (visible to clerks in DRAFT)
     - "Approve" button (visible to managers in PENDING_APPROVAL)
     - "Process" button (visible to admins in APPROVED)
   - Approval notifications:
     - Email manager when payroll submitted for approval
     - Email clerk when approved/rejected
   - View-only mode after PROCESSED (no edits allowed)

4. **Approval Workflow Rules**
   - Role-based permissions:
     - Clerk: Create, Calculate, Submit
     - Manager: Approve, Reject (with reason)
     - Admin: Process, Cancel (with reason)
   - State transitions:
     - DRAFT → PENDING_APPROVAL (via Submit)
     - PENDING_APPROVAL → APPROVED (via Approve)
     - PENDING_APPROVAL → DRAFT (via Reject)
     - APPROVED → PROCESSED (via Process)
     - Any → CANCELLED (via Cancel, admin only)

5. **Reports**
   - Payroll History Report (all runs with approval details)
   - Pending Approvals Dashboard (for managers)
   - Processing Time Analysis (time spent in each stage)

**Acceptance Criteria**:
- [ ] All payroll actions logged to payroll_run_audit
- [ ] Audit records are immutable
- [ ] Approval workflow enforces role-based permissions
- [ ] Payroll data snapshot captured at each stage
- [ ] Email notifications sent at each workflow transition
- [ ] Processed payrolls cannot be edited
- [ ] Audit trail visible on payroll detail page
- [ ] Unit tests verify workflow state transitions
- [ ] Integration test covers full approval flow

**Technical Notes**:
- Store full payroll data snapshot as JSONB for auditability
- Consider data retention policy (keep audit logs for 7 years)
- Implement "Reprocess" feature for failed payroll runs (with new audit entry)

**Related Issues**:
- Depends on: None
- Blocks: #29 (Tax Computation Accuracy)
- Related: #2 (Stock Audit Trail)

**Labels**: `P0-critical`, `compliance`, `payroll`, `feature`

---

### Issue #5: Implement Strong Password Policy & Security Controls
**Priority**: P0 - CRITICAL
**Module**: Security / Users
**Type**: Security / Feature
**Milestone**: Q1 2026 - Month 1
**Estimated Effort**: 3 story points (3-4 days)

**Description**:
Enforce strong password policies and implement essential security controls to protect against unauthorized access and brute force attacks.

**Problem Statement**:
- Currently allows weak passwords (e.g., "123456")
- No password expiry or complexity requirements
- No account lockout on failed login attempts
- Security vulnerability allows unauthorized access

**Requirements**:

1. **Password Policy Configuration**
   - Add to `business` or `settings` table:
     ```json
     {
       "passwordPolicy": {
         "minLength": 8,
         "requireUppercase": true,
         "requireLowercase": true,
         "requireNumbers": true,
         "requireSpecialChars": true,
         "specialChars": "!@#$%^&*",
         "maxPasswordAge": 90,  // days
         "passwordHistory": 5,   // can't reuse last 5 passwords
         "maxLoginAttempts": 5,
         "lockoutDuration": 30   // minutes
       }
     }
     ```

2. **Database Schema**
   - Add to `app_user` table:
     - `password_changed_on` TIMESTAMP
     - `password_history` JSONB (array of hashed old passwords)
     - `failed_login_attempts` INTEGER DEFAULT 0
     - `locked_until` TIMESTAMP
     - `last_login_attempt` TIMESTAMP
   - Create `password_reset_token` table:
     - id, user_id, token, expires_at, used (boolean)

3. **Backend Implementation**
   - Create `PasswordPolicyService`:
     - `validatePassword(password: string)` - Check complexity rules
     - `checkPasswordExpiry(user: User)` - Is password expired?
     - `checkPasswordHistory(user: User, newPassword: string)` - Was it used before?
     - `hashPassword(password: string)` - bcrypt with salt rounds 10
   - Update `AuthService`:
     - `login()` - Check lockout, increment failed attempts
     - `resetPassword()` - Validate new password, update history
     - `forcePasswordChange()` - Set password_changed_on to past date
   - Add rate limiting to login endpoint (10 requests per minute per IP)

4. **Frontend Implementation**
   - Password Strength Indicator:
     - Visual meter (weak/medium/strong) as user types
     - Real-time validation messages
   - Password Requirements Display:
     - Show all requirements before user starts typing
     - Check mark each requirement as met
   - Password Expiry Warning:
     - Show banner "Your password expires in X days" (when < 7 days)
     - Force password change on login if expired
   - Account Locked Message:
     - "Account locked due to too many failed attempts. Try again in X minutes."
   - Password Reset Flow:
     - Request reset via email
     - Token valid for 1 hour
     - New password must meet all complexity rules

5. **Admin Tools**
   - User Management:
     - "Force Password Change" button
     - "Unlock Account" button (for admins)
     - View last login time, failed attempts
   - Security Dashboard:
     - Show users with expired passwords
     - Show locked accounts
     - Show users who haven't logged in >90 days

**Acceptance Criteria**:
- [ ] Password must meet complexity rules (min 8 chars, upper, lower, number, special)
- [ ] Password strength indicator shows real-time feedback
- [ ] Passwords expire after 90 days (configurable)
- [ ] Can't reuse last 5 passwords
- [ ] Account locks after 5 failed login attempts for 30 minutes
- [ ] Login endpoint rate-limited to 10 requests/minute per IP
- [ ] Password reset via email with 1-hour token expiry
- [ ] Admin can force password change or unlock accounts
- [ ] Security dashboard shows at-risk accounts
- [ ] Unit tests for password validation logic
- [ ] Integration test for account lockout behavior

**Technical Notes**:
- Use bcrypt for password hashing (NOT MD5 or SHA1)
- Store password_history as array of hashes, not plain text
- Consider adding 2FA (Time-based OTP) in future sprint
- Implement CAPTCHA after 3 failed attempts (prevents bots)

**Related Issues**:
- Depends on: None
- Blocks: #6 (Administrative Audit Log)
- Related: #27 (Session Management)

**Labels**: `P0-critical`, `security`, `users`, `feature`

---

### Issue #6: Implement Administrative Actions Audit Log
**Priority**: P0 - CRITICAL
**Module**: Security / Settings
**Type**: Security / Compliance
**Milestone**: Q1 2026 - Month 2
**Estimated Effort**: 3 story points (3-4 days)

**Description**:
Track all administrative actions (settings changes, role modifications, user activations) to ensure accountability and traceability.

**Problem Statement**:
- No record of who changed system settings
- Can't trace who modified user roles/permissions
- Configuration issues difficult to debug
- Compliance requirement for audit trail

**Requirements**:

1. **Database Schema**
   - Create `admin_audit_log` table:
     ```sql
     CREATE TABLE admin_audit_log (
       id SERIAL PRIMARY KEY,
       entity_type VARCHAR(50) NOT NULL, -- USER, ROLE, SETTING, PERMISSION
       entity_id INTEGER,
       action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE
       old_value JSONB,
       new_value JSONB,
       changed_fields TEXT[], -- Array of field names changed
       performed_by INTEGER NOT NULL,
       performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       ip_address VARCHAR(45),
       user_agent TEXT,
       remarks TEXT
     );
     CREATE INDEX idx_admin_audit_entity ON admin_audit_log(entity_type, entity_id);
     CREATE INDEX idx_admin_audit_user ON admin_audit_log(performed_by, performed_at DESC);
     ```

2. **Backend Implementation**
   - Create `AdminAuditService`:
     - `logAction(entityType, entityId, action, oldValue, newValue, userId, ipAddress)`
     - `getEntityHistory(entityType, entityId)` - Audit trail for specific entity
     - `getUserActivity(userId, dateRange)` - All actions by a user
     - `compareValues(old, new)` - Extract changed fields
   - Create audit logging interceptor:
     ```typescript
     @Injectable()
     export class AuditInterceptor implements NestInterceptor {
       async intercept(context: ExecutionContext, next: CallHandler) {
         const request = context.switchToHttp().getRequest();
         const { user, ip, method, url, body } = request;

         // Log before execution (captures old values)
         const oldValue = await this.getEntitySnapshot(entityType, entityId);

         const result = await next.handle().toPromise();

         // Log after execution (captures new values)
         await this.auditService.logAction(
           entityType, entityId, action, oldValue, result, user.id, ip
         );

         return result;
       }
     }
     ```
   - Apply `@UseInterceptors(AuditInterceptor)` to:
     - UsersController (create, update, delete, activate, deactivate)
     - RolesController (create, update, delete, assign)
     - SettingsController (update business settings)

3. **Frontend Implementation**
   - Admin Dashboard:
     - "Recent Administrative Actions" widget (last 10 actions)
     - Link to full audit log page
   - Audit Log Page:
     - Filters: Date range, entity type, action, user
     - Table columns: Timestamp, User, Entity, Action, Changes
     - "View Details" button showing old vs new values side-by-side
   - Entity Detail Pages (User, Role, Setting):
     - "Audit History" tab showing all changes with diff view
   - User Activity Report:
     - Show all actions performed by a user in date range

4. **Automated Monitoring**
   - Daily email to admin with summary:
     - Number of users created/deleted
     - Settings changed
     - Roles modified
   - Alert on suspicious activities:
     - Multiple role changes by same user
     - Settings changed outside business hours
     - Bulk user deletions

5. **Reports**
   - Administrative Actions Report (by date, user, entity type)
   - Configuration Change History (all settings modifications)
   - User Role Changes Report (who got what permissions when)

**Acceptance Criteria**:
- [ ] All user create/update/delete actions logged
- [ ] All role modifications logged with old vs new permissions
- [ ] All settings changes logged with before/after values
- [ ] Audit log page filterable by date, entity, action, user
- [ ] Entity detail pages show complete audit history
- [ ] Diff view shows exactly what changed (field-by-field)
- [ ] Daily administrative summary email sent to admins
- [ ] Alerts sent for suspicious activities
- [ ] Unit tests verify audit logging in all admin controllers
- [ ] Integration test confirms audit log entries created correctly

**Technical Notes**:
- Store full entity snapshot as JSONB for complete audit trail
- Consider data retention (keep indefinitely for compliance)
- Implement audit log search/export for compliance audits

**Related Issues**:
- Depends on: #5 (Password Policy)
- Blocks: None
- Related: #2 (Stock Audit Trail), #4 (Payroll Audit)

**Labels**: `P0-critical`, `security`, `compliance`, `settings`, `feature`

---

## P1 - HIGH PRIORITY ISSUES (Next Sprint) 🟡

### Issue #7: Optimize POS Performance with Virtual Scrolling & Caching
**Priority**: P1 - HIGH
**Module**: Sales / POS
**Type**: Performance / Enhancement
**Milestone**: Q1 2026 - Month 2
**Estimated Effort**: 8 story points (2 weeks)

**Description**:
Improve POS performance to handle large product catalogs (10,000+ products) with fast search and smooth scrolling.

**Problem Statement**:
- POS slow with large product catalog
- Product search takes 2-5 seconds
- UI freezes during typing
- Poor user experience during busy hours

**Requirements**:

1. **Virtual Scrolling Implementation**
   - Replace standard product list with CDK Virtual Scroll
   - Render only visible items (20-30 at a time)
   - Dynamically load items as user scrolls
   - Expected performance: 60 FPS scrolling with 10,000+ items

2. **Debounced Search**
   - Add 300ms debounce to search input
   - Cancel previous search requests when new input received
   - Show loading indicator during search
   - Cache last 10 search results in memory

3. **Product Data Caching**
   - Frontend: Cache all products in IndexedDB on app load
   - Backend: Implement Redis cache for product list
   - Cache invalidation: Clear on product create/update/delete
   - TTL: 1 hour for product list cache

4. **Backend Optimization**
   - Add database indexes:
     - `product(title)` for search
     - `product(active, archive)` for filtering
     - `product_price2(product_id, end_date)` for price lookup
   - Optimize product search query:
     - Use full-text search (PostgreSQL `to_tsvector`)
     - Limit results to 50 (pagination)
     - Eager load price and stock in single query

5. **Progressive Loading**
   - Load "Favorites" (most sold products) first
   - Load remaining products in background
   - Show "Loading..." state with skeleton UI

**Acceptance Criteria**:
- [ ] Product list scrolls smoothly at 60 FPS with 10,000+ products
- [ ] Search returns results in < 500ms (95th percentile)
- [ ] UI remains responsive during typing (no freezing)
- [ ] Virtual scrolling renders only 20-30 items at a time
- [ ] Search debounced to 300ms
- [ ] Product data cached in IndexedDB (frontend) and Redis (backend)
- [ ] Database indexes created and verified with EXPLAIN ANALYZE
- [ ] Load test: 10 concurrent POS users searching simultaneously
- [ ] Performance test: Measure search time before/after (>50% improvement target)

**Technical Notes**:
- Use Angular CDK Virtual Scroll
- Consider using Web Workers for search filtering (offload from main thread)
- Monitor memory usage (cache shouldn't exceed 50MB)

**Related Issues**:
- Depends on: None
- Blocks: None
- Related: #9 (Multi-Device Sync)

**Labels**: `P1-high`, `performance`, `sales`, `pos`, `enhancement`

---

### Issue #8: Integrate Payment Gateway (UPI, Razorpay, Card Terminals)
**Priority**: P1 - HIGH
**Module**: Sales / Payments
**Type**: Feature / Integration
**Milestone**: Q1 2026 - Month 2
**Estimated Effort**: 13 story points (3 weeks)

**Description**:
Integrate modern payment gateways to accept UPI, credit/debit cards, and digital wallets at POS.

**Problem Statement**:
- Currently only accepts cash
- Customers prefer digital payments
- Lost sales due to lack of payment options
- Manual reconciliation of digital payments

**Requirements**:

1. **Payment Gateway Selection**
   - Primary: Razorpay (wide adoption in India)
   - Backup: Paytm (for redundancy)
   - Support: UPI, Cards (Visa/Mastercard/Rupay), Wallets (Paytm, PhonePe)

2. **Backend Integration**
   - Create `PaymentGatewayService`:
     - `initiatePayment(amount, orderId, method)` - Start payment flow
     - `verifyPayment(paymentId, signature)` - Verify webhook callback
     - `refundPayment(paymentId, amount)` - Process refund
   - Create `payment_transaction` table:
     ```sql
     CREATE TABLE payment_transaction (
       id SERIAL PRIMARY KEY,
       sale_id INTEGER NOT NULL,
       gateway VARCHAR(50), -- RAZORPAY, PAYTM, CASH, CARD_TERMINAL
       payment_method VARCHAR(50), -- UPI, CARD, WALLET, CASH
       transaction_id VARCHAR(255), -- Gateway transaction ID
       amount DECIMAL(10, 2) NOT NULL,
       status VARCHAR(50), -- INITIATED, SUCCESS, FAILED, REFUNDED
       gateway_response JSONB,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP
     );
     ```
   - Implement webhook endpoints:
     - `/api/payments/razorpay/webhook` - Handle payment status updates
     - Verify webhook signature for security
   - Update `SaleService`:
     - Link sale to payment transaction
     - Mark sale as PAID only after payment SUCCESS

3. **Frontend Implementation**
   - POS Payment Screen:
     - Payment method selector (Cash, UPI, Card, Wallet)
     - For Cash: Traditional cash drawer
     - For UPI: Show QR code + manual entry of transaction ID
     - For Card: Integrate with card terminal (if available)
   - Payment Status Display:
     - Loading indicator while waiting for payment
     - Success message with transaction ID
     - Failure message with retry option
   - Payment History:
     - List all transactions for a sale
     - Show gateway transaction ID, status, timestamp
     - Refund button (for admins)

4. **UPI Integration**
   - Generate UPI QR code with Razorpay API
   - Display QR code on POS screen
   - Customer scans with any UPI app
   - Webhook confirms payment
   - Print receipt automatically on success

5. **Card Terminal Integration**
   - Support USB/Bluetooth card terminals (e.g., Ingenico, Verifone)
   - Send payment request to terminal
   - Terminal displays amount, customer inserts/swipes card
   - Terminal returns success/failure
   - Store card terminal transaction ID

6. **Reconciliation**
   - Daily Settlement Report:
     - Total cash vs card vs UPI sales
     - Gateway fees deducted
     - Net settlement amount
   - Auto-match gateway transactions with sales
   - Flag unmatched transactions for review

**Acceptance Criteria**:
- [ ] POS accepts UPI payments via QR code
- [ ] POS accepts card payments via terminal integration
- [ ] Payment status verified via gateway webhook
- [ ] Failed payments allow retry without losing sale
- [ ] Successful payments auto-print receipt
- [ ] Payment transactions logged to database
- [ ] Daily settlement report shows payment breakdown
- [ ] Refunds can be initiated from admin panel
- [ ] Unit tests for payment verification logic
- [ ] Integration tests with Razorpay sandbox
- [ ] Load test: 100 concurrent payment requests

**Technical Notes**:
- Use Razorpay SDK for Node.js
- Store webhook secrets in environment variables
- Implement idempotency for webhook processing (prevent duplicate payments)
- Add retry logic for failed API calls

**Related Issues**:
- Depends on: None
- Blocks: #31 (Payment Reconciliation)
- Related: #7 (POS Performance)

**Labels**: `P1-high`, `feature`, `sales`, `payments`, `integration`

---

### Issue #9: Implement Multi-Device POS Synchronization
**Priority**: P1 - HIGH
**Module**: Sales / POS
**Type**: Feature / Architecture
**Milestone**: Q1 2026 - Month 3
**Estimated Effort**: 13 story points (3 weeks)

**Description**:
Implement real-time synchronization across multiple POS terminals to prevent inventory conflicts and duplicate sales.

**Problem Statement**:
- Multiple POS terminals operate independently
- No real-time stock updates across terminals
- Risk of overselling (2 terminals sell last unit simultaneously)
- Inventory conflicts require manual reconciliation

**Requirements**:

1. **WebSocket Infrastructure**
   - Add Socket.io to NestJS backend
   - Create `PosGateway` for real-time events:
     - `sale.created` - Broadcast when sale completed
     - `stock.updated` - Broadcast stock changes
     - `product.updated` - Broadcast product/price changes
   - Implement authentication for WebSocket connections (JWT)

2. **Backend Implementation**
   - Create `PosSyncService`:
     - `broadcastSale(sale)` - Notify all connected terminals
     - `broadcastStockUpdate(productId, newStock)` - Update stock
     - `lockProduct(productId, terminalId)` - Prevent concurrent sales
   - Implement optimistic locking:
     ```typescript
     // Add version column to product table for optimistic locking
     await manager.query(
       `UPDATE product
        SET quantity = quantity - $1, version = version + 1
        WHERE id = $2 AND version = $3`,
       [soldQty, productId, currentVersion]
     );
     // If rows affected = 0, version mismatch (someone else updated)
     ```

3. **Frontend Implementation**
   - Establish WebSocket connection on POS load
   - Subscribe to real-time events:
     - `stock.updated` → Refresh product stock in cart
     - `sale.created` → Show notification "New sale at Counter 2"
     - `product.updated` → Refresh product details
   - Conflict Resolution:
     - If stock becomes 0 after item added to cart, show warning
     - Option to remove item or continue (with manager override)
   - POS Terminal Identifier:
     - Each terminal has unique ID (Counter 1, Counter 2, etc.)
     - Show terminal ID on POS screen

4. **Offline Resilience**
   - Queue sales locally if WebSocket disconnected
   - Sync queued sales when connection restored
   - Show "Offline Mode" indicator on POS
   - Prevent checkout if critical stock data is stale (>5 minutes)

5. **Admin Dashboard**
   - Live POS Monitor:
     - Show all connected terminals with status (Online/Offline)
     - Real-time sales feed (terminal, items, amount)
     - Active carts (items in cart but not checked out)
   - Conflict Resolution Panel:
     - Show stock conflicts (attempted sales > available stock)
     - Allow admin to resolve (cancel sale or adjust stock)

**Acceptance Criteria**:
- [ ] All POS terminals connected via WebSocket
- [ ] Stock updates broadcast to all terminals in real-time
- [ ] Optimistic locking prevents overselling
- [ ] Offline sales queued and synced when online
- [ ] Admin dashboard shows live POS activity
- [ ] Conflict notification shown if stock depleted during checkout
- [ ] Terminal ID visible on each POS screen
- [ ] Unit tests for optimistic locking logic
- [ ] Integration tests for WebSocket events
- [ ] Load test: 10 concurrent terminals with 100 sales/hour each

**Technical Notes**:
- Use Socket.io for WebSocket implementation
- Consider using Redis Pub/Sub for horizontal scaling
- Implement heartbeat mechanism (ping/pong) to detect disconnected clients
- Add reconnection logic with exponential backoff

**Related Issues**:
- Depends on: #7 (POS Performance)
- Blocks: None
- Related: #8 (Payment Gateway)

**Labels**: `P1-high`, `feature`, `sales`, `pos`, `realtime`, `architecture`

---

### Issue #10: Implement Vendor Payment Aging & Tracking
**Priority**: P1 - HIGH
**Module**: Purchases / Vendors
**Type**: Feature / Enhancement
**Milestone**: Q1 2026 - Month 2
**Estimated Effort**: 8 story points (2 weeks)

**Description**:
Implement vendor payment tracking with aging analysis, payment due alerts, and vendor relationship management.

**Problem Statement**:
- No visibility into outstanding vendor payments
- Late payments strain vendor relationships
- No aging analysis (0-30, 31-60, 61-90, >90 days)
- Manual tracking of payment terms

**Requirements**:

1. **Database Schema**
   - Add to `vendor` table:
     - `payment_terms` INTEGER (days, e.g., 30 for Net 30)
     - `credit_limit` DECIMAL(10, 2)
     - `outstanding_balance` DECIMAL(10, 2)
   - Enhance `vendor_payment` table:
     - `due_date` DATE (calculated from invoice date + payment terms)
     - `aging_bucket` VARCHAR(20) (0-30, 31-60, 61-90, >90)
     - `payment_status` VARCHAR(50) (PENDING, PARTIAL, PAID, OVERDUE)
   - Create `vendor_payment_reminder` table:
     - id, vendor_id, due_date, reminder_sent_at, reminder_type (EMAIL, SMS)

2. **Backend Implementation**
   - Create `VendorPaymentService`:
     - `calculateAgingBucket(dueDate)` - Determine aging bucket
     - `getAgingReport(vendorId?)` - Get aging analysis
     - `getOverduePayments()` - Payments past due date
     - `recordPayment(paymentDto)` - Update balance and status
   - Daily cron job:
     - Calculate aging for all pending payments
     - Send reminders for payments due in 7/3/1 days
     - Send overdue alerts to finance manager

3. **Frontend Implementation**
   - Vendor Payment Dashboard:
     - Summary cards: Total Outstanding, Overdue, Due This Week
     - Aging chart: Bar chart showing 0-30, 31-60, 61-90, >90 days
     - Vendor-wise breakdown table
   - Vendor Detail Page:
     - Payment History tab
     - Outstanding Invoices list with due dates
     - "Record Payment" button
   - Payment Due Calendar:
     - Calendar view showing payment due dates
     - Color-coded: Green (upcoming), Yellow (due soon), Red (overdue)
   - Payment Recording Form:
     - Select invoice, enter amount, payment mode, date
     - Auto-calculate remaining balance
     - Option for partial payment

4. **Automated Reminders**
   - Email to finance manager:
     - Daily: Payments due today
     - Weekly: Aging analysis summary
     - Monthly: Vendor relationship health report
   - SMS to vendor (if opted in):
     - 7 days before due date: "Payment of ₹X due on DD/MM/YYYY"
     - 1 day before: Reminder
     - On due date: "Payment due today"

5. **Reports**
   - Vendor Aging Report:
     - Grouped by vendor, aging bucket
     - Drill-down to invoice level
   - Payment History Report:
     - All payments in date range with invoice references
   - Vendor Performance Report:
     - Average payment delay by vendor
     - On-time payment percentage

**Acceptance Criteria**:
- [ ] Vendor payment dashboard shows total outstanding and aging breakdown
- [ ] Aging buckets calculated correctly (0-30, 31-60, 61-90, >90)
- [ ] Overdue payments highlighted in red
- [ ] Daily email alerts sent for payments due today
- [ ] Payment recording form updates vendor balance atomically
- [ ] Partial payments supported with remaining balance tracking
- [ ] Vendor detail page shows complete payment history
- [ ] Payment due calendar displays color-coded due dates
- [ ] Aging report exportable to Excel
- [ ] Unit tests for aging calculation logic
- [ ] Integration test for payment recording workflow

**Technical Notes**:
- Use PostgreSQL date functions for aging calculation
- Index on vendor_payment(due_date, payment_status) for performance
- Consider implementing payment terms templates (Net 15, Net 30, Net 60)

**Related Issues**:
- Depends on: None
- Blocks: #21 (Vendor Performance Analytics)
- Related: #3 (Purchase Return Atomicity)

**Labels**: `P1-high`, `feature`, `purchases`, `vendors`, `finance`

---

### Issue #11: Implement Customer Loyalty Program
**Priority**: P1 - HIGH
**Module**: Customers
**Type**: Feature / Business Growth
**Milestone**: Q1 2026 - Month 3
**Estimated Effort**: 13 story points (3 weeks)

**Description**:
Implement points-based customer loyalty program to increase repeat business and customer lifetime value.

**Problem Statement**:
- No incentive for customers to return
- Losing customers to competitors with loyalty programs
- No way to reward frequent shoppers
- Missing revenue from repeat customers

**Requirements**:

1. **Database Schema**
   - Add to `customer` table:
     - `loyalty_tier` VARCHAR(50) (BRONZE, SILVER, GOLD, PLATINUM)
     - `loyalty_points` INTEGER DEFAULT 0
     - `lifetime_points_earned` INTEGER
     - `lifetime_spend` DECIMAL(10, 2)
     - `enrollment_date` TIMESTAMP
   - Create `loyalty_transaction` table:
     ```sql
     CREATE TABLE loyalty_transaction (
       id SERIAL PRIMARY KEY,
       customer_id INTEGER NOT NULL,
       transaction_type VARCHAR(50), -- EARN, REDEEM, EXPIRE, ADJUST
       points INTEGER NOT NULL,
       reference_type VARCHAR(50), -- SALE, PROMOTION, BIRTHDAY, ADJUSTMENT
       reference_id INTEGER,
       description TEXT,
       balance_before INTEGER,
       balance_after INTEGER,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       expires_at TIMESTAMP
     );
     ```
   - Create `loyalty_program_config` table:
     - points_per_rupee, redemption_value, tier_thresholds, expiry_days

2. **Backend Implementation**
   - Create `LoyaltyService`:
     - `enrollCustomer(customerId)` - Enroll in loyalty program
     - `earnPoints(customerId, saleId)` - Award points on sale
     - `redeemPoints(customerId, points)` - Redeem points for discount
     - `getPointsBalance(customerId)` - Get available points
     - `calculateTier(lifetimeSpend)` - Determine customer tier
     - `expirePoints()` - Daily job to expire old points
   - Loyalty Rules (configurable):
     - Earn: 1 point per ₹20 spent (5% return)
     - Redeem: 100 points = ₹10 discount
     - Expiry: Points expire after 365 days
     - Birthday Bonus: 100 points on birthday
   - Tier System:
     - Bronze: ₹0 - ₹10,000 lifetime spend (5% earn rate)
     - Silver: ₹10,001 - ₹50,000 (6% earn rate)
     - Gold: ₹50,001 - ₹1,00,000 (7% earn rate)
     - Platinum: >₹1,00,000 (10% earn rate + exclusive perks)
   - Update `SaleService`:
     - After sale success, call `loyaltyService.earnPoints()`
     - If points redeemed, reduce sale total before payment

3. **Frontend Implementation**
   - Customer Enrollment:
     - Quick enrollment at POS (name, mobile, optional email)
     - SMS with loyalty card number (or use mobile as ID)
   - POS Integration:
     - Scan loyalty card or enter mobile number
     - Show available points and tier
     - Option to redeem points (auto-calculate discount)
     - Show points earned after checkout
   - Customer Portal:
     - Dashboard: Points balance, tier, next tier threshold
     - Transaction history: Earned, redeemed, expired
     - Perks: Tier-specific benefits list
   - Admin Panel:
     - Loyalty program configuration
     - Tier thresholds and benefits
     - Points adjustment (for corrections)

4. **Automated Campaigns**
   - Birthday Campaign:
     - Identify customers with birthday this month
     - Award 100 bonus points
     - Send SMS: "Happy Birthday! We've added 100 points to your account."
   - Tier Upgrade Notification:
     - When customer reaches next tier, send SMS/email
     - "Congratulations! You're now a Gold member."
   - Inactivity Re-engagement:
     - Customers with no purchase in 60 days
     - Send SMS: "We miss you! Come back and earn bonus points."
   - Points Expiry Warning:
     - 30 days before points expire, send reminder
     - "Your points expire soon. Use them before DD/MM/YYYY."

5. **Reports**
   - Loyalty Program Dashboard:
     - Total enrolled customers, active members
     - Points issued, redeemed, expired
     - Average points balance
   - Tier Distribution Report:
     - Count of customers in each tier
   - ROI Analysis:
     - Revenue from loyalty members vs non-members
     - Average order value: members vs non-members
     - Repeat purchase rate by tier

**Acceptance Criteria**:
- [ ] Customers can enroll at POS with name and mobile
- [ ] Points automatically awarded on every sale
- [ ] Points redeemable for discount at checkout
- [ ] Tier calculated based on lifetime spend
- [ ] Points expire after 365 days with 30-day warning
- [ ] Birthday bonus points awarded automatically
- [ ] SMS notifications sent for tier upgrades and points expiry
- [ ] Customer portal shows points balance and history
- [ ] Admin can adjust points with audit log
- [ ] Loyalty dashboard shows program performance metrics
- [ ] Unit tests for points calculation and tier logic
- [ ] Integration test for full earn/redeem flow

**Technical Notes**:
- Consider using third-party SMS API (e.g., Twilio, MSG91)
- Points balance calculation should be real-time (don't cache)
- Implement double-entry accounting for points (debit/credit)
- Add fraud detection (flag customers gaming the system)

**Related Issues**:
- Depends on: None
- Blocks: #12 (Customer Segmentation)
- Related: #13 (Customer Communication)

**Labels**: `P1-high`, `feature`, `customers`, `marketing`, `business-growth`

---

## Summary Statistics

**Total Issues Created**: 11 (6 P0, 5 P1)
**Total Story Points**: 73
**Estimated Timeline**:
- P0 Issues: 5-6 weeks (Month 1-2 of Q1)
- P1 Issues: 11-12 weeks (Month 2-3 of Q1, spillover to Q2)

**Module Breakdown**:
- Products: 1 issue
- Inventory/Stock: 1 issue
- Purchases: 2 issues
- Payroll: 1 issue
- Security/Users: 2 issues
- Sales/POS: 3 issues
- Customers: 1 issue

**Type Breakdown**:
- Feature: 7 issues
- Bug/Data Integrity: 1 issue
- Security/Compliance: 6 issues
- Performance: 1 issue

---

## Next Steps

1. **Review & Prioritization Meeting**
   - Validate priorities with stakeholders
   - Confirm story point estimates
   - Assign issues to team members

2. **Sprint Planning**
   - Break down P0 issues into 2-week sprints
   - Create detailed subtasks for each issue
   - Set up CI/CD for automated testing

3. **Technical Kickoff**
   - Review technical approach for complex issues (#1, #9)
   - Set up development environments
   - Create feature branches

4. **Monitoring Setup**
   - Set up error tracking (Sentry)
   - Configure performance monitoring
   - Create dashboards for key metrics

---

**Document Version**: 1.0
**Created**: 2026-01-15
**Last Updated**: 2026-01-15
**Status**: Ready for GitHub Import
