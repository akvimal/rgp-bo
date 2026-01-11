-- Migration 006: Employment Type and Role Master Tables
-- Date: 2026-01-10
-- Purpose: Create flexible employment type and role master tables for payroll system
-- Description: Supports multiple employment types (FULLTIME, PARTTIME, CONTRACTUAL, HOURLY)
--              with configurable statutory applicability and payment models

-- ==========================================
-- 1. EMPLOYMENT TYPE MASTER
-- ==========================================

CREATE TABLE IF NOT EXISTS public.employment_type_master (
    id SERIAL4 PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Payment Model Configuration
    payment_model VARCHAR(20) NOT NULL,
    -- MONTHLY_FIXED: Fixed monthly salary (full-time)
    -- RETAINER_PLUS_PERDAY: Base retainer + additional day rate (part-time)
    -- HOURLY: Hourly rate (hourly workers)
    -- PROJECT_BASED: Project-based payment (contractors)
    -- DAILY_WAGE: Daily wage workers

    -- Statutory Applicability Flags
    pf_applicable BOOL DEFAULT false,
    esi_applicable BOOL DEFAULT false,
    pt_applicable BOOL DEFAULT false,
    tds_applicable BOOL DEFAULT false,
    gratuity_applicable BOOL DEFAULT false,
    leave_entitled BOOL DEFAULT false,
    bonus_entitled BOOL DEFAULT false,

    -- Default Configurations
    default_working_days_per_month INT DEFAULT 26,
    notice_period_days INT DEFAULT 30,

    -- Audit Fields
    active BOOL DEFAULT true NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Constraints
    CONSTRAINT employment_type_payment_model_check CHECK (
        payment_model IN ('MONTHLY_FIXED', 'RETAINER_PLUS_PERDAY', 'HOURLY', 'PROJECT_BASED', 'DAILY_WAGE')
    )
);

-- Table Comment
COMMENT ON TABLE public.employment_type_master IS 'Employment type configurations with statutory applicability and payment model definitions';

-- Column Comments
COMMENT ON COLUMN public.employment_type_master.payment_model IS 'Payment calculation model: MONTHLY_FIXED, RETAINER_PLUS_PERDAY, HOURLY, PROJECT_BASED, DAILY_WAGE';
COMMENT ON COLUMN public.employment_type_master.pf_applicable IS 'Is Provident Fund applicable for this employment type?';
COMMENT ON COLUMN public.employment_type_master.esi_applicable IS 'Is Employee State Insurance applicable?';
COMMENT ON COLUMN public.employment_type_master.pt_applicable IS 'Is Professional Tax applicable?';
COMMENT ON COLUMN public.employment_type_master.tds_applicable IS 'Is Tax Deducted at Source applicable?';
COMMENT ON COLUMN public.employment_type_master.gratuity_applicable IS 'Is gratuity benefit applicable?';
COMMENT ON COLUMN public.employment_type_master.leave_entitled IS 'Is employee entitled to paid leave?';
COMMENT ON COLUMN public.employment_type_master.bonus_entitled IS 'Is employee entitled to bonus?';

-- Insert Standard Employment Types
INSERT INTO public.employment_type_master
    (code, name, description, payment_model, pf_applicable, esi_applicable, pt_applicable, tds_applicable,
     gratuity_applicable, leave_entitled, bonus_entitled, default_working_days_per_month, notice_period_days)
