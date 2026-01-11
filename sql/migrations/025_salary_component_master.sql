-- Migration 007: Salary Component Master Table
-- Date: 2026-01-10
-- Purpose: Create flexible salary component master for configuration-driven payroll
-- Description: Defines all salary components (earnings, deductions, reimbursements) with
--              calculation methods, applicability rules, and statutory flags

-- ==========================================
-- 1. SALARY COMPONENT MASTER TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.salary_component_master (
    id SERIAL4 PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Component Classification
    component_type VARCHAR(20) NOT NULL, -- EARNING, DEDUCTION, REIMBURSEMENT
    component_category VARCHAR(50), -- FIXED, VARIABLE, STATUTORY, ALLOWANCE, BENEFIT

    -- Calculation Method
    calculation_method VARCHAR(20) NOT NULL,
    -- FIXED_AMOUNT: Fixed amount per month
    -- PERCENTAGE_OF_BASIC: Calculated as percentage of basic salary
    -- PERCENTAGE_OF_GROSS: Calculated as percentage of gross salary
    -- ATTENDANCE_BASED: Based on attendance/working days
    -- DAYS_WORKED: Based on actual days worked
    -- HOURS_WORKED: Based on hours worked
    -- FORMULA: Custom formula
    -- MANUAL: Manually entered each month

    -- Calculation Parameters (for percentage-based)
    base_component_code VARCHAR(50), -- e.g., 'BASIC' for HRA calculation
    percentage DECIMAL(5,2), -- e.g., 40 for 40% of basic

    -- Calculation Parameters (for formula-based)
    formula TEXT, -- e.g., '(BASIC + DA) * 0.40'

    -- Statutory Flags
    is_statutory BOOL DEFAULT false,
    is_taxable BOOL DEFAULT true,
    affects_pf BOOL DEFAULT false, -- Should this component be included in PF calculation base?
    affects_esi BOOL DEFAULT false, -- Should this component be included in ESI calculation base?

    -- Applicability Rules
    applicable_employment_types VARCHAR[] DEFAULT ARRAY['FULLTIME', 'PARTTIME', 'CONTRACTUAL', 'HOURLY'],
    applicable_roles VARCHAR[], -- NULL means applicable to all roles

    -- Display Configuration
    display_order INT DEFAULT 0,
    display_in_payslip BOOL DEFAULT true,

    -- Audit Fields
    active BOOL DEFAULT true NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Constraints
    CONSTRAINT salary_component_type_check CHECK (
        component_type IN ('EARNING', 'DEDUCTION', 'REIMBURSEMENT')
    ),
    CONSTRAINT salary_component_method_check CHECK (
        calculation_method IN ('FIXED_AMOUNT', 'PERCENTAGE_OF_BASIC', 'PERCENTAGE_OF_GROSS',
                               'ATTENDANCE_BASED', 'DAYS_WORKED', 'HOURS_WORKED', 'FORMULA', 'MANUAL')
    )
);

-- Table Comment
COMMENT ON TABLE public.salary_component_master IS 'Master table for all salary components with calculation logic and applicability rules';

-- Column Comments
COMMENT ON COLUMN public.salary_component_master.component_type IS 'EARNING, DEDUCTION, or REIMBURSEMENT';
COMMENT ON COLUMN public.salary_component_master.calculation_method IS 'Method to calculate this component: FIXED_AMOUNT, PERCENTAGE_OF_BASIC, PERCENTAGE_OF_GROSS, ATTENDANCE_BASED, DAYS_WORKED, HOURS_WORKED, FORMULA, MANUAL';
COMMENT ON COLUMN public.salary_component_master.affects_pf IS 'Whether this component is included in PF calculation base (typically only Basic)';
COMMENT ON COLUMN public.salary_component_master.affects_esi IS 'Whether this component is included in ESI calculation base (typically Gross)';
COMMENT ON COLUMN public.salary_component_master.applicable_employment_types IS 'Array of employment type codes where this component applies';
COMMENT ON COLUMN public.salary_component_master.applicable_roles IS 'Array of role codes where this component applies (NULL = all roles)';

-- ==========================================
-- 2. INSERT STANDARD COMPONENTS
-- ==========================================

-- EARNINGS - Common Components
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     affects_pf, is_taxable, applicable_employment_types, display_order)
VALUES
    (
        'BASIC',
        'Basic Salary',
        'Basic salary component forming the foundation for statutory deductions',
        'EARNING',
        'FIXED',
        'FIXED_AMOUNT',
        true,  -- Affects PF calculation
        true,  -- Taxable
        ARRAY['FULLTIME', 'PARTTIME'],
        1
    );

