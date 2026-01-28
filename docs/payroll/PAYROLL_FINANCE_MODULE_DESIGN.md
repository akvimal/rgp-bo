# Payroll and Finance Module - Comprehensive Design Document

## Document Information
- **Created**: 2026-01-10
- **Version**: 1.0
- **Status**: Design Phase
- **Related Modules**: HR, Finance, Settings

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Business Requirements](#business-requirements)
3. [System Architecture](#system-architecture)
4. [Database Schema Design](#database-schema-design)
5. [Payroll Calculation Engine](#payroll-calculation-engine)
6. [Finance Payment Workflow](#finance-payment-workflow)
7. [API Specifications](#api-specifications)
8. [Frontend Components](#frontend-components)
9. [Integration Points](#integration-points)
10. [Security & Compliance](#security--compliance)
11. [Implementation Roadmap](#implementation-roadmap)
12. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Overview
The Payroll and Finance Module is a comprehensive solution for automating monthly payroll processing, including attendance-based salary calculation, KPI-based incentives, and payment request workflow for the finance team.

### Key Features
- **Automated Payroll Calculation**: Monthly payroll generation based on attendance, leaves, and performance
- **Salary Components**: Basic salary, allowances, deductions, overtime, and KPI-based incentives
- **Finance Workflow**: Payment request approval and processing
- **Tax Compliance**: Tax calculations and deductions (PF, ESI, Professional Tax, Income Tax)
- **Audit Trail**: Complete transparency and audit logs for all payroll operations
- **Integration**: Seamless integration with existing HR module (attendance, leaves, performance)

### Business Value
- **Time Savings**: Reduce payroll processing time from days to hours
- **Accuracy**: Eliminate manual calculation errors
- **Compliance**: Automated tax calculations and statutory compliance
- **Transparency**: Complete visibility into salary breakdowns and payment status
- **Performance Incentives**: Automated KPI-based reward system

---

## Business Requirements

### Primary Requirements

#### 1. Monthly Payroll Processing
- Owner/Manager initiates monthly payroll run (typically at month-end)
- System calculates salary for all active employees
- Calculations based on:
  - Attendance records (excluding paid leaves)
  - Paid leaves (counted as working days)
  - KPI compliance and performance scores
  - Additional credits/allowances
  - Deductions (advances, fines, statutory)

#### 2. Salary Components

##### Earnings
1. **Basic Salary** (Fixed monthly component)
2. **House Rent Allowance (HRA)** (Percentage of basic or fixed)
3. **Dearness Allowance (DA)** (Cost of living adjustment)
4. **Transport Allowance** (Fixed monthly)
5. **Special Allowance** (Variable based on role/location)
6. **Medical Allowance** (Fixed monthly)
7. **Overtime Pay** (Based on extra hours worked)
8. **KPI Incentive** (Performance-based bonus)
9. **Attendance Bonus** (Full attendance reward)
10. **Other Allowances** (Festival bonus, project bonus, etc.)

##### Deductions
1. **Provident Fund (PF)** (12% of basic - statutory)
2. **Employee State Insurance (ESI)** (0.75% of gross - if applicable)
3. **Professional Tax (PT)** (State-specific)
4. **Income Tax (TDS)** (As per income slab)
5. **Advance Salary** (Deducted from salary)
6. **Loan Repayment** (Monthly installment)
7. **Leave Without Pay (LWP)** (Deduction for unpaid absences)
8. **Fines/Penalties** (Disciplinary deductions)
9. **Other Deductions** (Canteen, uniform, etc.)

##### Net Calculation
```
Gross Salary = Basic + HRA + DA + Transport + Special + Medical + Overtime + Incentives + Bonuses
Total Deductions = PF + ESI + PT + TDS + Advances + Loans + LWP + Fines + Others
Net Salary = Gross Salary - Total Deductions
```

#### 3. Attendance-Based Calculation
- **Working Days**: Total working days in month (excluding weekends/holidays)
- **Present Days**: Actual attendance + Paid Leaves
- **Absent Days**: Days without attendance (not on leave)
- **Per Day Salary**: Gross Salary / Working Days
- **LWP Deduction**: (Absent Days) × Per Day Salary

#### 4. KPI-Based Incentives
Based on existing `user_score` table:
- **Attendance Score** (30%): Based on present days ratio
- **Punctuality Score** (25%): Based on late arrivals
- **Working Hours Score** (25%): Based on total hours worked
- **Reliability Score** (20%): Based on overall performance

**Incentive Calculation**:
```
Grade A (Total Score >= 90): 20% of basic salary
Grade B (Total Score >= 75): 15% of basic salary
Grade C (Total Score >= 60): 10% of basic salary
Grade D (Total Score >= 50): 5% of basic salary
Below 50: No incentive
```

#### 5. Finance Payment Workflow
1. **Payroll Generation**: HR/Manager generates monthly payroll
2. **Verification**: HR reviews and verifies calculations
3. **Payment Request Creation**: Approved payroll creates payment requests
4. **Finance Approval**: Finance team reviews and approves
5. **Payment Processing**: Finance marks payments as processed
6. **Completion**: Employees receive salary, payslips generated

---

## System Architecture

### Module Structure
```
Finance Module
├── Payroll Module
│   ├── Salary Structure Management
│   ├── Payroll Generation Engine
│   ├── Payroll Calendar
│   └── Payslip Generation
│
├── Payment Module
│   ├── Payment Request Management
│   ├── Approval Workflow
│   ├── Payment Processing
│   └── Payment History
│
├── Statutory Compliance
│   ├── PF Calculation
│   ├── ESI Calculation
│   ├── TDS Calculation
│   └── Professional Tax
│
└── Reports
    ├── Payroll Summary Report
    ├── Department-wise Report
    ├── Tax Reports
    └── Payment Status Report
```

### Integration Architecture
```
┌─────────────────┐
│   HR Module     │
│  - Attendance   │────┐
│  - Leave Mgmt   │    │
│  - Performance  │    │
└─────────────────┘    │
                       │
                       ▼
              ┌─────────────────┐
              │ Payroll Engine  │
              │  - Calculate    │
              │  - Validate     │
              │  - Generate     │
              └─────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Finance Module  │
              │  - Approval     │
              │  - Payment      │
              │  - Reports      │
              └─────────────────┘
```

---

## Database Schema Design

### 1. Employee Salary Structure (`employee_salary_structure`)
Stores the salary components for each employee.

```sql
CREATE TABLE public.employee_salary_structure (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL UNIQUE,

    -- Basic Components
    basic_salary DECIMAL(10,2) NOT NULL,
    hra DECIMAL(10,2) DEFAULT 0,
    da DECIMAL(10,2) DEFAULT 0,
    transport_allowance DECIMAL(10,2) DEFAULT 0,
    special_allowance DECIMAL(10,2) DEFAULT 0,
    medical_allowance DECIMAL(10,2) DEFAULT 0,

    -- Percentage-based (if null, use fixed value above)
    hra_percentage DECIMAL(5,2), -- e.g., 40% of basic
    da_percentage DECIMAL(5,2),  -- e.g., 10% of basic

    -- Overtime Configuration
    overtime_eligible BOOL DEFAULT false,
    overtime_hourly_rate DECIMAL(8,2),

    -- KPI Incentive Configuration
    kpi_eligible BOOL DEFAULT true,
    kpi_base_amount DECIMAL(10,2), -- or use basic salary percentage

    -- Statutory Deductions
    pf_applicable BOOL DEFAULT true,
    pf_employee_percentage DECIMAL(5,2) DEFAULT 12,
    pf_employer_percentage DECIMAL(5,2) DEFAULT 12,
    pf_number VARCHAR(30),

    esi_applicable BOOL DEFAULT false,
    esi_employee_percentage DECIMAL(5,2) DEFAULT 0.75,
    esi_employer_percentage DECIMAL(5,2) DEFAULT 3.25,
    esi_number VARCHAR(30),

    pt_applicable BOOL DEFAULT true,
    tds_applicable BOOL DEFAULT true,
    pan_number VARCHAR(20),

    -- Effective Dates
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Bank Details
    bank_name VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(15),

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    CONSTRAINT ess_user_fk FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT ess_created_by_fk FOREIGN KEY (created_by) REFERENCES app_user(id),
    CONSTRAINT ess_updated_by_fk FOREIGN KEY (updated_by) REFERENCES app_user(id)
);

CREATE INDEX idx_ess_user ON employee_salary_structure(user_id) WHERE active = true;
CREATE INDEX idx_ess_effective ON employee_salary_structure(effective_from, effective_to) WHERE active = true;

COMMENT ON TABLE employee_salary_structure IS 'Employee salary structure with components and statutory details';
```

### 2. Payroll Run (`payroll_run`)
Tracks each monthly payroll processing cycle.

```sql
CREATE TABLE public.payroll_run (
    id SERIAL4 PRIMARY KEY,

    -- Period
    year INT NOT NULL,
    month INT NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    -- DRAFT, IN_PROGRESS, COMPLETED, VERIFIED, APPROVED, PAYMENT_REQUESTED, PAYMENT_PROCESSING, PAID, CANCELLED

    -- Statistics
    total_employees INT DEFAULT 0,
    processed_employees INT DEFAULT 0,
    total_gross_amount DECIMAL(12,2) DEFAULT 0,
    total_deductions DECIMAL(12,2) DEFAULT 0,
    total_net_amount DECIMAL(12,2) DEFAULT 0,

    -- Workflow
    initiated_by INT4 NOT NULL,
    initiated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    verified_by INT4,
    verified_on TIMESTAMPTZ,
    approved_by INT4,
    approved_on TIMESTAMPTZ,

    remarks TEXT,

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    CONSTRAINT payroll_run_un UNIQUE (year, month),
    CONSTRAINT payroll_run_initiated_by_fk FOREIGN KEY (initiated_by) REFERENCES app_user(id),
    CONSTRAINT payroll_run_verified_by_fk FOREIGN KEY (verified_by) REFERENCES app_user(id),
    CONSTRAINT payroll_run_approved_by_fk FOREIGN KEY (approved_by) REFERENCES app_user(id),
    CONSTRAINT payroll_run_created_by_fk FOREIGN KEY (created_by) REFERENCES app_user(id),
    CONSTRAINT payroll_run_updated_by_fk FOREIGN KEY (updated_by) REFERENCES app_user(id),
    CONSTRAINT payroll_run_status_check CHECK (status IN (
        'DRAFT', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'APPROVED',
        'PAYMENT_REQUESTED', 'PAYMENT_PROCESSING', 'PAID', 'CANCELLED'
    ))
);

CREATE INDEX idx_payroll_run_period ON payroll_run(year DESC, month DESC);
CREATE INDEX idx_payroll_run_status ON payroll_run(status, year DESC, month DESC);

COMMENT ON TABLE payroll_run IS 'Monthly payroll processing cycles';
```

### 3. Payroll Detail (`payroll_detail`)
Individual employee payroll records for each payroll run.

```sql
CREATE TABLE public.payroll_detail (
    id SERIAL4 PRIMARY KEY,
    payroll_run_id INT4 NOT NULL,
    user_id INT4 NOT NULL,

    -- Period Info
    year INT NOT NULL,
    month INT NOT NULL,
    working_days INT NOT NULL,
    present_days DECIMAL(4,1) NOT NULL,
    paid_leave_days DECIMAL(4,1) DEFAULT 0,
    lwp_days DECIMAL(4,1) DEFAULT 0,

    -- Earnings
    basic_salary DECIMAL(10,2) NOT NULL,
    hra DECIMAL(10,2) DEFAULT 0,
    da DECIMAL(10,2) DEFAULT 0,
    transport_allowance DECIMAL(10,2) DEFAULT 0,
    special_allowance DECIMAL(10,2) DEFAULT 0,
    medical_allowance DECIMAL(10,2) DEFAULT 0,
    overtime_amount DECIMAL(10,2) DEFAULT 0,
    kpi_incentive DECIMAL(10,2) DEFAULT 0,
    attendance_bonus DECIMAL(10,2) DEFAULT 0,
    other_allowances DECIMAL(10,2) DEFAULT 0,

    gross_salary DECIMAL(10,2) NOT NULL,

    -- Deductions
    pf_employee DECIMAL(10,2) DEFAULT 0,
    pf_employer DECIMAL(10,2) DEFAULT 0,
    esi_employee DECIMAL(10,2) DEFAULT 0,
    esi_employer DECIMAL(10,2) DEFAULT 0,
    professional_tax DECIMAL(10,2) DEFAULT 0,
    tds DECIMAL(10,2) DEFAULT 0,
    advance_deduction DECIMAL(10,2) DEFAULT 0,
    loan_deduction DECIMAL(10,2) DEFAULT 0,
    lwp_deduction DECIMAL(10,2) DEFAULT 0,
    fine_deduction DECIMAL(10,2) DEFAULT 0,
    other_deductions DECIMAL(10,2) DEFAULT 0,

    total_deductions DECIMAL(10,2) NOT NULL,

    -- Net Salary
    net_salary DECIMAL(10,2) NOT NULL,

    -- KPI Details
    kpi_score DECIMAL(5,2),
    kpi_grade VARCHAR(2),

    -- Payment Status
    payment_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    -- PENDING, REQUESTED, APPROVED, PROCESSING, PAID, FAILED, ON_HOLD
    payment_date DATE,
    payment_reference VARCHAR(100),

    remarks TEXT,

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    CONSTRAINT payroll_detail_un UNIQUE (payroll_run_id, user_id),
    CONSTRAINT payroll_detail_run_fk FOREIGN KEY (payroll_run_id) REFERENCES payroll_run(id),
    CONSTRAINT payroll_detail_user_fk FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT payroll_detail_created_by_fk FOREIGN KEY (created_by) REFERENCES app_user(id),
    CONSTRAINT payroll_detail_updated_by_fk FOREIGN KEY (updated_by) REFERENCES app_user(id),
    CONSTRAINT payroll_detail_payment_status_check CHECK (payment_status IN (
        'PENDING', 'REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD'
    ))
);

CREATE INDEX idx_payroll_detail_run ON payroll_detail(payroll_run_id);
CREATE INDEX idx_payroll_detail_user ON payroll_detail(user_id, year DESC, month DESC);
CREATE INDEX idx_payroll_detail_payment_status ON payroll_detail(payment_status);

COMMENT ON TABLE payroll_detail IS 'Individual employee payroll records per month';
```

### 4. Salary Component Master (`salary_component`)
Configurable salary components (for flexibility).

```sql
CREATE TABLE public.salary_component (
    id SERIAL4 PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    component_type VARCHAR(20) NOT NULL, -- EARNING, DEDUCTION
    calculation_type VARCHAR(20) NOT NULL, -- FIXED, PERCENTAGE, FORMULA, MANUAL

    -- For percentage-based
    base_component VARCHAR(20), -- e.g., 'BASIC' for HRA
    percentage DECIMAL(5,2),

    -- For formula-based
    formula TEXT, -- e.g., '(BASIC + DA) * 0.40'

    -- Statutory
    is_statutory BOOL DEFAULT false,
    is_taxable BOOL DEFAULT true,

    -- Display
    display_order INT DEFAULT 0,
    color_code VARCHAR(7),

    active BOOL DEFAULT true NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    CONSTRAINT salary_component_created_by_fk FOREIGN KEY (created_by) REFERENCES app_user(id),
    CONSTRAINT salary_component_updated_by_fk FOREIGN KEY (updated_by) REFERENCES app_user(id),
    CONSTRAINT salary_component_type_check CHECK (component_type IN ('EARNING', 'DEDUCTION')),
    CONSTRAINT salary_component_calc_check CHECK (calculation_type IN ('FIXED', 'PERCENTAGE', 'FORMULA', 'MANUAL'))
);

CREATE INDEX idx_salary_component_type ON salary_component(component_type, display_order);

COMMENT ON TABLE salary_component IS 'Master table for configurable salary components';

-- Insert default components
INSERT INTO salary_component (code, name, component_type, calculation_type, display_order) VALUES
    ('BASIC', 'Basic Salary', 'EARNING', 'FIXED', 1),
    ('HRA', 'House Rent Allowance', 'EARNING', 'PERCENTAGE', 2),
    ('DA', 'Dearness Allowance', 'EARNING', 'PERCENTAGE', 3),
    ('TRANSPORT', 'Transport Allowance', 'EARNING', 'FIXED', 4),
    ('SPECIAL', 'Special Allowance', 'EARNING', 'FIXED', 5),
    ('MEDICAL', 'Medical Allowance', 'EARNING', 'FIXED', 6),
    ('OVERTIME', 'Overtime Pay', 'EARNING', 'MANUAL', 7),
    ('KPI', 'KPI Incentive', 'EARNING', 'MANUAL', 8),
    ('ATT_BONUS', 'Attendance Bonus', 'EARNING', 'MANUAL', 9),
    ('PF_EMP', 'PF Employee', 'DEDUCTION', 'PERCENTAGE', 1),
    ('ESI_EMP', 'ESI Employee', 'DEDUCTION', 'PERCENTAGE', 2),
    ('PT', 'Professional Tax', 'DEDUCTION', 'MANUAL', 3),
    ('TDS', 'Income Tax (TDS)', 'DEDUCTION', 'MANUAL', 4),
    ('ADVANCE', 'Advance Deduction', 'DEDUCTION', 'MANUAL', 5),
    ('LOAN', 'Loan Repayment', 'DEDUCTION', 'MANUAL', 6),
    ('LWP', 'Leave Without Pay', 'DEDUCTION', 'MANUAL', 7),
    ('FINE', 'Fines/Penalties', 'DEDUCTION', 'MANUAL', 8);
```

### 5. Payment Request (`payment_request`)
Payment requests created from approved payroll.

```sql
CREATE TABLE public.payment_request (
    id SERIAL4 PRIMARY KEY,
    request_number VARCHAR(30) NOT NULL UNIQUE,

    payroll_run_id INT4 NOT NULL,

    request_type VARCHAR(20) DEFAULT 'SALARY' NOT NULL,
    -- SALARY, ADVANCE, REIMBURSEMENT, BONUS

    -- Amounts
    total_employees INT NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    -- PENDING, APPROVED, REJECTED, PROCESSING, COMPLETED, CANCELLED

    -- Workflow
    requested_by INT4 NOT NULL,
    requested_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_by INT4,
    approved_on TIMESTAMPTZ,
    processed_by INT4,
    processed_on TIMESTAMPTZ,

    rejection_reason TEXT,
    processing_remarks TEXT,

    -- Payment Details
    payment_method VARCHAR(20), -- BANK_TRANSFER, CASH, CHEQUE
    payment_date DATE,
    payment_reference VARCHAR(100),

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    CONSTRAINT payment_request_run_fk FOREIGN KEY (payroll_run_id) REFERENCES payroll_run(id),
    CONSTRAINT payment_request_requested_by_fk FOREIGN KEY (requested_by) REFERENCES app_user(id),
    CONSTRAINT payment_request_approved_by_fk FOREIGN KEY (approved_by) REFERENCES app_user(id),
    CONSTRAINT payment_request_processed_by_fk FOREIGN KEY (processed_by) REFERENCES app_user(id),
    CONSTRAINT payment_request_created_by_fk FOREIGN KEY (created_by) REFERENCES app_user(id),
    CONSTRAINT payment_request_updated_by_fk FOREIGN KEY (updated_by) REFERENCES app_user(id),
    CONSTRAINT payment_request_type_check CHECK (request_type IN ('SALARY', 'ADVANCE', 'REIMBURSEMENT', 'BONUS')),
    CONSTRAINT payment_request_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX idx_payment_request_run ON payment_request(payroll_run_id);
CREATE INDEX idx_payment_request_status ON payment_request(status, requested_on DESC);
CREATE INDEX idx_payment_request_date ON payment_request(payment_date DESC);

COMMENT ON TABLE payment_request IS 'Payment requests for finance team approval';
```

### 6. Payment Transaction (`payment_transaction`)
Individual payment transactions for each employee.

```sql
CREATE TABLE public.payment_transaction (
    id SERIAL4 PRIMARY KEY,
    transaction_number VARCHAR(30) NOT NULL UNIQUE,

    payment_request_id INT4 NOT NULL,
    payroll_detail_id INT4 NOT NULL,
    user_id INT4 NOT NULL,

    amount DECIMAL(10,2) NOT NULL,

    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    -- PENDING, PROCESSING, SUCCESS, FAILED, CANCELLED

    payment_method VARCHAR(20), -- BANK_TRANSFER, CASH, CHEQUE
    payment_date DATE,
    payment_reference VARCHAR(100),

    -- Bank Transfer Details
    bank_name VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(15),
    utr_number VARCHAR(50), -- Unique Transaction Reference

    failure_reason TEXT,
    remarks TEXT,

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    CONSTRAINT payment_txn_request_fk FOREIGN KEY (payment_request_id) REFERENCES payment_request(id),
    CONSTRAINT payment_txn_detail_fk FOREIGN KEY (payroll_detail_id) REFERENCES payroll_detail(id),
    CONSTRAINT payment_txn_user_fk FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT payment_txn_created_by_fk FOREIGN KEY (created_by) REFERENCES app_user(id),
    CONSTRAINT payment_txn_updated_by_fk FOREIGN KEY (updated_by) REFERENCES app_user(id),
    CONSTRAINT payment_txn_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'))
);

CREATE INDEX idx_payment_txn_request ON payment_transaction(payment_request_id);
CREATE INDEX idx_payment_txn_detail ON payment_transaction(payroll_detail_id);
CREATE INDEX idx_payment_txn_user ON payment_transaction(user_id, payment_date DESC);
CREATE INDEX idx_payment_txn_status ON payment_transaction(status);

COMMENT ON TABLE payment_transaction IS 'Individual payment transactions for employees';
```

### 7. Advance Salary (`advance_salary`)
Employee advance salary requests and deductions.

```sql
CREATE TABLE public.advance_salary (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL,

    request_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,

    installments INT DEFAULT 1,
    installment_amount DECIMAL(10,2) NOT NULL,

    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    -- PENDING, APPROVED, REJECTED, DISBURSED, COMPLETED

    approved_by INT4,
    approved_on TIMESTAMPTZ,
    disbursed_on DATE,

    -- Deduction Tracking
    total_deducted DECIMAL(10,2) DEFAULT 0,
    balance DECIMAL(10,2) NOT NULL,

    remarks TEXT,

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    CONSTRAINT advance_salary_user_fk FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT advance_salary_approved_by_fk FOREIGN KEY (approved_by) REFERENCES app_user(id),
    CONSTRAINT advance_salary_created_by_fk FOREIGN KEY (created_by) REFERENCES app_user(id),
    CONSTRAINT advance_salary_updated_by_fk FOREIGN KEY (updated_by) REFERENCES app_user(id),
    CONSTRAINT advance_salary_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'COMPLETED'))
);

CREATE INDEX idx_advance_salary_user ON advance_salary(user_id, status);
CREATE INDEX idx_advance_salary_status ON advance_salary(status, request_date DESC);

COMMENT ON TABLE advance_salary IS 'Employee advance salary requests and tracking';
```

### 8. Loan Management (`employee_loan`)
Employee loans and repayment tracking.

```sql
CREATE TABLE public.employee_loan (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL,

    loan_type VARCHAR(50) NOT NULL, -- PERSONAL, EMERGENCY, EDUCATION, etc.
    loan_amount DECIMAL(10,2) NOT NULL,
    interest_rate DECIMAL(5,2) DEFAULT 0,

    tenure_months INT NOT NULL,
    installment_amount DECIMAL(10,2) NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    -- ACTIVE, COMPLETED, CANCELLED, DEFAULTED

    approved_by INT4,
    approved_on TIMESTAMPTZ,
    disbursed_on DATE,

    -- Repayment Tracking
    total_repaid DECIMAL(10,2) DEFAULT 0,
    balance DECIMAL(10,2) NOT NULL,

    remarks TEXT,

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    CONSTRAINT employee_loan_user_fk FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT employee_loan_approved_by_fk FOREIGN KEY (approved_by) REFERENCES app_user(id),
    CONSTRAINT employee_loan_created_by_fk FOREIGN KEY (created_by) REFERENCES app_user(id),
    CONSTRAINT employee_loan_updated_by_fk FOREIGN KEY (updated_by) REFERENCES app_user(id),
    CONSTRAINT employee_loan_status_check CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFAULTED'))
);

CREATE INDEX idx_employee_loan_user ON employee_loan(user_id, status);
CREATE INDEX idx_employee_loan_status ON employee_loan(status);

COMMENT ON TABLE employee_loan IS 'Employee loan management and repayment tracking';
```

### 9. Payroll Audit Log (`payroll_audit_log`)
Comprehensive audit trail for all payroll operations.

```sql
CREATE TABLE public.payroll_audit_log (
    id SERIAL8 PRIMARY KEY,
    user_id INT4 NOT NULL,
    action VARCHAR(100) NOT NULL,

    resource_type VARCHAR(50), -- PAYROLL_RUN, PAYROLL_DETAIL, PAYMENT_REQUEST, etc.
    resource_id INT4,

    changes JSONB,
    metadata JSONB,

    ip_address VARCHAR(45),
    user_agent TEXT,

    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT payroll_audit_user_fk FOREIGN KEY (user_id) REFERENCES app_user(id)
);

CREATE INDEX idx_payroll_audit_user ON payroll_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_payroll_audit_resource ON payroll_audit_log(resource_type, resource_id, timestamp DESC);
CREATE INDEX idx_payroll_audit_action ON payroll_audit_log(action, timestamp DESC);

COMMENT ON TABLE payroll_audit_log IS 'Audit trail for all payroll and payment operations';
```

---

## Payroll Calculation Engine

### Calculation Flow

```
┌─────────────────────────────────────────────────────────┐
│         1. INITIALIZE PAYROLL RUN                       │
│    - Create payroll_run record for month               │
│    - Get all active employees                          │
│    - Calculate working days (exclude weekends/holidays)│
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         2. FOR EACH EMPLOYEE                            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         2.1 GET ATTENDANCE DATA                         │
│    - Query attendance table for month                  │
│    - Count present days (status = PRESENT)             │
│    - Count paid leave days (status = ON_LEAVE)         │
│    - Calculate LWP days (absent without leave)         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         2.2 GET SALARY STRUCTURE                        │
│    - Fetch from employee_salary_structure              │
│    - Get all salary components                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         2.3 CALCULATE EARNINGS                          │
│                                                         │
│    Basic Salary: From salary structure                 │
│    HRA: If percentage → Basic × %, else fixed          │
│    DA: If percentage → Basic × %, else fixed           │
│    Transport: Fixed amount                             │
│    Special: Fixed amount                               │
│    Medical: Fixed amount                               │
│                                                         │
│    Overtime: (Overtime hours) × Hourly rate            │
│                                                         │
│    KPI Incentive:                                      │
│      - Get user_score for month                        │
│      - Calculate based on grade:                       │
│        Grade A (≥90): 20% of basic                     │
│        Grade B (≥75): 15% of basic                     │
│        Grade C (≥60): 10% of basic                     │
│        Grade D (≥50): 5% of basic                      │
│        Below 50: 0                                     │
│                                                         │
│    Attendance Bonus:                                   │
│      - If present_days = working_days → Fixed bonus    │
│                                                         │
│    Gross Salary = Sum of all earnings                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         2.4 CALCULATE DEDUCTIONS                        │
│                                                         │
│    PF Employee: Basic × 12% (if applicable)            │
│    PF Employer: Basic × 12% (employer contribution)    │
│    ESI Employee: Gross × 0.75% (if gross < threshold)  │
│    ESI Employer: Gross × 3.25% (employer contribution) │
│                                                         │
│    Professional Tax:                                   │
│      - Based on state rules (e.g., Maharashtra)        │
│      - Typically slab-based                            │
│                                                         │
│    TDS (Income Tax):                                   │
│      - Based on annual income projection               │
│      - Apply tax slabs                                 │
│      - Monthly deduction = Annual tax / 12             │
│                                                         │
│    LWP Deduction:                                      │
│      - Per day salary = Gross / Working days           │
│      - LWP amount = LWP days × Per day salary          │
│                                                         │
│    Advance Salary:                                     │
│      - Get active advances for user                    │
│      - Sum installment amounts for month               │
│                                                         │
│    Loan Repayment:                                     │
│      - Get active loans for user                       │
│      - Sum installment amounts for month               │
│                                                         │
│    Fines/Penalties: Manual entry                       │
│                                                         │
│    Total Deductions = Sum of all deductions            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         2.5 CALCULATE NET SALARY                        │
│                                                         │
│    Net Salary = Gross Salary - Total Deductions        │
│                                                         │
│    Update payroll_detail record                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         3. FINALIZE PAYROLL RUN                         │
│    - Update payroll_run statistics                     │
│    - Mark status as COMPLETED                          │
│    - Generate summary report                           │
└─────────────────────────────────────────────────────────┘
```

### Payroll Calculation Service (TypeScript)

```typescript
// api-v2/src/modules/payroll/payroll-calculation.service.ts

export class PayrollCalculationService {

  async calculateMonthlyPayroll(year: number, month: number, userId: number): Promise<PayrollRun> {
    return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {

      // 1. Create payroll run
      const payrollRun = await this.createPayrollRun(manager, year, month, userId);

      // 2. Get all active employees
      const employees = await this.getActiveEmployees(manager);

      // 3. Calculate working days
      const workingDays = await this.calculateWorkingDays(year, month);

      // 4. Process each employee
      for (const employee of employees) {
        await this.calculateEmployeePayroll(
          manager,
          payrollRun,
          employee,
          year,
          month,
          workingDays
        );
      }

      // 5. Update payroll run statistics
      await this.updatePayrollRunStats(manager, payrollRun.id);

      return payrollRun;
    });
  }

  private async calculateEmployeePayroll(
    manager: EntityManager,
    payrollRun: PayrollRun,
    employee: User,
    year: number,
    month: number,
    workingDays: number
  ): Promise<PayrollDetail> {

    // Get attendance data
    const attendanceData = await this.getAttendanceData(manager, employee.id, year, month);

    // Get salary structure
    const salaryStructure = await this.getSalaryStructure(manager, employee.id);

    // Calculate earnings
    const earnings = await this.calculateEarnings(
      manager,
      employee,
      salaryStructure,
      attendanceData,
      year,
      month
    );

    // Calculate deductions
    const deductions = await this.calculateDeductions(
      manager,
      employee,
      salaryStructure,
      earnings.grossSalary,
      attendanceData.lwpDays,
      workingDays
    );

    // Create payroll detail record
    const payrollDetail = manager.create(PayrollDetail, {
      payrollRunId: payrollRun.id,
      userId: employee.id,
      year,
      month,
      workingDays,
      presentDays: attendanceData.presentDays,
      paidLeaveDays: attendanceData.paidLeaveDays,
      lwpDays: attendanceData.lwpDays,

      // Earnings
      basicSalary: earnings.basic,
      hra: earnings.hra,
      da: earnings.da,
      transportAllowance: earnings.transport,
      specialAllowance: earnings.special,
      medicalAllowance: earnings.medical,
      overtimeAmount: earnings.overtime,
      kpiIncentive: earnings.kpiIncentive,
      attendanceBonus: earnings.attendanceBonus,
      otherAllowances: earnings.other,
      grossSalary: earnings.grossSalary,

      // Deductions
      pfEmployee: deductions.pfEmployee,
      pfEmployer: deductions.pfEmployer,
      esiEmployee: deductions.esiEmployee,
      esiEmployer: deductions.esiEmployer,
      professionalTax: deductions.professionalTax,
      tds: deductions.tds,
      advanceDeduction: deductions.advance,
      loanDeduction: deductions.loan,
      lwpDeduction: deductions.lwp,
      fineDeduction: deductions.fine,
      otherDeductions: deductions.other,
      totalDeductions: deductions.totalDeductions,

      // Net
      netSalary: earnings.grossSalary - deductions.totalDeductions,

      // KPI
      kpiScore: attendanceData.kpiScore,
      kpiGrade: attendanceData.kpiGrade,

      paymentStatus: 'PENDING'
    });

    return await manager.save(PayrollDetail, payrollDetail);
  }

  private async calculateEarnings(
    manager: EntityManager,
    employee: User,
    salaryStructure: EmployeeSalaryStructure,
    attendanceData: any,
    year: number,
    month: number
  ): Promise<any> {

    const basic = salaryStructure.basicSalary;

    // HRA: Percentage or fixed
    const hra = salaryStructure.hraPercentage
      ? basic * (salaryStructure.hraPercentage / 100)
      : salaryStructure.hra;

    // DA: Percentage or fixed
    const da = salaryStructure.daPercentage
      ? basic * (salaryStructure.daPercentage / 100)
      : salaryStructure.da;

    const transport = salaryStructure.transportAllowance;
    const special = salaryStructure.specialAllowance;
    const medical = salaryStructure.medicalAllowance;

    // Overtime (calculated separately)
    const overtime = await this.calculateOvertime(manager, employee.id, year, month);

    // KPI Incentive
    const kpiIncentive = this.calculateKPIIncentive(
      basic,
      attendanceData.kpiScore,
      attendanceData.kpiGrade
    );

    // Attendance Bonus
    const attendanceBonus = this.calculateAttendanceBonus(
      attendanceData.presentDays,
      attendanceData.workingDays,
      basic
    );

    const grossSalary = basic + hra + da + transport + special + medical + overtime + kpiIncentive + attendanceBonus;

    return {
      basic,
      hra,
      da,
      transport,
      special,
      medical,
      overtime,
      kpiIncentive,
      attendanceBonus,
      other: 0,
      grossSalary
    };
  }

  private calculateKPIIncentive(basicSalary: number, kpiScore: number, kpiGrade: string): number {
    if (!kpiScore || !kpiGrade) return 0;

    const incentiveMap = {
      'A': 0.20, // 20% of basic
      'B': 0.15, // 15% of basic
      'C': 0.10, // 10% of basic
      'D': 0.05, // 5% of basic
    };

    const percentage = incentiveMap[kpiGrade] || 0;
    return basicSalary * percentage;
  }

  private calculateAttendanceBonus(presentDays: number, workingDays: number, basicSalary: number): number {
    // Full attendance bonus: 5% of basic salary
    if (presentDays >= workingDays) {
      return basicSalary * 0.05;
    }
    return 0;
  }

  private async calculateDeductions(
    manager: EntityManager,
    employee: User,
    salaryStructure: EmployeeSalaryStructure,
    grossSalary: number,
    lwpDays: number,
    workingDays: number
  ): Promise<any> {

    const basic = salaryStructure.basicSalary;

    // PF (12% of basic)
    const pfEmployee = salaryStructure.pfApplicable
      ? basic * (salaryStructure.pfEmployeePercentage / 100)
      : 0;
    const pfEmployer = salaryStructure.pfApplicable
      ? basic * (salaryStructure.pfEmployerPercentage / 100)
      : 0;

    // ESI (0.75% of gross, if gross < ₹21,000)
    const esiEmployee = (salaryStructure.esiApplicable && grossSalary < 21000)
      ? grossSalary * (salaryStructure.esiEmployeePercentage / 100)
      : 0;
    const esiEmployer = (salaryStructure.esiApplicable && grossSalary < 21000)
      ? grossSalary * (salaryStructure.esiEmployerPercentage / 100)
      : 0;

    // Professional Tax (state-specific)
    const professionalTax = salaryStructure.ptApplicable
      ? this.calculateProfessionalTax(grossSalary)
      : 0;

    // TDS (income tax)
    const tds = salaryStructure.tdsApplicable
      ? await this.calculateTDS(manager, employee.id, grossSalary, year)
      : 0;

    // LWP Deduction
    const perDaySalary = grossSalary / workingDays;
    const lwpDeduction = lwpDays * perDaySalary;

    // Advance Salary Deduction
    const advance = await this.getAdvanceDeduction(manager, employee.id, year, month);

    // Loan Deduction
    const loan = await this.getLoanDeduction(manager, employee.id, year, month);

    // Fines (manual entry)
    const fine = 0;

    const totalDeductions = pfEmployee + esiEmployee + professionalTax + tds +
                            lwpDeduction + advance + loan + fine;

    return {
      pfEmployee,
      pfEmployer,
      esiEmployee,
      esiEmployer,
      professionalTax,
      tds,
      advance,
      loan,
      lwp: lwpDeduction,
      fine,
      other: 0,
      totalDeductions
    };
  }

  private calculateProfessionalTax(grossSalary: number): number {
    // Maharashtra PT slabs (example)
    if (grossSalary <= 7500) return 0;
    if (grossSalary <= 10000) return 175;
    return 200; // ₹200 per month for gross > ₹10,000
  }

  private async calculateTDS(
    manager: EntityManager,
    userId: number,
    monthlyGross: number,
    year: number
  ): Promise<number> {
    // Simplified TDS calculation
    // In production, this would consider:
    // - Annual projected income
    // - Tax regime (old/new)
    // - Deductions under 80C, 80D, etc.
    // - HRA exemption

    const annualIncome = monthlyGross * 12;
    const taxableIncome = annualIncome - 50000; // Standard deduction

    let annualTax = 0;

    // New tax regime slabs (2023-24)
    if (taxableIncome <= 300000) {
      annualTax = 0;
    } else if (taxableIncome <= 600000) {
      annualTax = (taxableIncome - 300000) * 0.05;
    } else if (taxableIncome <= 900000) {
      annualTax = 15000 + (taxableIncome - 600000) * 0.10;
    } else if (taxableIncome <= 1200000) {
      annualTax = 45000 + (taxableIncome - 900000) * 0.15;
    } else if (taxableIncome <= 1500000) {
      annualTax = 90000 + (taxableIncome - 1200000) * 0.20;
    } else {
      annualTax = 150000 + (taxableIncome - 1500000) * 0.30;
    }

    // Monthly TDS
    return Math.round(annualTax / 12);
  }
}
```

---

## Finance Payment Workflow

### Workflow States

```
PAYROLL RUN WORKFLOW:
DRAFT → IN_PROGRESS → COMPLETED → VERIFIED → APPROVED → PAYMENT_REQUESTED → PAYMENT_PROCESSING → PAID

PAYMENT REQUEST WORKFLOW:
PENDING → APPROVED → PROCESSING → COMPLETED
         ↓
      REJECTED

PAYMENT TRANSACTION WORKFLOW:
PENDING → PROCESSING → SUCCESS
                     ↓
                   FAILED
```

### Approval Matrix

| Action | Role Required | Permission |
|--------|---------------|------------|
| Create Payroll Run | HR Manager / Store Head | `payroll.create` |
| Verify Payroll | HR Manager | `payroll.verify` |
| Approve Payroll | Owner / Admin | `payroll.approve` |
| Create Payment Request | HR Manager | `payment.request` |
| Approve Payment Request | Finance Manager | `payment.approve` |
| Process Payment | Finance Team | `payment.process` |
| View Payslip | Employee (self) / HR | `payroll.view` |

---

## API Specifications

### Payroll Endpoints

#### 1. Create Payroll Run
```http
POST /api/payroll/runs
Authorization: Bearer {token}

Request:
{
  "year": 2026,
  "month": 1,
  "remarks": "January 2026 payroll"
}

Response:
{
  "id": 1,
  "year": 2026,
  "month": 1,
  "status": "DRAFT",
  "totalEmployees": 0,
  "processedEmployees": 0,
  "totalGrossAmount": 0,
  "totalDeductions": 0,
  "totalNetAmount": 0,
  "initiatedBy": 1,
  "initiatedOn": "2026-01-10T10:00:00Z"
}
```

#### 2. Calculate Payroll
```http
POST /api/payroll/runs/:id/calculate
Authorization: Bearer {token}

Response:
{
  "id": 1,
  "status": "IN_PROGRESS",
  "message": "Payroll calculation started"
}
```

#### 3. Get Payroll Details
```http
GET /api/payroll/runs/:id/details
Authorization: Bearer {token}

Response:
{
  "payrollRun": {
    "id": 1,
    "year": 2026,
    "month": 1,
    "status": "COMPLETED",
    "totalEmployees": 10,
    "totalGrossAmount": 500000.00,
    "totalDeductions": 75000.00,
    "totalNetAmount": 425000.00
  },
  "details": [
    {
      "id": 1,
      "userId": 5,
      "userName": "John Doe",
      "workingDays": 26,
      "presentDays": 25,
      "paidLeaveDays": 1,
      "lwpDays": 0,
      "basicSalary": 30000.00,
      "hra": 12000.00,
      "da": 3000.00,
      "transportAllowance": 2000.00,
      "kpiIncentive": 6000.00,
      "grossSalary": 53000.00,
      "pfEmployee": 3600.00,
      "professionalTax": 200.00,
      "tds": 1500.00,
      "totalDeductions": 5300.00,
      "netSalary": 47700.00,
      "kpiScore": 92.5,
      "kpiGrade": "A",
      "paymentStatus": "PENDING"
    }
  ]
}
```

#### 4. Verify Payroll
```http
POST /api/payroll/runs/:id/verify
Authorization: Bearer {token}

Request:
{
  "remarks": "Verified all calculations"
}

Response:
{
  "id": 1,
  "status": "VERIFIED",
  "verifiedBy": 2,
  "verifiedOn": "2026-01-10T15:00:00Z"
}
```

#### 5. Approve Payroll
```http
POST /api/payroll/runs/:id/approve
Authorization: Bearer {token}

Request:
{
  "remarks": "Approved for payment processing"
}

Response:
{
  "id": 1,
  "status": "APPROVED",
  "approvedBy": 1,
  "approvedOn": "2026-01-10T16:00:00Z"
}
```

### Payment Request Endpoints

#### 6. Create Payment Request
```http
POST /api/finance/payment-requests
Authorization: Bearer {token}

Request:
{
  "payrollRunId": 1,
  "requestType": "SALARY",
  "remarks": "January 2026 salary payment"
}

Response:
{
  "id": 1,
  "requestNumber": "PR/2026/01/0001",
  "payrollRunId": 1,
  "totalEmployees": 10,
  "totalAmount": 425000.00,
  "status": "PENDING",
  "requestedBy": 2,
  "requestedOn": "2026-01-10T16:30:00Z"
}
```

#### 7. Approve Payment Request
```http
POST /api/finance/payment-requests/:id/approve
Authorization: Bearer {token}

Request:
{
  "remarks": "Approved for bank transfer"
}

Response:
{
  "id": 1,
  "status": "APPROVED",
  "approvedBy": 3,
  "approvedOn": "2026-01-11T10:00:00Z"
}
```

#### 8. Process Payments
```http
POST /api/finance/payment-requests/:id/process
Authorization: Bearer {token}

Request:
{
  "paymentMethod": "BANK_TRANSFER",
  "paymentDate": "2026-01-12",
  "remarks": "Processed via NEFT"
}

Response:
{
  "id": 1,
  "status": "PROCESSING",
  "processedBy": 3,
  "processedOn": "2026-01-12T11:00:00Z",
  "transactionsCreated": 10
}
```

### Employee Endpoints

#### 9. Get My Payslips
```http
GET /api/payroll/my-payslips
Authorization: Bearer {token}
Query Params: ?year=2026&month=1

Response:
{
  "payslips": [
    {
      "id": 1,
      "year": 2026,
      "month": 1,
      "workingDays": 26,
      "presentDays": 25,
      "earnings": {
        "basic": 30000.00,
        "hra": 12000.00,
        "da": 3000.00,
        "transport": 2000.00,
        "kpiIncentive": 6000.00,
        "gross": 53000.00
      },
      "deductions": {
        "pf": 3600.00,
        "pt": 200.00,
        "tds": 1500.00,
        "total": 5300.00
      },
      "netSalary": 47700.00,
      "paymentStatus": "PAID",
      "paymentDate": "2026-01-12"
    }
  ]
}
```

#### 10. Download Payslip PDF
```http
GET /api/payroll/payslips/:id/pdf
Authorization: Bearer {token}

Response: PDF file download
```

---

## Frontend Components

### 1. Payroll Module Navigation

```
Finance
├── Payroll
│   ├── Payroll Dashboard
│   ├── Create Payroll Run
│   ├── Payroll History
│   ├── Employee Salary Structure
│   └── Payroll Reports
│
├── Payments
│   ├── Payment Requests
│   ├── Payment Approval
│   ├── Payment Processing
│   └── Payment History
│
├── Advances & Loans
│   ├── Advance Requests
│   ├── Loan Management
│   └── Deduction Tracking
│
└── Reports
    ├── Payroll Summary
    ├── Department-wise
    ├── Tax Reports
    └── Payment Status
```

### 2. Key Components

#### Payroll Dashboard Component
```typescript
// frontend/src/app/secured/finance/payroll/payroll-dashboard.component.ts

@Component({
  selector: 'app-payroll-dashboard',
  template: `
    <div class="payroll-dashboard">
      <h2>Payroll Dashboard</h2>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <p-card header="Current Month Payroll">
          <div class="stat">
            <span class="label">Total Employees:</span>
            <span class="value">{{currentPayroll?.totalEmployees}}</span>
          </div>
          <div class="stat">
            <span class="label">Gross Amount:</span>
            <span class="value">₹{{currentPayroll?.totalGrossAmount | number:'1.2-2'}}</span>
          </div>
          <div class="stat">
            <span class="label">Net Amount:</span>
            <span class="value">₹{{currentPayroll?.totalNetAmount | number:'1.2-2'}}</span>
          </div>
          <div class="stat">
            <span class="label">Status:</span>
            <span class="badge" [class]="currentPayroll?.status">{{currentPayroll?.status}}</span>
          </div>
        </p-card>

        <p-card header="Pending Actions">
          <ul>
            <li *ngFor="let action of pendingActions">
              {{action.description}}
              <button (click)="handleAction(action)">{{action.buttonText}}</button>
            </li>
          </ul>
        </p-card>
      </div>

      <!-- Recent Payroll Runs -->
      <div class="recent-runs">
        <h3>Recent Payroll Runs</h3>
        <p-table [value]="recentRuns">
          <ng-template pTemplate="header">
            <tr>
              <th>Period</th>
              <th>Employees</th>
              <th>Gross Amount</th>
              <th>Net Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-run>
            <tr>
              <td>{{run.month}}/{{run.year}}</td>
              <td>{{run.totalEmployees}}</td>
              <td>₹{{run.totalGrossAmount | number:'1.2-2'}}</td>
              <td>₹{{run.totalNetAmount | number:'1.2-2'}}</td>
              <td><span class="badge" [class]="run.status">{{run.status}}</span></td>
              <td>
                <button (click)="viewDetails(run)">View</button>
                <button *ngIf="canVerify(run)" (click)="verify(run)">Verify</button>
                <button *ngIf="canApprove(run)" (click)="approve(run)">Approve</button>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `
})
export class PayrollDashboardComponent implements OnInit {
  currentPayroll: PayrollRun;
  recentRuns: PayrollRun[];
  pendingActions: any[];

  constructor(private payrollService: PayrollService) {}

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.payrollService.getDashboard().subscribe(data => {
      this.currentPayroll = data.currentPayroll;
      this.recentRuns = data.recentRuns;
      this.pendingActions = data.pendingActions;
    });
  }
}
```

#### Create Payroll Run Component
```typescript
// frontend/src/app/secured/finance/payroll/create-payroll-run.component.ts

@Component({
  selector: 'app-create-payroll-run',
  template: `
    <div class="create-payroll">
      <h2>Create Payroll Run</h2>

      <form [formGroup]="payrollForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label>Year</label>
          <p-dropdown formControlName="year" [options]="years"></p-dropdown>
        </div>

        <div class="form-group">
          <label>Month</label>
          <p-dropdown formControlName="month" [options]="months"></p-dropdown>
        </div>

        <div class="form-group">
          <label>Remarks</label>
          <textarea formControlName="remarks" pInputTextarea></textarea>
        </div>

        <button type="submit" pButton label="Create & Calculate" [disabled]="!payrollForm.valid"></button>
      </form>

      <!-- Calculation Progress -->
      <div *ngIf="calculating" class="progress-section">
        <h3>Calculating Payroll...</h3>
        <p-progressBar [value]="calculationProgress"></p-progressBar>
        <p>Processing {{processedEmployees}} of {{totalEmployees}} employees</p>
      </div>
    </div>
  `
})
export class CreatePayrollRunComponent {
  payrollForm: FormGroup;
  years: any[];
  months: any[];
  calculating = false;
  calculationProgress = 0;
  processedEmployees = 0;
  totalEmployees = 0;

  constructor(
    private fb: FormBuilder,
    private payrollService: PayrollService,
    private messageService: MessageService
  ) {
    this.initForm();
  }

  initForm() {
    const currentYear = new Date().getFullYear();
    this.years = [
      { label: currentYear.toString(), value: currentYear },
      { label: (currentYear - 1).toString(), value: currentYear - 1 }
    ];

    this.months = [
      { label: 'January', value: 1 },
      { label: 'February', value: 2 },
      // ... all months
      { label: 'December', value: 12 }
    ];

    this.payrollForm = this.fb.group({
      year: [currentYear, Validators.required],
      month: [new Date().getMonth() + 1, Validators.required],
      remarks: ['']
    });
  }

  onSubmit() {
    if (this.payrollForm.valid) {
      this.calculating = true;

      this.payrollService.createAndCalculate(this.payrollForm.value).subscribe({
        next: (result) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Payroll calculated successfully'
          });
          // Navigate to details
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.message
          });
          this.calculating = false;
        }
      });
    }
  }
}
```

#### Payment Request Component
```typescript
// frontend/src/app/secured/finance/payment/payment-request.component.ts

@Component({
  selector: 'app-payment-request',
  template: `
    <div class="payment-requests">
      <h2>Payment Requests</h2>

      <p-table [value]="paymentRequests" [rows]="10" [paginator]="true">
        <ng-template pTemplate="header">
          <tr>
            <th>Request No.</th>
            <th>Payroll Period</th>
            <th>Employees</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Requested By</th>
            <th>Requested On</th>
            <th>Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-request>
          <tr>
            <td>{{request.requestNumber}}</td>
            <td>{{request.payrollMonth}}/{{request.payrollYear}}</td>
            <td>{{request.totalEmployees}}</td>
            <td>₹{{request.totalAmount | number:'1.2-2'}}</td>
            <td><span class="badge" [class]="request.status">{{request.status}}</span></td>
            <td>{{request.requestedByName}}</td>
            <td>{{request.requestedOn | date:'short'}}</td>
            <td>
              <button (click)="viewDetails(request)">View</button>
              <button *ngIf="canApprove(request)" (click)="approve(request)">Approve</button>
              <button *ngIf="canProcess(request)" (click)="process(request)">Process</button>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `
})
export class PaymentRequestComponent implements OnInit {
  paymentRequests: PaymentRequest[];

  constructor(
    private paymentService: PaymentService,
    private messageService: MessageService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadPaymentRequests();
  }

  loadPaymentRequests() {
    this.paymentService.getPaymentRequests().subscribe(data => {
      this.paymentRequests = data;
    });
  }

  canApprove(request: PaymentRequest): boolean {
    return request.status === 'PENDING' &&
           this.authService.isActionAuthorized('payment.approve');
  }

  canProcess(request: PaymentRequest): boolean {
    return request.status === 'APPROVED' &&
           this.authService.isActionAuthorized('payment.process');
  }

  approve(request: PaymentRequest) {
    this.paymentService.approvePaymentRequest(request.id, {
      remarks: 'Approved'
    }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Payment request approved'
        });
        this.loadPaymentRequests();
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.message
        });
      }
    });
  }

  process(request: PaymentRequest) {
    // Show dialog for payment details
    // Then process payment
  }
}
```

#### Employee Payslip Component
```typescript
// frontend/src/app/secured/hr/payslip/my-payslips.component.ts

@Component({
  selector: 'app-my-payslips',
  template: `
    <div class="my-payslips">
      <h2>My Payslips</h2>

      <div class="filters">
        <p-dropdown [(ngModel)]="selectedYear" [options]="years" (onChange)="loadPayslips()"></p-dropdown>
        <p-dropdown [(ngModel)]="selectedMonth" [options]="months" (onChange)="loadPayslips()"></p-dropdown>
      </div>

      <div class="payslip-list">
        <div *ngFor="let payslip of payslips" class="payslip-card">
          <p-card>
            <h3>{{getMonthName(payslip.month)}} {{payslip.year}}</h3>

            <div class="payslip-summary">
              <div class="earnings">
                <h4>Earnings</h4>
                <div class="item">
                  <span>Basic Salary</span>
                  <span>₹{{payslip.basicSalary | number:'1.2-2'}}</span>
                </div>
                <div class="item">
                  <span>HRA</span>
                  <span>₹{{payslip.hra | number:'1.2-2'}}</span>
                </div>
                <div class="item">
                  <span>DA</span>
                  <span>₹{{payslip.da | number:'1.2-2'}}</span>
                </div>
                <div class="item">
                  <span>KPI Incentive</span>
                  <span>₹{{payslip.kpiIncentive | number:'1.2-2'}}</span>
                </div>
                <div class="item total">
                  <span><strong>Gross Salary</strong></span>
                  <span><strong>₹{{payslip.grossSalary | number:'1.2-2'}}</strong></span>
                </div>
              </div>

              <div class="deductions">
                <h4>Deductions</h4>
                <div class="item">
                  <span>PF</span>
                  <span>₹{{payslip.pfEmployee | number:'1.2-2'}}</span>
                </div>
                <div class="item">
                  <span>Professional Tax</span>
                  <span>₹{{payslip.professionalTax | number:'1.2-2'}}</span>
                </div>
                <div class="item">
                  <span>TDS</span>
                  <span>₹{{payslip.tds | number:'1.2-2'}}</span>
                </div>
                <div class="item total">
                  <span><strong>Total Deductions</strong></span>
                  <span><strong>₹{{payslip.totalDeductions | number:'1.2-2'}}</strong></span>
                </div>
              </div>
            </div>

            <div class="net-salary">
              <span>Net Salary</span>
              <span class="amount">₹{{payslip.netSalary | number:'1.2-2'}}</span>
            </div>

            <div class="actions">
              <button pButton label="Download PDF" icon="pi pi-download"
                      (click)="downloadPDF(payslip)"></button>
              <span class="payment-status" [class]="payslip.paymentStatus">
                {{payslip.paymentStatus}}
              </span>
            </div>
          </p-card>
        </div>
      </div>
    </div>
  `
})
export class MyPayslipsComponent implements OnInit {
  payslips: PayrollDetail[];
  selectedYear: number;
  selectedMonth: number;
  years: any[];
  months: any[];

  constructor(private payrollService: PayrollService) {
    this.initFilters();
  }

  ngOnInit() {
    this.loadPayslips();
  }

  initFilters() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    this.selectedYear = currentYear;
    this.selectedMonth = currentMonth;

    this.years = [
      { label: currentYear.toString(), value: currentYear },
      { label: (currentYear - 1).toString(), value: currentYear - 1 }
    ];

    this.months = [
      { label: 'All Months', value: null },
      { label: 'January', value: 1 },
      // ... all months
    ];
  }

  loadPayslips() {
    this.payrollService.getMyPayslips(this.selectedYear, this.selectedMonth).subscribe(data => {
      this.payslips = data.payslips;
    });
  }

  downloadPDF(payslip: PayrollDetail) {
    this.payrollService.downloadPayslipPDF(payslip.id).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Payslip_${payslip.month}_${payslip.year}.pdf`;
      link.click();
    });
  }

  getMonthName(month: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  }
}
```

---

## Integration Points

### 1. HR Module Integration

```typescript
// Attendance Data Integration
async getAttendanceData(userId: number, year: number, month: number) {
  // Get all attendance records for the month
  const attendanceRecords = await this.attendanceRepository.find({
    where: {
      userId,
      attendanceDate: Between(
        new Date(year, month - 1, 1),
        new Date(year, month, 0)
      )
    }
  });

  // Calculate metrics
  const presentDays = attendanceRecords.filter(a =>
    a.status === 'PRESENT' || a.status === 'REMOTE_WORK'
  ).length;

  const paidLeaveDays = attendanceRecords.filter(a =>
    a.status === 'ON_LEAVE'
  ).length;

  const absentDays = attendanceRecords.filter(a =>
    a.status === 'ABSENT'
  ).length;

  // Get KPI score for the month
  const kpiScore = await this.userScoreRepository.findOne({
    where: {
      userId,
      scorePeriod: 'MONTHLY',
      scoreDate: new Date(year, month - 1, 1)
    }
  });

  return {
    workingDays: this.getWorkingDays(year, month),
    presentDays,
    paidLeaveDays,
    lwpDays: absentDays,
    kpiScore: kpiScore?.totalScore || 0,
    kpiGrade: kpiScore?.grade || 'D'
  };
}

// Leave Balance Integration
async updateLeaveBalanceOnPayroll(userId: number, year: number, month: number) {
  // When payroll is processed, update leave balances
  // This ensures leaves are properly tracked
}
```

### 2. Finance Module Integration

```typescript
// Payment Integration with Existing vendor_payment pattern
async createPaymentTransactions(paymentRequestId: number) {
  const paymentRequest = await this.paymentRequestRepository.findOne({
    where: { id: paymentRequestId },
    relations: ['payrollRun', 'payrollRun.details']
  });

  const transactions = [];

  for (const detail of paymentRequest.payrollRun.details) {
    const transaction = this.paymentTransactionRepository.create({
      paymentRequestId,
      payrollDetailId: detail.id,
      userId: detail.userId,
      amount: detail.netSalary,
      status: 'PENDING',
      paymentMethod: 'BANK_TRANSFER',
      // Get bank details from salary structure
      bankName: detail.user.salaryStructure.bankName,
      accountNumber: detail.user.salaryStructure.accountNumber,
      ifscCode: detail.user.salaryStructure.ifscCode
    });

    transactions.push(transaction);
  }

  return await this.paymentTransactionRepository.save(transactions);
}
```

---

## Security & Compliance

### 1. Data Security

```typescript
// Sensitive Data Encryption
class SalaryDataEncryption {
  // Encrypt bank account numbers
  encryptAccountNumber(accountNumber: string): string {
    // Use AES encryption
  }

  // Decrypt only when needed
  decryptAccountNumber(encrypted: string): string {
    // Decrypt for payment processing
  }

  // Mask sensitive data in logs
  maskSensitiveData(data: any): any {
    return {
      ...data,
      accountNumber: data.accountNumber?.replace(/\d(?=\d{4})/g, '*'),
      panNumber: data.panNumber?.replace(/^(.{3})(.{3})/, '$1***'),
    };
  }
}
```

### 2. Audit Trail

```typescript
// Comprehensive audit logging
async logPayrollAction(action: string, resourceType: string, resourceId: number, changes: any, userId: number) {
  await this.payrollAuditLogRepository.save({
    userId,
    action,
    resourceType,
    resourceId,
    changes,
    ipAddress: this.request.ip,
    userAgent: this.request.headers['user-agent'],
    timestamp: new Date()
  });
}

// Usage
await this.logPayrollAction(
  'PAYROLL_RUN_CREATED',
  'PAYROLL_RUN',
  payrollRun.id,
  { year: 2026, month: 1 },
  userId
);

await this.logPayrollAction(
  'PAYMENT_APPROVED',
  'PAYMENT_REQUEST',
  paymentRequest.id,
  { approvedBy: userId, approvedOn: new Date() },
  userId
);
```

### 3. Role-Based Access Control

```sql
-- Update role permissions to include payroll and finance
UPDATE app_role
SET permissions = jsonb_insert(
    permissions::jsonb,
    '{11}',
    '{
      "resource":"payroll",
      "path":["/secure/finance/payroll"],
      "policies":[
        {"action":"create"},
        {"action":"verify"},
        {"action":"view"}
      ]
    }'::jsonb
)
WHERE id = 3; -- Store Head

UPDATE app_role
SET permissions = jsonb_insert(
    permissions::jsonb,
    '{12}',
    '{
      "resource":"finance",
      "path":["/secure/finance/payments"],
      "policies":[
        {"action":"approve"},
        {"action":"process"}
      ]
    }'::jsonb
)
WHERE id = 1; -- Admin
```

### 4. Tax Compliance

```typescript
// Generate tax reports
class TaxComplianceService {

  // Form 16 generation (TDS certificate)
  async generateForm16(userId: number, financialYear: string) {
    const payrollDetails = await this.getAnnualPayrollDetails(userId, financialYear);

    return {
      employeeName: payrollDetails.employeeName,
      panNumber: payrollDetails.panNumber,
      financialYear,
      assessmentYear: this.getAssessmentYear(financialYear),
      grossSalary: payrollDetails.totalGross,
      deductions: payrollDetails.totalDeductions,
      taxableIncome: payrollDetails.taxableIncome,
      taxDeducted: payrollDetails.totalTDS,
      quarters: payrollDetails.quarterlyBreakdown
    };
  }

  // PF return generation
  async generatePFReturn(month: number, year: number) {
    const payrollDetails = await this.getMonthlyPFDetails(month, year);

    return {
      month,
      year,
      employees: payrollDetails.map(d => ({
        uan: d.user.pfNumber,
        name: d.user.fullName,
        grossWages: d.basicSalary,
        epfWages: d.basicSalary,
        employeeContribution: d.pfEmployee,
        employerContribution: d.pfEmployer
      }))
    };
  }

  // ESI return generation
  async generateESIReturn(month: number, year: number) {
    const payrollDetails = await this.getMonthlyESIDetails(month, year);

    return {
      month,
      year,
      employees: payrollDetails.filter(d => d.esiEmployee > 0).map(d => ({
        esiNumber: d.user.esiNumber,
        name: d.user.fullName,
        grossWages: d.grossSalary,
        employeeContribution: d.esiEmployee,
        employerContribution: d.esiEmployer
      }))
    };
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal**: Set up database schema and basic payroll calculation

1. **Database Schema** (3 days)
   - Create all payroll and finance tables
   - Add indexes and constraints
   - Create helper functions
   - Run migrations

2. **Backend Services** (4 days)
   - `EmployeeSalaryStructureService` - CRUD operations
   - `PayrollCalculationService` - Core calculation logic
   - `PayrollRunService` - Payroll run management
   - Unit tests for calculation logic

3. **API Endpoints** (3 days)
   - Payroll run endpoints
   - Salary structure endpoints
   - Basic integration tests

### Phase 2: Finance Workflow (Week 3)
**Goal**: Implement payment request and approval workflow

1. **Payment Services** (3 days)
   - `PaymentRequestService`
   - `PaymentTransactionService`
   - Workflow state management

2. **API Endpoints** (2 days)
   - Payment request endpoints
   - Approval and processing endpoints
   - Integration with payroll

3. **Testing** (2 days)
   - Integration tests
   - Workflow testing

### Phase 3: Frontend Components (Week 4-5)
**Goal**: Build user interface for payroll and finance

1. **Payroll Components** (4 days)
   - Payroll Dashboard
   - Create Payroll Run
   - Payroll Details View
   - Employee Salary Structure Management

2. **Finance Components** (3 days)
   - Payment Request Dashboard
   - Payment Approval Interface
   - Payment Processing Interface

3. **Employee Components** (3 days)
   - My Payslips View
   - Payslip PDF Generation
   - Salary Structure View

### Phase 4: Advanced Features (Week 6)
**Goal**: Implement additional features and statutory compliance

1. **Advances & Loans** (2 days)
   - Advance salary management
   - Loan management
   - Deduction tracking

2. **Tax Compliance** (3 days)
   - TDS calculation refinement
   - Form 16 generation
   - PF/ESI return generation

3. **Reports** (2 days)
   - Payroll summary reports
   - Department-wise reports
   - Tax reports

### Phase 5: Testing & Deployment (Week 7)
**Goal**: Comprehensive testing and production deployment

1. **Testing** (4 days)
   - End-to-end testing
   - Performance testing
   - Security testing
   - User acceptance testing

2. **Deployment** (1 day)
   - Database migration in production
   - API deployment
   - Frontend deployment

3. **Documentation & Training** (2 days)
   - User manual
   - Training videos
   - Admin guide

---

## Testing Strategy

### 1. Unit Tests

```typescript
describe('PayrollCalculationService', () => {

  describe('calculateKPIIncentive', () => {
    it('should calculate 20% for Grade A (score >= 90)', () => {
      const basic = 30000;
      const score = 92.5;
      const grade = 'A';
      const incentive = service.calculateKPIIncentive(basic, score, grade);
      expect(incentive).toBe(6000); // 20% of 30000
    });

    it('should calculate 15% for Grade B (score >= 75)', () => {
      const basic = 30000;
      const score = 80;
      const grade = 'B';
      const incentive = service.calculateKPIIncentive(basic, score, grade);
      expect(incentive).toBe(4500); // 15% of 30000
    });

    it('should return 0 for score < 50', () => {
      const basic = 30000;
      const score = 45;
      const grade = null;
      const incentive = service.calculateKPIIncentive(basic, score, grade);
      expect(incentive).toBe(0);
    });
  });

  describe('calculateProfessionalTax', () => {
    it('should return 0 for gross <= 7500', () => {
      const pt = service.calculateProfessionalTax(7000);
      expect(pt).toBe(0);
    });

    it('should return 175 for gross between 7501-10000', () => {
      const pt = service.calculateProfessionalTax(9000);
      expect(pt).toBe(175);
    });

    it('should return 200 for gross > 10000', () => {
      const pt = service.calculateProfessionalTax(50000);
      expect(pt).toBe(200);
    });
  });
});
```

### 2. Integration Tests

```typescript
describe('Payroll Workflow Integration', () => {

  it('should complete full payroll cycle', async () => {
    // 1. Create payroll run
    const payrollRun = await request(app)
      .post('/api/payroll/runs')
      .send({ year: 2026, month: 1 })
      .expect(201);

    // 2. Calculate payroll
    await request(app)
      .post(`/api/payroll/runs/${payrollRun.body.id}/calculate`)
      .expect(200);

    // 3. Verify calculations
    const details = await request(app)
      .get(`/api/payroll/runs/${payrollRun.body.id}/details`)
      .expect(200);

    expect(details.body.details).toHaveLength(10); // 10 employees
    expect(details.body.payrollRun.status).toBe('COMPLETED');

    // 4. Verify payroll
    await request(app)
      .post(`/api/payroll/runs/${payrollRun.body.id}/verify`)
      .expect(200);

    // 5. Approve payroll
    await request(app)
      .post(`/api/payroll/runs/${payrollRun.body.id}/approve`)
      .expect(200);

    // 6. Create payment request
    const paymentRequest = await request(app)
      .post('/api/finance/payment-requests')
      .send({ payrollRunId: payrollRun.body.id })
      .expect(201);

    expect(paymentRequest.body.status).toBe('PENDING');
  });
});
```

### 3. Test Data Setup

```sql
-- Test employee with salary structure
INSERT INTO employee_salary_structure (
  user_id, basic_salary, hra, da, transport_allowance,
  pf_applicable, esi_applicable, pt_applicable, tds_applicable,
  effective_from, created_by, updated_by
) VALUES (
  5, 30000, 12000, 3000, 2000,
  true, false, true, true,
  '2026-01-01', 1, 1
);

-- Test attendance data
INSERT INTO attendance (user_id, attendance_date, shift_id, clock_in_time, clock_out_time, total_hours, status)
SELECT
  5,
  generate_series('2026-01-01'::date, '2026-01-31'::date, '1 day'::interval)::date,
  1,
  generate_series('2026-01-01 09:00'::timestamp, '2026-01-31 09:00'::timestamp, '1 day'::interval),
  generate_series('2026-01-01 18:00'::timestamp, '2026-01-31 18:00'::timestamp, '1 day'::interval),
  8,
  'PRESENT'
WHERE EXTRACT(DOW FROM generate_series('2026-01-01'::date, '2026-01-31'::date, '1 day'::interval)) NOT IN (0, 6);

-- Test KPI score
INSERT INTO user_score (
  user_id, score_date, score_period,
  attendance_score, punctuality_score, working_hours_score, reliability_score,
  total_score, grade,
  present_days, total_working_days
) VALUES (
  5, '2026-01-01', 'MONTHLY',
  95, 90, 92, 88,
  92, 'A',
  26, 26
);
```

---

## Additional Recommendations

### 1. Automated Notifications

Implement email/SMS notifications for:
- Payroll run completion
- Payment request created
- Payment approved
- Salary credited
- Payslip available for download

### 2. Dashboard Analytics

Add analytics widgets:
- Monthly payroll trends
- Department-wise salary distribution
- Average salary growth
- Tax deduction analysis
- Attendance vs salary correlation

### 3. Bulk Operations

Support bulk operations:
- Bulk salary structure updates
- Bulk advance approval
- Bulk payment processing
- Bulk payslip download

### 4. Mobile App Support

Develop mobile features:
- View payslips on mobile
- Download payslips
- Push notifications for salary credit
- Quick access to salary breakdown

### 5. Integration with Banking

For future enhancement:
- Bank API integration for direct transfer
- Auto-reconciliation of payments
- Payment status tracking
- Failed payment retry mechanism

### 6. Statutory Compliance Automation

- Auto-generate PF challan
- Auto-generate ESI return
- Auto-calculate professional tax
- TDS certificate generation
- Annual tax computation

---

## Conclusion

This comprehensive Payroll and Finance Module design provides:

1. **Complete Payroll Automation**: From attendance tracking to salary calculation
2. **Flexible Salary Structure**: Configurable components for different employee types
3. **KPI-Based Incentives**: Automated performance-based rewards
4. **Robust Finance Workflow**: Multi-level approval system
5. **Tax Compliance**: Built-in statutory deduction calculations
6. **Audit Trail**: Complete transparency and accountability
7. **Employee Self-Service**: Access to payslips and salary breakdowns
8. **Scalable Architecture**: Designed to handle growth

The implementation follows best practices:
- Transaction-safe operations
- Comprehensive error handling
- Role-based access control
- Detailed audit logging
- Performance optimization (table partitioning, indexes)

**Estimated Timeline**: 7 weeks for complete implementation
**Team Requirement**: 1 backend developer + 1 frontend developer
**Tech Stack**: NestJS, TypeScript, PostgreSQL, Angular, PrimeNG

---

**Next Steps**:
1. Review and approve this design
2. Prioritize features (MVP vs future enhancements)
3. Allocate development resources
4. Begin Phase 1 implementation
