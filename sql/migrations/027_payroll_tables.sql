-- Migration 009: Payroll Processing Tables
-- Date: 2026-01-10
-- Purpose: Create payroll run, detail, and payment workflow tables
-- Description: Supports flexible payroll calculation, approval workflow, and payment tracking
--              for multiple employment types with JSON-based earnings/deductions breakdown

-- ==========================================
-- 1. PAYROLL RUN (Master)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.payroll_run (
    id SERIAL4 PRIMARY KEY,

    -- Period
    year INT NOT NULL,
    month INT NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    -- Metadata
    title VARCHAR(200) NOT NULL, -- e.g., "January 2026 Payroll"
    description TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    -- DRAFT: Being prepared
    -- CALCULATED: Calculations complete, pending review
    -- APPROVED: Approved by manager/admin
    -- PAYMENT_REQUESTED: Payment request sent to finance
    -- PAYMENT_PROCESSING: Payments being processed
    -- COMPLETED: All payments completed
    -- CANCELLED: Cancelled

    -- Calculation Summary
    total_employees INT DEFAULT 0,
    total_gross_salary DECIMAL(12,2) DEFAULT 0,
    total_deductions DECIMAL(12,2) DEFAULT 0,
    total_net_salary DECIMAL(12,2) DEFAULT 0,
    total_employer_contributions DECIMAL(12,2) DEFAULT 0,

    -- Workflow
    calculated_on TIMESTAMPTZ,
    calculated_by INT4,
    approved_on TIMESTAMPTZ,
    approved_by INT4,
    approval_remarks TEXT,

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    -- Constraints
    CONSTRAINT payroll_run_calculated_by_fk FOREIGN KEY (calculated_by) REFERENCES public.app_user(id),
    CONSTRAINT payroll_run_approved_by_fk FOREIGN KEY (approved_by) REFERENCES public.app_user(id),
    CONSTRAINT payroll_run_created_by_fk FOREIGN KEY (created_by) REFERENCES public.app_user(id),
    CONSTRAINT payroll_run_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.app_user(id),
    CONSTRAINT payroll_run_status_check CHECK (status IN (
        'DRAFT', 'CALCULATED', 'APPROVED', 'PAYMENT_REQUESTED', 'PAYMENT_PROCESSING', 'COMPLETED', 'CANCELLED'
    ))
);

-- Table Comment
COMMENT ON TABLE public.payroll_run IS 'Payroll run master table representing a monthly payroll cycle';

-- Column Comments
COMMENT ON COLUMN public.payroll_run.status IS 'DRAFT, CALCULATED, APPROVED, PAYMENT_REQUESTED, PAYMENT_PROCESSING, COMPLETED, CANCELLED';
COMMENT ON COLUMN public.payroll_run.total_employer_contributions IS 'Sum of employer PF and ESI contributions (not deducted from employee salary)';

-- Create Indexes
CREATE UNIQUE INDEX idx_payroll_run_un ON public.payroll_run(year, month) WHERE active = true;
CREATE INDEX idx_payroll_run_period ON public.payroll_run(year DESC, month DESC) WHERE active = true;
CREATE INDEX idx_payroll_run_status ON public.payroll_run(status) WHERE active = true;