-- EARNINGS - Full-time Associate Components
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     affects_pf, is_taxable, applicable_employment_types, applicable_roles, display_order)
VALUES
    (
        'HRA',
        'House Rent Allowance',
        'House rent allowance for full-time employees (Associate level)',
        'EARNING',
        'ALLOWANCE',
        'FIXED_AMOUNT',
        false,
        true,
        ARRAY['FULLTIME'],
        ARRAY['ASSOCIATE'],
        2
    ),
    (
        'CONVEYANCE',
        'Conveyance Allowance',
        'Transportation/commute allowance for full-time employees',
        'EARNING',
        'ALLOWANCE',
        'FIXED_AMOUNT',
        false,
        true,
        ARRAY['FULLTIME'],
        ARRAY['ASSOCIATE'],
        3
    ),
    (
        'FOOD_MEAL',
        'Food/Meal Allowance',
        'Meal allowance for full-time employees',
        'EARNING',
        'ALLOWANCE',
        'FIXED_AMOUNT',
        false,
        true,
        ARRAY['FULLTIME'],
        ARRAY['ASSOCIATE'],
        4
    ),
    (
        'SPECIAL',
        'Special Allowance',
        'Special allowance component for full-time employees',
        'EARNING',
        'ALLOWANCE',
        'FIXED_AMOUNT',
        false,
        true,
        ARRAY['FULLTIME'],
        ARRAY['ASSOCIATE'],
        5
    );

-- EARNINGS - Full-time Senior Components
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     affects_pf, is_taxable, applicable_employment_types, applicable_roles, display_order)
VALUES
    (
        'DA',
        'Dearness Allowance',
        'Dearness allowance for senior employees (TN Minimum Wage compliant)',
        'EARNING',
        'ALLOWANCE',
        'FIXED_AMOUNT',
        false,
        true,
        ARRAY['FULLTIME'],
        ARRAY['SENIOR', 'MANAGER'],
        2
    );

-- EARNINGS - Part-time Components
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     affects_pf, is_taxable, applicable_employment_types, applicable_roles, display_order)
VALUES
    (
        'RETAINER',
        'Professional Retainer',
        'Monthly base retainer for part-time professional engagement',
        'EARNING',
        'FIXED',
        'FIXED_AMOUNT',
        false,
        true,
        ARRAY['PARTTIME'],
        ARRAY['PARTTIME_PHARMACIST'],
        1
    ),
    (
        'EXTRA_DAYS',
        'Additional Days Payment',
        'Payment for days worked beyond retainer coverage',
        'EARNING',
        'VARIABLE',
        'DAYS_WORKED',
        false,
        true,
        ARRAY['PARTTIME'],
        ARRAY['PARTTIME_PHARMACIST'],
        2
    );

-- EARNINGS - Variable (All Types)
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     affects_pf, is_taxable, applicable_employment_types, display_order)
VALUES
    (
        'KPI_INCENTIVE',
        'KPI Performance Incentive',
        'Performance-based incentive calculated from KPI scores',
        'EARNING',
        'VARIABLE',
        'MANUAL',
        false,
        true,
        ARRAY['FULLTIME', 'PARTTIME'],
        10
    );

-- DEDUCTIONS - Statutory (Full-time only)
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     base_component_code, percentage, is_statutory, affects_pf, is_taxable,
     applicable_employment_types, display_order)
VALUES
    (
        'PF_EMPLOYEE',
        'Provident Fund (Employee)',
        'Employee contribution to Provident Fund (12% of basic)',
        'DEDUCTION',
        'STATUTORY',
        'PERCENTAGE_OF_BASIC',
        'BASIC',
        12.00,
        true,
        false,
        false,
        ARRAY['FULLTIME'],
        1
    ),
    (
        'PF_EMPLOYER',
        'Provident Fund (Employer)',
        'Employer contribution to Provident Fund (12% of basic) - not deducted from salary',
        'DEDUCTION',
        'STATUTORY',
        'PERCENTAGE_OF_BASIC',
        'BASIC',
        12.00,
        true,
        false,
        false,
        ARRAY['FULLTIME'],
        2
    ),
    (
        'ESI_EMPLOYEE',
        'ESI (Employee)',
        'Employee State Insurance contribution (0.75% of gross, if gross < ₹21,000)',
        'DEDUCTION',
        'STATUTORY',
        'PERCENTAGE_OF_GROSS',
        NULL,
        0.75,
        true,
        false,
        false,
        ARRAY['FULLTIME'],
        3
    ),
    (
        'ESI_EMPLOYER',
        'ESI (Employer)',
        'Employer ESI contribution (3.25% of gross) - not deducted from salary',
        'DEDUCTION',
        'STATUTORY',
        'PERCENTAGE_OF_GROSS',
        NULL,
        3.25,
        true,
        false,
        false,
        ARRAY['FULLTIME'],
        4
    ),
    (
        'PT',
        'Professional Tax',
        'State Professional Tax (₹200/month if gross > ₹10,000 in Tamil Nadu)',
        'DEDUCTION',
        'STATUTORY',
        'MANUAL',
        NULL,
        NULL,
        true,
        false,
        false,
        ARRAY['FULLTIME'],
        5
    );

