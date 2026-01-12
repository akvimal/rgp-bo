-- Migration 008: Employee Salary Structure Table
-- Date: 2026-01-10
-- Purpose: Create flexible employee salary structure table
-- Description: Stores employee-specific salary configurations with support for multiple
--              employment types, payment models, and JSON-based component flexibility

-- ==========================================
-- 1. EMPLOYEE SALARY STRUCTURE TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.employee_salary_structure (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL,

    -- Employment Configuration
    employment_type_code VARCHAR(20) NOT NULL,
    role_code VARCHAR(20) NOT NULL,

    -- Payment Model Configuration
    payment_model VARCHAR(20) NOT NULL,

    -- For MONTHLY_FIXED (Full-time employees)
    monthly_fixed_ctc DECIMAL(10,2) DEFAULT 0,

    -- For RETAINER_PLUS_PERDAY (Part-time)
    monthly_retainer DECIMAL(10,2) DEFAULT 0,
    included_days INT DEFAULT 0, -- Days covered by retainer
    per_day_rate DECIMAL(10,2) DEFAULT 0,

    -- For HOURLY (Future use)
    hourly_rate DECIMAL(10,2) DEFAULT 0,

    -- For PROJECT_BASED (Future use)
    project_rate DECIMAL(10,2) DEFAULT 0,

    -- Component-wise Breakdown (JSON for flexibility)
    salary_components JSONB NOT NULL DEFAULT '{}',
    -- Example for Associate:
    -- {
    --   "BASIC": 7000,
    --   "HRA": 2500,
    --   "CONVEYANCE": 500,
    --   "FOOD_MEAL": 1000,
    --   "SPECIAL": 1000
    -- }
    -- Example for Part-time:
    -- {
    --   "RETAINER": 6000,
    --   "EXTRA_DAYS_RATE": 800
    -- }

    -- KPI Configuration
    kpi_eligible BOOL DEFAULT true,
    max_kpi_incentive DECIMAL(10,2) DEFAULT 0,
    kpi_payout_bands JSONB DEFAULT '{
        "90-100": 0,
        "75-89": 0,
        "60-74": 0,
        "50-59": 0,
        "below-50": 0
    }',

    -- Statutory Configuration (can override employment type defaults)
    pf_applicable BOOL,
    pf_number VARCHAR(30),
    esi_applicable BOOL,
    esi_number VARCHAR(30),
    pt_applicable BOOL,
    tds_applicable BOOL,
    pan_number VARCHAR(20),

    -- Statutory Percentages (if custom, otherwise use defaults)
    pf_employee_percentage DECIMAL(5,2) DEFAULT 12,
    pf_employer_percentage DECIMAL(5,2) DEFAULT 12,
    esi_employee_percentage DECIMAL(5,2) DEFAULT 0.75,
    esi_employer_percentage DECIMAL(5,2) DEFAULT 3.25,

    -- Benefits
    insurance_reimbursement_eligible BOOL DEFAULT false,
    annual_insurance_limit DECIMAL(10,2) DEFAULT 1000,

    -- Bank Details
    bank_name VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(15),
    account_holder_name VARCHAR(100),

    -- Effective Dates
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Audit Fields
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    -- Constraints
    CONSTRAINT ess_user_fk FOREIGN KEY (user_id) REFERENCES public.app_user(id),
    CONSTRAINT ess_employment_type_fk FOREIGN KEY (employment_type_code)
        REFERENCES public.employment_type_master(code),
    CONSTRAINT ess_role_fk FOREIGN KEY (role_code) REFERENCES public.role_master(code),
    CONSTRAINT ess_created_by_fk FOREIGN KEY (created_by) REFERENCES public.app_user(id),
    CONSTRAINT ess_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.app_user(id),
    CONSTRAINT ess_payment_model_check CHECK (
        payment_model IN ('MONTHLY_FIXED', 'RETAINER_PLUS_PERDAY', 'HOURLY', 'PROJECT_BASED', 'DAILY_WAGE')
    )
);

-- Table Comment
COMMENT ON TABLE public.employee_salary_structure IS 'Flexible employee salary structure supporting multiple employment types and payment models';

-- Column Comments
COMMENT ON COLUMN public.employee_salary_structure.payment_model IS 'Payment calculation model: MONTHLY_FIXED, RETAINER_PLUS_PERDAY, HOURLY, PROJECT_BASED, DAILY_WAGE';
COMMENT ON COLUMN public.employee_salary_structure.monthly_fixed_ctc IS 'Total fixed monthly CTC for MONTHLY_FIXED payment model';
COMMENT ON COLUMN public.employee_salary_structure.monthly_retainer IS 'Base monthly retainer for RETAINER_PLUS_PERDAY model';
COMMENT ON COLUMN public.employee_salary_structure.included_days IS 'Number of days covered by retainer (typically 10 for part-time)';
COMMENT ON COLUMN public.employee_salary_structure.per_day_rate IS 'Rate per additional day beyond retainer coverage';
COMMENT ON COLUMN public.employee_salary_structure.salary_components IS 'JSON object with component codes as keys and amounts as values';
COMMENT ON COLUMN public.employee_salary_structure.kpi_payout_bands IS 'JSON object defining KPI score ranges and corresponding payout amounts';
COMMENT ON COLUMN public.employee_salary_structure.effective_from IS 'Date from which this salary structure is effective';
COMMENT ON COLUMN public.employee_salary_structure.effective_to IS 'Date until which this structure is effective (NULL = current)';