-- ==========================================
-- 2. PAYROLL DETAIL (Individual Employee)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.payroll_detail (
    id SERIAL4 PRIMARY KEY,
    payroll_run_id INT4 NOT NULL,
    user_id INT4 NOT NULL,

    -- Employment Configuration (snapshot at calculation time)
    employment_type_code VARCHAR(20) NOT NULL,
    role_code VARCHAR(20) NOT NULL,
    payment_model VARCHAR(20) NOT NULL,

    -- Period Info
    year INT NOT NULL,
    month INT NOT NULL,

    -- Attendance/Work Summary (varies by employment type)
    total_working_days INT, -- Expected working days (for full-time)
    actual_days_worked INT, -- Actual days (for all types)
    present_days DECIMAL(4,1), -- Full-time: present + paid leave
    paid_leave_days DECIMAL(4,1), -- Full-time only
    lwp_days DECIMAL(4,1), -- Full-time: leave without pay
    hours_worked DECIMAL(6,2), -- For hourly workers
    billable_hours DECIMAL(6,2), -- For contractors

    -- Earnings Breakdown (JSON for flexibility)
    earnings_breakdown JSONB NOT NULL DEFAULT '{}',
    -- Example for Associate:
    -- {
    --   "BASIC": 7000,
    --   "HRA": 2500,
    --   "CONVEYANCE": 500,
    --   "FOOD_MEAL": 1000,
    --   "SPECIAL": 1000,
    --   "KPI_INCENTIVE": 1500
    -- }
    -- Example for Part-time (12 days):
    -- {
    --   "RETAINER": 6000,
    --   "EXTRA_DAYS": 1600,
    --   "KPI_INCENTIVE": 750
    -- }

    gross_salary DECIMAL(10,2) NOT NULL,

    -- Deductions Breakdown (JSON for flexibility)
    deductions_breakdown JSONB NOT NULL DEFAULT '{}',
    -- Example:
    -- {
    --   "PF_EMPLOYEE": 840,
    --   "PT": 200,
    --   "TDS": 500,
    --   "ADVANCE": 1000
    -- }

    total_deductions DECIMAL(10,2) NOT NULL,

    -- Employer Contributions (not deducted from employee)
    employer_contributions JSONB DEFAULT '{}',
    -- {
    --   "PF_EMPLOYER": 840,
    --   "ESI_EMPLOYER": 0
    -- }

    -- Net Salary
    net_salary DECIMAL(10,2) NOT NULL,

    -- KPI Details
    kpi_score DECIMAL(5,2),
    kpi_breakdown JSONB,
    -- {
    --   "ATTENDANCE": 22,
    --   "BILLING": 20,
    --   "STOCK": 18,
    --   "CUSTOMER_SERVICE": 17,
    --   "TEAMWORK": 8,
    --   "TOTAL": 85
    -- }
    kpi_incentive_amount DECIMAL(10,2) DEFAULT 0,

    -- Payment Status
    payment_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    payment_date DATE,
    payment_reference VARCHAR(100),
    payment_method VARCHAR(20), -- BANK_TRANSFER, CASH, CHEQUE, UPI
    payment_transaction_id INT4,

    remarks TEXT,
    calculation_metadata JSONB, -- Store calculation details for audit/debugging

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    -- Constraints
    CONSTRAINT payroll_detail_un UNIQUE (payroll_run_id, user_id),
    CONSTRAINT payroll_detail_run_fk FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_run(id),
    CONSTRAINT payroll_detail_user_fk FOREIGN KEY (user_id) REFERENCES public.app_user(id),
    CONSTRAINT payroll_detail_employment_type_fk FOREIGN KEY (employment_type_code)
        REFERENCES public.employment_type_master(code),
    CONSTRAINT payroll_detail_role_fk FOREIGN KEY (role_code) REFERENCES public.role_master(code),
    CONSTRAINT payroll_detail_created_by_fk FOREIGN KEY (created_by) REFERENCES public.app_user(id),
    CONSTRAINT payroll_detail_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.app_user(id),
    CONSTRAINT payroll_detail_payment_status_check CHECK (payment_status IN (
        'PENDING', 'REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD'
    ))
);

-- Table Comment
COMMENT ON TABLE public.payroll_detail IS 'Flexible payroll detail records supporting multiple employment types and payment models';

-- Column Comments
COMMENT ON COLUMN public.payroll_detail.earnings_breakdown IS 'JSON object with salary component codes as keys and calculated amounts as values';
COMMENT ON COLUMN public.payroll_detail.deductions_breakdown IS 'JSON object with deduction component codes as keys and amounts as values';
COMMENT ON COLUMN public.payroll_detail.employer_contributions IS 'JSON object with employer contribution codes (PF_EMPLOYER, ESI_EMPLOYER) and amounts';
COMMENT ON COLUMN public.payroll_detail.calculation_metadata IS 'Stores intermediate calculation values, formulas used, and other metadata for transparency and debugging';
COMMENT ON COLUMN public.payroll_detail.payment_status IS 'PENDING, REQUESTED, APPROVED, PROCESSING, PAID, FAILED, ON_HOLD';