-- DEDUCTIONS - TDS (Full-time and Part-time)
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     is_statutory, is_taxable, applicable_employment_types, display_order)
VALUES
    (
        'TDS',
        'Income Tax (TDS)',
        'Tax Deducted at Source based on annual income and tax slabs',
        'DEDUCTION',
        'STATUTORY',
        'MANUAL',
        true,
        false,
        ARRAY['FULLTIME', 'PARTTIME', 'CONTRACTUAL'],
        6
    );

-- DEDUCTIONS - Other (Attendance-based)
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     is_statutory, is_taxable, applicable_employment_types, display_order)
VALUES
    (
        'LWP',
        'Leave Without Pay',
        'Deduction for leave without pay days (full-time only)',
        'DEDUCTION',
        'ATTENDANCE',
        'ATTENDANCE_BASED',
        false,
        false,
        ARRAY['FULLTIME'],
        7
    );

-- DEDUCTIONS - Other (Manual)
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     is_statutory, is_taxable, applicable_employment_types, display_order)
VALUES
    (
        'ADVANCE',
        'Advance Deduction',
        'Recovery of salary advance taken by employee',
        'DEDUCTION',
        'OTHER',
        'MANUAL',
        false,
        false,
        ARRAY['FULLTIME', 'PARTTIME'],
        8
    ),
    (
        'LOAN',
        'Loan Repayment',
        'Monthly installment for loan repayment',
        'DEDUCTION',
        'OTHER',
        'MANUAL',
        false,
        false,
        ARRAY['FULLTIME', 'PARTTIME'],
        9
    ),
    (
        'FINE',
        'Fines/Penalties',
        'Deduction for fines or penalties',
        'DEDUCTION',
        'OTHER',
        'MANUAL',
        false,
        false,
        ARRAY['FULLTIME', 'PARTTIME'],
        10
    );

-- REIMBURSEMENTS
INSERT INTO public.salary_component_master
    (code, name, description, component_type, component_category, calculation_method,
     is_statutory, is_taxable, applicable_employment_types, display_order)
VALUES
    (
        'INSURANCE_REIMB',
        'Insurance Premium Reimbursement',
        'Reimbursement for health insurance premium (₹1,000/year limit for full-time)',
        'REIMBURSEMENT',
        'BENEFIT',
        'MANUAL',
        false,
        false,
        ARRAY['FULLTIME'],
        1
    );

-- Create Indexes
CREATE INDEX idx_salary_component_type ON public.salary_component_master(component_type) WHERE active = true;
CREATE INDEX idx_salary_component_employment_type ON public.salary_component_master USING GIN(applicable_employment_types) WHERE active = true;
CREATE INDEX idx_salary_component_statutory ON public.salary_component_master(is_statutory) WHERE active = true AND is_statutory = true;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Verify earnings components
SELECT
    code,
    name,
    component_category,
    calculation_method,
    applicable_employment_types,
    applicable_roles,
    affects_pf,
    is_taxable
FROM public.salary_component_master
WHERE component_type = 'EARNING' AND active = true
ORDER BY display_order;

-- Verify deductions
SELECT
    code,
    name,
    component_category,
    calculation_method,
    is_statutory,
    applicable_employment_types,
    percentage
FROM public.salary_component_master
WHERE component_type = 'DEDUCTION' AND active = true
ORDER BY display_order;

-- Summary by type
SELECT
    component_type,
    component_category,
    COUNT(*) as component_count
FROM public.salary_component_master
WHERE active = true
GROUP BY component_type, component_category
ORDER BY component_type, component_category;

-- Employment type applicability matrix
SELECT
    code,
    name,
    CASE WHEN 'FULLTIME' = ANY(applicable_employment_types) THEN 'Yes' ELSE '-' END as fulltime,
    CASE WHEN 'PARTTIME' = ANY(applicable_employment_types) THEN 'Yes' ELSE '-' END as parttime,
    CASE WHEN 'CONTRACTUAL' = ANY(applicable_employment_types) THEN 'Yes' ELSE '-' END as contractual,
    CASE WHEN 'HOURLY' = ANY(applicable_employment_types) THEN 'Yes' ELSE '-' END as hourly
FROM public.salary_component_master
WHERE active = true
ORDER BY component_type, display_order;