-- Create Indexes
CREATE UNIQUE INDEX idx_ess_user_active_un ON public.employee_salary_structure(user_id) WHERE active = true;
CREATE INDEX idx_ess_role ON public.employee_salary_structure(role_code) WHERE active = true;
CREATE INDEX idx_ess_employment_type ON public.employee_salary_structure(employment_type_code) WHERE active = true;
CREATE INDEX idx_ess_effective_dates ON public.employee_salary_structure(effective_from, effective_to) WHERE active = true;

-- ==========================================
-- 2. INSERT SAMPLE DATA (Based on Actual Pay Structures)
-- ==========================================

-- NOTE: These are sample records. In production, these would be created through the UI
-- Replace user_id values with actual user IDs from your app_user table

-- Sample 1: Associate Full-time (₹12,000 + up to ₹2,000 KPI)
-- INSERT INTO public.employee_salary_structure -- COMMENTED OUT: Sample data with NULL user_id
--     (user_id, employment_type_code, role_code, payment_model,
--      monthly_fixed_ctc, salary_components,
--      kpi_eligible, max_kpi_incentive, kpi_payout_bands,
--      pf_applicable, pf_number, esi_applicable, pt_applicable, tds_applicable,
--      insurance_reimbursement_eligible, annual_insurance_limit,
--      effective_from, created_by, updated_by)
-- VALUES (
--     -- user_id: Replace with actual Associate employee user ID
--     -- For demo, using a placeholder. This should be updated with real user IDs
--     NULL, -- REPLACE WITH ACTUAL USER_ID
--     'FULLTIME',
--     'ASSOCIATE',
--     'MONTHLY_FIXED',
--     12000,
--     '{
--         "BASIC": 7000,
--         "HRA": 2500,
--         "CONVEYANCE": 500,
--         "FOOD_MEAL": 1000,
--         "SPECIAL": 1000
--     }'::jsonb,
--     true,
--     2000,
--     '{
--         "90-100": 2000,
--         "75-89": 1500,
--         "60-74": 1000,
--         "50-59": 500,
--         "below-50": 0
--     }'::jsonb,
--     true,  -- PF applicable
--     NULL,  -- PF number to be added
--     false, -- ESI not applicable (CTC > ₹21,000)
--     true,  -- PT applicable
--     true,  -- TDS applicable
--     true,  -- Insurance reimbursement eligible
--     1000,  -- Annual limit ₹1,000
--     '2026-01-01',
--     1, 1
-- )
-- ON CONFLICT DO NOTHING; -- Skip if user_id is NULL

-- Sample 2: Senior Full-time (₹18,000 + up to ₹1,000 KPI)
-- INSERT INTO public.employee_salary_structure -- COMMENTED OUT: Sample data with NULL user_id
--     (user_id, employment_type_code, role_code, payment_model,
--      monthly_fixed_ctc, salary_components,
--      kpi_eligible, max_kpi_incentive, kpi_payout_bands,
--      pf_applicable, pf_number, esi_applicable, pt_applicable, tds_applicable,
--      insurance_reimbursement_eligible, annual_insurance_limit,
--      effective_from, created_by, updated_by)
-- VALUES (
--     -- user_id: Replace with actual Senior employee user ID
--     NULL, -- REPLACE WITH ACTUAL USER_ID
--     'FULLTIME',
--     'SENIOR',
--     'MONTHLY_FIXED',
--     18000,
--     '{
--         "BASIC": 11000,
--         "DA": 7000
--     }'::jsonb,
--     true,
--     1000,
--     '{
--         "90-100": 1000,
--         "75-89": 750,
--         "60-74": 500,
--         "50-59": 250,
--         "below-50": 0
--     }'::jsonb,
--     true,  -- PF applicable
--     NULL,  -- PF number to be added
--     false, -- ESI not applicable (CTC > ₹21,000)
--     true,  -- PT applicable
--     true,  -- TDS applicable
--     true,  -- Insurance reimbursement eligible
--     1000,  -- Annual limit ₹1,000
--     '2026-01-01',
--     1, 1
-- )
-- ON CONFLICT DO NOTHING;