-- Create Indexes
CREATE INDEX idx_payroll_detail_run ON public.payroll_detail(payroll_run_id);
CREATE INDEX idx_payroll_detail_user ON public.payroll_detail(user_id, year DESC, month DESC);
CREATE INDEX idx_payroll_detail_employment_type ON public.payroll_detail(employment_type_code);
CREATE INDEX idx_payroll_detail_payment_status ON public.payroll_detail(payment_status) WHERE payment_status != 'PAID';

-- ==========================================
-- 3. PAYMENT REQUEST (Finance Workflow)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.payment_request (
    id SERIAL4 PRIMARY KEY,
    payroll_run_id INT4 NOT NULL,

    -- Request Details
    request_number VARCHAR(50) UNIQUE NOT NULL,
    request_date DATE NOT NULL,

    -- Summary
    total_employees INT NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,

    -- Grouping (optional - can request payment by store, department, etc.)
    store_id INT4,
    department VARCHAR(50),
    employment_type_code VARCHAR(20),

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    -- PENDING: Awaiting finance review
    -- APPROVED: Approved by finance
    -- PROCESSING: Payment in progress
    -- COMPLETED: All payments done
    -- REJECTED: Rejected by finance
    -- CANCELLED: Cancelled by requestor

    -- Workflow
    requested_by INT4 NOT NULL,
    reviewed_by INT4,
    reviewed_on TIMESTAMPTZ,
    review_remarks TEXT,
    approved_by INT4,
    approved_on TIMESTAMPTZ,
    approval_remarks TEXT,

    -- Payment Details
    payment_date DATE,
    payment_method VARCHAR(20),
    payment_reference VARCHAR(100),

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    -- Constraints
    CONSTRAINT payment_request_run_fk FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_run(id),
    -- CONSTRAINT payment_request_store_fk FOREIGN KEY (store_id) REFERENCES public.store(id), -- Store table doesn't exist yet
    CONSTRAINT payment_request_employment_type_fk FOREIGN KEY (employment_type_code)
        REFERENCES public.employment_type_master(code),
    CONSTRAINT payment_request_requested_by_fk FOREIGN KEY (requested_by) REFERENCES public.app_user(id),
    CONSTRAINT payment_request_reviewed_by_fk FOREIGN KEY (reviewed_by) REFERENCES public.app_user(id),
    CONSTRAINT payment_request_approved_by_fk FOREIGN KEY (approved_by) REFERENCES public.app_user(id),
    CONSTRAINT payment_request_created_by_fk FOREIGN KEY (created_by) REFERENCES public.app_user(id),
    CONSTRAINT payment_request_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.app_user(id),
    CONSTRAINT payment_request_status_check CHECK (status IN (
        'PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED'
    ))
);

-- Table Comment
COMMENT ON TABLE public.payment_request IS 'Payment requests sent to finance team for salary disbursement';

-- Column Comments
COMMENT ON COLUMN public.payment_request.request_number IS 'Unique payment request number (e.g., PR-2026-01-001)';
COMMENT ON COLUMN public.payment_request.status IS 'PENDING, APPROVED, PROCESSING, COMPLETED, REJECTED, CANCELLED';

-- Create Indexes
CREATE INDEX idx_payment_request_run ON public.payment_request(payroll_run_id);
CREATE INDEX idx_payment_request_status ON public.payment_request(status) WHERE status IN ('PENDING', 'APPROVED', 'PROCESSING');
CREATE INDEX idx_payment_request_date ON public.payment_request(request_date DESC);

-- ==========================================
-- 4. PAYMENT REQUEST ITEMS (Line Items)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.payment_request_item (
    id SERIAL4 PRIMARY KEY,
    payment_request_id INT4 NOT NULL,
    payroll_detail_id INT4 NOT NULL,

    -- Employee Info (denormalized for quick access)
    user_id INT4 NOT NULL,
    employee_name VARCHAR(200),
    employment_type_code VARCHAR(20),

    -- Amount
    net_salary DECIMAL(10,2) NOT NULL,

    -- Bank Details (snapshot)
    bank_name VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(15),

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    payment_date DATE,
    payment_reference VARCHAR(100),

    remarks TEXT,

    -- Audit
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Constraints
    CONSTRAINT payment_request_item_request_fk FOREIGN KEY (payment_request_id)
        REFERENCES public.payment_request(id),
    CONSTRAINT payment_request_item_detail_fk FOREIGN KEY (payroll_detail_id)
        REFERENCES public.payroll_detail(id),
    CONSTRAINT payment_request_item_user_fk FOREIGN KEY (user_id) REFERENCES public.app_user(id),
    CONSTRAINT payment_request_item_status_check CHECK (status IN (
        'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD'
    ))
);

