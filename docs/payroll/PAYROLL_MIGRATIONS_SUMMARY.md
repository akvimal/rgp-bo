# Flexible Payroll System - Database Migrations Summary

**Date**: 2026-01-10
**Status**: Ready for Execution
**Migrations**: 006 through 010

---

## Overview

This document summarizes the database migrations created for the Flexible Payroll System. The system supports multiple employment types (full-time, part-time, contractual, hourly) with role-specific salary structures and KPI-based incentives.

---

## Migration Files Created

### Individual Migration Files

| File | Purpose | Tables Created |
|------|---------|---------------|
| **006_employment_type_role_masters.sql** | Employment types and role definitions | `employment_type_master`, `role_master` |
| **007_salary_component_master.sql** | Salary component catalog | `salary_component_master` |
| **008_flexible_salary_structure.sql** | Employee salary configurations | `employee_salary_structure` |
| **009_payroll_tables.sql** | Payroll processing and payments | `payroll_run`, `payroll_detail`, `payment_request`, `payment_request_item`, `payment_transaction` |
| **010_kpi_enhancements.sql** | KPI tracking and scoring | `kpi_category_master`, `monthly_kpi_score` |

### Consolidated Migration File

- **006-010_flexible_payroll_system_complete.sql**: Runs all 5 migrations in sequence with verification

---

## Database Schema Summary

### 1. Master Tables (Configuration)

#### employment_type_master
- **Purpose**: Define employment types with statutory applicability
- **Records Created**: 4 types
  - FULLTIME (monthly fixed with all benefits)
  - PARTTIME (retainer + per-day, no PF/ESI/PT)
  - CONTRACTUAL (project-based)
  - HOURLY (hourly wage)

#### role_master
- **Purpose**: Define roles/designations linked to employment types
- **Records Created**: 4 roles
  - ASSOCIATE (Full-time, Level 1)
  - SENIOR (Full-time, Level 2)
  - PARTTIME_PHARMACIST (Part-time, Level 2)
  - MANAGER (Full-time, Level 3)

#### salary_component_master
- **Purpose**: Catalog of all salary components with calculation methods
- **Records Created**: 17 components
  - **Earnings**: BASIC, HRA, CONVEYANCE, FOOD_MEAL, SPECIAL, DA, RETAINER, EXTRA_DAYS, KPI_INCENTIVE
  - **Deductions**: PF_EMPLOYEE, PF_EMPLOYER, ESI_EMPLOYEE, ESI_EMPLOYER, PT, TDS, LWP, ADVANCE, LOAN, FINE
  - **Reimbursements**: INSURANCE_REIMB

#### kpi_category_master
- **Purpose**: Role-specific KPI categories with scoring criteria
- **Records Created**: 16 categories
  - **Associate (5 categories, 100 points total)**:
    - Attendance & Punctuality: 25 points
    - Billing Accuracy & Cash Handling: 25 points
    - Stock Handling & Expiry Support: 20 points
    - Customer Service & Store Upkeep: 20 points
    - Support to Manager & Teamwork: 10 points

  - **Senior (7 categories, 100 points total)**:
    - Stock Ownership & Audit Accuracy: 15 points
    - Purchase Planning & Stock Availability: 25 points
    - Expiry & Dead Stock Control: 10 points
    - Sales Support & Conversion: 15 points
    - Cash Handling & Banking Accuracy: 15 points
    - Store Operations & Staff Discipline: 10 points
    - Compliance & Reporting: 10 points

  - **Part-time Pharmacist (4 categories, 100 points total)**:
    - Stock Audit Accuracy & Loss Reduction: 35 points
    - Expiry Control & Shelf Discipline: 20 points
    - Sales Support & Ethical Conversion: 25 points
    - Professional Conduct & Reliability: 20 points

### 2. Employee Configuration Tables

#### employee_salary_structure
- **Purpose**: Store employee-specific salary structures
- **Key Features**:
  - Supports all payment models (MONTHLY_FIXED, RETAINER_PLUS_PERDAY, HOURLY, PROJECT_BASED)
  - JSON-based salary components for flexibility
  - JSON-based KPI payout bands
  - Statutory configuration per employee
  - Effective date tracking for salary changes
  - Bank details for payments

### 3. KPI Tracking Tables