-- Sample 3: Part-time Pharmacist (₹6,000 retainer + ₹800/day + up to ₹1,000 KPI)
-- INSERT INTO public.employee_salary_structure -- COMMENTED OUT: Sample data with NULL user_id
--     (user_id, employment_type_code, role_code, payment_model,
--      monthly_retainer, included_days, per_day_rate,
--      salary_components,
--      kpi_eligible, max_kpi_incentive, kpi_payout_bands,
--      pf_applicable, esi_applicable, pt_applicable, tds_applicable,
--      insurance_reimbursement_eligible,
--      effective_from, created_by, updated_by)
-- VALUES (
--     -- user_id: Replace with actual Part-time Pharmacist user ID
--     NULL, -- REPLACE WITH ACTUAL USER_ID
--     'PARTTIME',
--     'PARTTIME_PHARMACIST',
--     'RETAINER_PLUS_PERDAY',
--     6000,
--     10,   -- Retainer covers 10 days
--     800,  -- ₹800 per additional day
--     '{
--         "RETAINER": 6000,
--         "EXTRA_DAYS_RATE": 800
--     }'::jsonb,
--     true,
--     1000,
--     '{
--         "90-100": 1000,
--         "75-89": 750,
--         "60-74": 500,
--         "below-60": 0
--     }'::jsonb,
--     false, -- NO PF for part-time (professional engagement)
--     false, -- NO ESI
--     false, -- NO PT
--     true,  -- TDS if applicable
--     false, -- No insurance reimbursement for part-time
--     '2026-01-01',
--     1, 1
-- )
-- ON CONFLICT DO NOTHING;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Verify all salary structures
SELECT
    ess.id,
    u.full_name,
    ess.employment_type_code,
    ess.role_code,
    ess.payment_model,
    ess.monthly_fixed_ctc,
    ess.monthly_retainer,
    ess.per_day_rate,
    ess.max_kpi_incentive,
    ess.pf_applicable,
    ess.esi_applicable,
    ess.pt_applicable,
    ess.effective_from
FROM public.employee_salary_structure ess
LEFT JOIN public.app_user u ON ess.user_id = u.id
WHERE ess.active = true
ORDER BY ess.employment_type_code, ess.role_code;

-- Verify salary components breakdown
SELECT
    ess.id,
    u.full_name,
    ess.role_code,
    jsonb_pretty(ess.salary_components) as components,
    jsonb_pretty(ess.kpi_payout_bands) as kpi_bands
FROM public.employee_salary_structure ess
LEFT JOIN public.app_user u ON ess.user_id = u.id
WHERE ess.active = true;

-- Summary by employment type
SELECT
    employment_type_code,
    role_code,
    payment_model,
    COUNT(*) as employee_count,
    AVG(monthly_fixed_ctc) as avg_fixed_ctc,
    AVG(monthly_retainer) as avg_retainer,
    AVG(max_kpi_incentive) as avg_max_kpi
FROM public.employee_salary_structure
WHERE active = true
GROUP BY employment_type_code, role_code, payment_model
ORDER BY employment_type_code, role_code;

-- ==========================================
-- USAGE NOTES
-- ==========================================

-- To add a real employee salary structure:
--
-- For Associate:
-- INSERT INTO public.employee_salary_structure
--     (user_id, employment_type_code, role_code, payment_model,
--      monthly_fixed_ctc, salary_components, kpi_eligible, max_kpi_incentive, kpi_payout_bands,
--      pf_applicable, pt_applicable, tds_applicable, effective_from, created_by, updated_by)
-- VALUES (
--     123, -- Actual user_id
--     'FULLTIME', 'ASSOCIATE', 'MONTHLY_FIXED', 12000,
--     '{"BASIC": 7000, "HRA": 2500, "CONVEYANCE": 500, "FOOD_MEAL": 1000, "SPECIAL": 1000}'::jsonb,
--     true, 2000, '{"90-100": 2000, "75-89": 1500, "60-74": 1000, "50-59": 500, "below-50": 0}'::jsonb,
--     true, true, true, '2026-01-01', 1, 1
-- );
--
-- For Part-time Pharmacist:
-- INSERT INTO public.employee_salary_structure
--     (user_id, employment_type_code, role_code, payment_model,
--      monthly_retainer, included_days, per_day_rate, salary_components,
--      kpi_eligible, max_kpi_incentive, kpi_payout_bands,
--      pf_applicable, esi_applicable, pt_applicable, tds_applicable,
--      effective_from, created_by, updated_by)
-- VALUES (
--     456, -- Actual user_id
--     'PARTTIME', 'PARTTIME_PHARMACIST', 'RETAINER_PLUS_PERDAY', 6000, 10, 800,
--     '{"RETAINER": 6000, "EXTRA_DAYS_RATE": 800}'::jsonb,
--     true, 1000, '{"90-100": 1000, "75-89": 750, "60-74": 500, "below-60": 0}'::jsonb,
--     false, false, false, true, '2026-01-01', 1, 1
-- );