-- Table Comment
COMMENT ON TABLE public.payment_request_item IS 'Individual payment items within a payment request';

-- Create Indexes
CREATE INDEX idx_payment_request_item_request ON public.payment_request_item(payment_request_id);
CREATE INDEX idx_payment_request_item_detail ON public.payment_request_item(payroll_detail_id);
CREATE INDEX idx_payment_request_item_user ON public.payment_request_item(user_id);

-- ==========================================
-- 5. PAYMENT TRANSACTION (Actual Payments)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.payment_transaction (
    id SERIAL4 PRIMARY KEY,
    payment_request_id INT4 NOT NULL,
    payroll_detail_id INT4 NOT NULL,
    user_id INT4 NOT NULL,

    -- Transaction Details
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    transaction_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,

    -- Payment Method
    payment_method VARCHAR(20) NOT NULL, -- BANK_TRANSFER, CASH, CHEQUE, UPI
    payment_reference VARCHAR(100), -- UTR number, cheque number, etc.

    -- Bank Transfer Details
    bank_name VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(15),
    utr_number VARCHAR(50),

    -- Cash/Cheque Details
    cheque_number VARCHAR(30),
    cheque_date DATE,
    collected_by INT4, -- If cash payment

    -- Status
    status VARCHAR(20) DEFAULT 'SUCCESS' NOT NULL,
    -- SUCCESS, FAILED, PENDING, REVERSED

    failure_reason TEXT,

    remarks TEXT,

    -- Audit
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,

    -- Constraints
    CONSTRAINT payment_transaction_request_fk FOREIGN KEY (payment_request_id)
        REFERENCES public.payment_request(id),
    CONSTRAINT payment_transaction_detail_fk FOREIGN KEY (payroll_detail_id)
        REFERENCES public.payroll_detail(id),
    CONSTRAINT payment_transaction_user_fk FOREIGN KEY (user_id) REFERENCES public.app_user(id),
    CONSTRAINT payment_transaction_collected_by_fk FOREIGN KEY (collected_by) REFERENCES public.app_user(id),
    CONSTRAINT payment_transaction_created_by_fk FOREIGN KEY (created_by) REFERENCES public.app_user(id),
    CONSTRAINT payment_transaction_status_check CHECK (status IN (
        'SUCCESS', 'FAILED', 'PENDING', 'REVERSED'
    ))
);

-- Table Comment
COMMENT ON TABLE public.payment_transaction IS 'Actual payment transactions with bank/cash details';

-- Column Comments
COMMENT ON COLUMN public.payment_transaction.transaction_number IS 'Unique transaction number (e.g., TXN-2026-01-001)';
COMMENT ON COLUMN public.payment_transaction.payment_method IS 'BANK_TRANSFER, CASH, CHEQUE, UPI';
COMMENT ON COLUMN public.payment_transaction.utr_number IS 'Unique Transaction Reference for bank transfers';

-- Create Indexes
CREATE INDEX idx_payment_transaction_request ON public.payment_transaction(payment_request_id);
CREATE INDEX idx_payment_transaction_detail ON public.payment_transaction(payroll_detail_id);
CREATE INDEX idx_payment_transaction_user ON public.payment_transaction(user_id);
CREATE INDEX idx_payment_transaction_date ON public.payment_transaction(transaction_date DESC);

-- ==========================================
-- 6. SEQUENCES FOR NUMBERING
-- ==========================================

-- Payment Request Number Sequence
CREATE SEQUENCE IF NOT EXISTS payment_request_number_seq START WITH 1;

-- Payment Transaction Number Sequence
CREATE SEQUENCE IF NOT EXISTS payment_transaction_number_seq START WITH 1;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Verify table creation
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('payroll_run', 'payroll_detail', 'payment_request', 'payment_request_item', 'payment_transaction')
ORDER BY table_name;

-- Summary
SELECT 'Payroll tables created successfully' as status,
       5 as tables_count,
       (SELECT COUNT(*) FROM information_schema.sequences WHERE sequence_name LIKE '%payment%') as sequences_count;