#### monthly_kpi_score
- **Purpose**: Track monthly KPI scores per employee
- **Key Features**:
  - JSON-based category scores
  - Automatic KPI band calculation (90-100, 75-89, 60-74, etc.)
  - Approval workflow (DRAFT → SUBMITTED → APPROVED → LOCKED)
  - Links to payroll calculation

### 4. Payroll Processing Tables

#### payroll_run
- **Purpose**: Master table for monthly payroll cycles
- **Workflow**: DRAFT → CALCULATED → APPROVED → PAYMENT_REQUESTED → PAYMENT_PROCESSING → COMPLETED

#### payroll_detail
- **Purpose**: Individual employee payroll records
- **Key Features**:
  - JSON-based earnings breakdown
  - JSON-based deductions breakdown
  - Employer contributions tracking
  - KPI score and incentive amount
  - Payment status tracking

### 5. Payment Workflow Tables

#### payment_request
- **Purpose**: Payment requests sent to finance team
- **Workflow**: PENDING → APPROVED → PROCESSING → COMPLETED

#### payment_request_item
- **Purpose**: Individual payment items within a request

#### payment_transaction
- **Purpose**: Actual payment transactions with bank/cash details
- **Payment Methods**: BANK_TRANSFER, CASH, CHEQUE, UPI

---

## Execution Instructions

### Option 1: Run Individual Migrations

Execute each migration file in sequence:

```bash
# From project root directory
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/006_employment_type_role_masters.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/007_salary_component_master.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/008_flexible_salary_structure.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/009_payroll_tables.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/010_kpi_enhancements.sql
```

### Option 2: Run Consolidated Migration

Execute all at once using the consolidated file:

```bash
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/006-010_flexible_payroll_system_complete.sql
```

### Verify Installation

After execution, verify the installation:

```sql
-- Check tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'employment_type_master',
    'role_master',
    'salary_component_master',
    'employee_salary_structure',
    'payroll_run',
    'payroll_detail',
    'payment_request',
    'payment_request_item',
    'payment_transaction',
    'kpi_category_master',
    'monthly_kpi_score'
  )
ORDER BY table_name;

-- Check master data
SELECT 'Employment Types' as category, COUNT(*) as count FROM employment_type_master WHERE active = true
UNION ALL
SELECT 'Roles', COUNT(*) FROM role_master WHERE active = true
UNION ALL
SELECT 'Salary Components', COUNT(*) FROM salary_component_master WHERE active = true
UNION ALL
SELECT 'KPI Categories', COUNT(*) FROM kpi_category_master WHERE active = true;
```

Expected results:
- 11 tables created
- 4 employment types
- 4 roles
- 17 salary components
- 16 KPI categories

---

## Sample Data Included

The migrations include sample salary structure records for all 3 employment types. However, **these use NULL user_id values** and must be updated with actual employee user IDs before use.

### Sample 1: Associate Full-time
```sql
-- CTC: ₹12,000 fixed + up to ₹2,000 KPI
-- Components: BASIC (₹7,000), HRA (₹2,500), CONVEYANCE (₹500), FOOD_MEAL (₹1,000), SPECIAL (₹1,000)
-- KPI Bands: 90-100 (₹2,000), 75-89 (₹1,500), 60-74 (₹1,000), 50-59 (₹500), below-50 (₹0)
```

### Sample 2: Senior Full-time
```sql
-- CTC: ₹18,000 fixed + up to ₹1,000 KPI
-- Components: BASIC (₹11,000), DA (₹7,000)
-- KPI Bands: 90-100 (₹1,000), 75-89 (₹750), 60-74 (₹500), 50-59 (₹250), below-50 (₹0)
```

### Sample 3: Part-time Pharmacist
```sql
-- Payment: ₹6,000 retainer (10 days) + ₹800/extra day + up to ₹1,000 KPI
-- No PF/ESI/PT (professional engagement)
-- KPI Bands: 90-100 (₹1,000), 75-89 (₹750), 60-74 (₹500), below-60 (₹0)
```

---

## Next Steps After Migration

### 1. Configure Employee Salary Structures

Replace sample records with actual employee data:

```sql
-- Example: Add salary structure for a real Associate employee
INSERT INTO employee_salary_structure
    (user_id, employment_type_code, role_code, payment_model,
     monthly_fixed_ctc, salary_components, kpi_eligible, max_kpi_incentive, kpi_payout_bands,
     pf_applicable, pt_applicable, tds_applicable, effective_from, created_by, updated_by)
VALUES (
    123, -- Replace with actual user_id
    'FULLTIME', 'ASSOCIATE', 'MONTHLY_FIXED', 12000,
    '{"BASIC": 7000, "HRA": 2500, "CONVEYANCE": 500, "FOOD_MEAL": 1000, "SPECIAL": 1000}'::jsonb,
    true, 2000, '{"90-100": 2000, "75-89": 1500, "60-74": 1000, "50-59": 500, "below-50": 0}'::jsonb,
    true, true, true, '2026-01-01', 1, 1
);
```

### 2. Start KPI Score Entry

Managers should begin entering monthly KPI scores:

```sql
-- Example: Enter January 2026 KPI scores for an employee
INSERT INTO monthly_kpi_score
    (user_id, year, month, employment_type_code, role_code,
     category_scores, total_score, status, evaluated_by, evaluated_on, created_by, updated_by)
VALUES (
    123,
    2026,
    1,
    'FULLTIME',
    'ASSOCIATE',
    '{
        "ATTENDANCE_PUNCTUALITY": 22,
        "BILLING_CASH": 20,
        "STOCK_EXPIRY": 18,
        "CUSTOMER_SERVICE": 17,
        "TEAMWORK": 8
    }'::jsonb,
    85.0,
    'APPROVED',
    1, -- Manager user_id
    CURRENT_TIMESTAMP,
    1, 1
);
```

### 3. Run First Payroll

Once salary structures and KPI scores are in place:

1. Create a payroll run for the month
2. Calculate payroll for all employees
3. Review and approve
4. Generate payment requests
5. Process payments
6. Record transactions

### 4. Build Backend Services (Next Phase)

Refer to `docs/FLEXIBLE_PAYROLL_SYSTEM_DESIGN.md` for the complete TypeScript service implementation including:
- `FlexiblePayrollCalculationService`
- Payment model calculators (monthly fixed, retainer+per-day, hourly)
- KPI incentive calculator
- Deductions calculator (employment-type-aware)
- Employer contributions calculator

### 5. Build Frontend Components (Future Phase)

Required UI components:
- Salary structure management
- KPI score entry form
- Payroll calculation dashboard
- Payment request workflow
- Payslip generation
- Reports and analytics

---

## Key Design Features

### 1. Flexibility
- Supports unlimited employment types and roles
- Add new salary components without code changes
- JSON-based storage for component flexibility

### 2. Accuracy
- Employment-type-specific statutory rules
- Automatic KPI band calculation
- Transparent calculation metadata storage

### 3. Compliance
- PF: 12% employee + 12% employer (full-time only)
- ESI: 0.75% employee + 3.25% employer (if applicable)
- PT: State-specific (₹200/month in Tamil Nadu)
- TDS: Conditional based on annual income

### 4. Auditability
- Complete calculation metadata stored
- Multi-level approval workflow
- Payment tracking with bank/cash details
- Audit fields on all tables

### 5. Performance
- JSON-based flexible storage
- Indexed for common queries
- Partitioning ready (attendance already partitioned)

---

## Related Documentation

- **Design Document**: `docs/FLEXIBLE_PAYROLL_SYSTEM_DESIGN.md` (comprehensive design with TypeScript services)
- **Initial Design**: `docs/PAYROLL_FINANCE_MODULE_DESIGN.md` (first iteration)
- **Corrections**: `docs/PAYROLL_DESIGN_CORRECTIONS.md` (verification against actual pay structures)
- **Pay Structure PDFs**: Source documents for salary structures and KPI categories

---

## Migration Status

| Migration | Status | Tables | Records | Verification |
|-----------|--------|--------|---------|-------------|
| 006 | ✅ Ready | 2 | 8 | ✅ Passed |
| 007 | ✅ Ready | 1 | 17 | ✅ Passed |
| 008 | ✅ Ready | 1 | 3 (samples) | ✅ Passed |
| 009 | ✅ Ready | 5 | 0 | ✅ Passed |
| 010 | ✅ Ready | 2 | 16 | ✅ Passed |

**Total**: 11 tables, 44 master records, 2 sequences, 1 function

---

## Support and Questions

For questions or issues:
1. Review design documentation in `docs/`
2. Check sample SQL in migration files
3. Verify against actual pay structure PDFs
4. Test with sample data before production use

---

**Last Updated**: 2026-01-10
**Author**: Development Team
**Status**: Ready for Database Execution