VALUES
    (
        'FULLTIME',
        'Full-Time Employee',
        'Regular full-time employees with fixed monthly salary and all statutory benefits',
        'MONTHLY_FIXED',
        true,  -- PF applicable
        true,  -- ESI applicable (conditional on salary threshold)
        true,  -- PT applicable
        true,  -- TDS applicable
        true,  -- Gratuity applicable
        true,  -- Leave entitled
        true,  -- Bonus entitled
        26,    -- Default working days
        30     -- Notice period in days
    ),
    (
        'PARTTIME',
        'Part-Time/Consultant',
        'Part-time professional engagement with retainer plus per-day payment model. No statutory benefits except TDS.',
        'RETAINER_PLUS_PERDAY',
        false, -- NO PF (professional engagement, not employment)
        false, -- NO ESI
        false, -- NO PT
        true,  -- TDS applicable (if income exceeds threshold)
        false, -- NO Gratuity
        false, -- NO leave entitlement
        false, -- NO bonus
        10,    -- Typical days covered by retainer
        7      -- Short notice period
    ),
    (
        'CONTRACTUAL',
        'Contractual Employee',
        'Fixed-term contract employees with project-based or fixed monthly payment',
        'PROJECT_BASED',
        false, -- Conditional
        false, -- Conditional
        false, -- Conditional
        true,  -- TDS applicable
        false, -- Generally not applicable
        false, -- Contract-specific
        false, -- Contract-specific
        26,
        15
    ),
    (
        'HOURLY',
        'Hourly Worker',
        'Hourly wage workers paid based on actual hours worked',
        'HOURLY',
        false, -- Generally not applicable
        false, -- Generally not applicable
        false, -- Generally not applicable
        false, -- Conditional
        false, -- Not applicable
        false, -- Not entitled
        false, -- Not entitled
        26,
        0      -- No notice period
    );

-- ==========================================
-- 2. ROLE MASTER (Salary Levels/Designations)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.role_master (
    id SERIAL4 PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    employment_type_code VARCHAR(20) NOT NULL,

    -- Hierarchy
    level INT DEFAULT 0,
    parent_role_id INT4,

    -- Audit Fields
    active BOOL DEFAULT true NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Foreign Keys
    CONSTRAINT role_employment_type_fk FOREIGN KEY (employment_type_code)
        REFERENCES public.employment_type_master(code),
    CONSTRAINT role_parent_fk FOREIGN KEY (parent_role_id)
        REFERENCES public.role_master(id)
);

-- Table Comment
COMMENT ON TABLE public.role_master IS 'Role/designation master with employment type linkage and hierarchy';

-- Column Comments
COMMENT ON COLUMN public.role_master.level IS 'Hierarchy level (1=junior, 2=senior, 3=manager, etc.)';
COMMENT ON COLUMN public.role_master.parent_role_id IS 'Parent role for hierarchical structure (e.g., SENIOR reports to MANAGER)';

-- Insert Standard Roles Based on Actual Pay Structures
INSERT INTO public.role_master (code, name, description, employment_type_code, level) VALUES
    (
        'ASSOCIATE',
        'Pharmacy Aide – Associate',
        'Entry-level pharmacy assistant handling billing, stock support, and customer service',
        'FULLTIME',
        1
    ),
    (
        'SENIOR',
        'Pharmacy Aide – Senior / Store Head',
        'Senior pharmacy assistant with stock ownership, purchase planning, and operational responsibilities',
        'FULLTIME',
        2
    ),
    (
        'PARTTIME_PHARMACIST',
        'Pharmacist – Part-Time (Weekend/Holiday)',
        'Licensed pharmacist engaged on part-time basis for weekend/holiday coverage with professional responsibilities',
        'PARTTIME',
        2
    ),
    (
        'MANAGER',
        'Store Manager',
        'Store manager overseeing all operations, staff, and business performance',
        'FULLTIME',
        3
    );

-- Create Indexes
CREATE INDEX idx_role_master_employment_type ON public.role_master(employment_type_code) WHERE active = true;
CREATE INDEX idx_role_master_level ON public.role_master(level) WHERE active = true;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Verify employment types
SELECT
    code,
    name,
    payment_model,
    pf_applicable,
    esi_applicable,
    pt_applicable,
    tds_applicable,
    leave_entitled,
    notice_period_days
FROM public.employment_type_master
ORDER BY
    CASE code
        WHEN 'FULLTIME' THEN 1
        WHEN 'PARTTIME' THEN 2
        WHEN 'CONTRACTUAL' THEN 3
        WHEN 'HOURLY' THEN 4
    END;

-- Verify roles
SELECT
    r.code,
    r.name,
    r.employment_type_code,
    e.payment_model,
    r.level
FROM public.role_master r
JOIN public.employment_type_master e ON r.employment_type_code = e.code
ORDER BY r.level, r.code;

-- Summary
SELECT
    'Employment Types Created' as summary_item,
    COUNT(*) as count
FROM public.employment_type_master
UNION ALL
SELECT
    'Roles Created',
    COUNT(*)
FROM public.role_master;
