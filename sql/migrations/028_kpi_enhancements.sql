-- Migration 010: KPI Enhancements for Payroll
-- Date: 2026-01-10
-- Purpose: Enhance KPI tracking to support role-based categories and payroll integration
-- Description: Creates KPI category master and monthly KPI score tracking tables
--              to support flexible payroll calculation with role-specific KPI structures

-- ==========================================
-- 1. KPI CATEGORY MASTER (Role-based)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.kpi_category_master (
    id SERIAL4 PRIMARY KEY,
    employment_type_code VARCHAR(20) NOT NULL,
    role_code VARCHAR(20) NOT NULL,

    -- Category Details
    category_code VARCHAR(50) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Scoring
    max_points INT NOT NULL,
    calculation_method VARCHAR(20) DEFAULT 'MANUAL',
    -- MANUAL: Manually entered by manager
    -- AUTO_ATTENDANCE: Automatically calculated from attendance
    -- AUTO_SALES: Automatically calculated from sales data
    -- AUTO_STOCK: Automatically calculated from stock accuracy
    -- FORMULA: Custom formula-based calculation

    -- Thresholds (for auto-calculation)
    excellent_threshold DECIMAL(5,2), -- e.g., 95% attendance for excellent
    good_threshold DECIMAL(5,2),      -- e.g., 90% attendance for good
    average_threshold DECIMAL(5,2),   -- e.g., 85% attendance for average

    -- Display
    display_order INT DEFAULT 0,

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    -- Constraints
    CONSTRAINT kpi_category_un UNIQUE (employment_type_code, role_code, category_code),
    CONSTRAINT kpi_category_employment_type_fk FOREIGN KEY (employment_type_code)
        REFERENCES public.employment_type_master(code),
    CONSTRAINT kpi_category_role_fk FOREIGN KEY (role_code) REFERENCES public.role_master(code),
    CONSTRAINT kpi_category_created_by_fk FOREIGN KEY (created_by) REFERENCES public.app_user(id),
    CONSTRAINT kpi_category_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.app_user(id),
    CONSTRAINT kpi_category_method_check CHECK (
        calculation_method IN ('MANUAL', 'AUTO_ATTENDANCE', 'AUTO_SALES', 'AUTO_STOCK', 'FORMULA')
    )
);

-- Table Comment
COMMENT ON TABLE public.kpi_category_master IS 'KPI category definitions with role-specific scoring criteria';

-- Column Comments
COMMENT ON COLUMN public.kpi_category_master.calculation_method IS 'MANUAL, AUTO_ATTENDANCE, AUTO_SALES, AUTO_STOCK, FORMULA';
COMMENT ON COLUMN public.kpi_category_master.max_points IS 'Maximum points for this KPI category';

-- Create Indexes
CREATE INDEX idx_kpi_category_role ON public.kpi_category_master(role_code, employment_type_code) WHERE active = true;
CREATE INDEX idx_kpi_category_employment_type ON public.kpi_category_master(employment_type_code) WHERE active = true;

-- ==========================================
-- 2. INSERT KPI CATEGORIES (Based on Actual Pay Structures)
-- ==========================================

-- Associate KPI Categories (Total: 100 points)
INSERT INTO public.kpi_category_master
    (employment_type_code, role_code, category_code, category_name, description, max_points, calculation_method, display_order, created_by, updated_by)
VALUES
    (
        'FULLTIME',
        'ASSOCIATE',
        'ATTENDANCE_PUNCTUALITY',
        'Attendance & Punctuality',
        'Attendance percentage, punctuality, and reliability',
        25,
        'AUTO_ATTENDANCE',
        1,
        1, 1
    ),
    (
        'FULLTIME',
        'ASSOCIATE',
        'BILLING_CASH',
        'Billing Accuracy & Cash Handling',
        'Billing accuracy, cash handling, and register reconciliation',
        25,
        'MANUAL',
        2,
        1, 1
    ),
    (
        'FULLTIME',
        'ASSOCIATE',
        'STOCK_EXPIRY',
        'Stock Handling & Expiry Support',
        'Stock handling, expiry checking, and inventory support',
        20,
        'MANUAL',
        3,
        1, 1
    ),
    (
        'FULLTIME',
        'ASSOCIATE',
        'CUSTOMER_SERVICE',
        'Customer Service & Store Upkeep',
        'Customer service quality, store cleanliness, and presentation',
        20,
        'MANUAL',
        4,
        1, 1
    ),
    (
        'FULLTIME',
        'ASSOCIATE',
        'TEAMWORK',
        'Support to Manager & Teamwork',
        'Manager support, teamwork, and collaboration',
        10,
        'MANUAL',
        5,
        1, 1
    );

-- Senior KPI Categories (Total: 100 points)
INSERT INTO public.kpi_category_master
    (employment_type_code, role_code, category_code, category_name, description, max_points, calculation_method, display_order, created_by, updated_by)
VALUES
    (
        'FULLTIME',
        'SENIOR',
        'STOCK_OWNERSHIP',
        'Stock Ownership & Audit Accuracy',
        'Stock audit accuracy, loss reduction, and inventory ownership',
        15,
        'AUTO_STOCK',
        1,
        1, 1
    ),
    (
        'FULLTIME',
        'SENIOR',
        'PURCHASE_PLANNING',
        'Purchase Planning & Stock Availability',
        'Purchase planning, stock availability, and demand forecasting',
        25,
        'MANUAL',
        2,
        1, 1
    ),
    (
        'FULLTIME',
        'SENIOR',
        'EXPIRY_DEAD_STOCK',
        'Expiry & Dead Stock Control',
        'Expiry management, dead stock control, and FEFO compliance',
        10,
        'MANUAL',
        3,
        1, 1
    ),
    (
        'FULLTIME',
        'SENIOR',
        'SALES_SUPPORT',
        'Sales Support & Conversion',
        'Sales support, conversion rates, and revenue growth',
        15,
        'AUTO_SALES',
        4,
        1, 1
    ),
    (
        'FULLTIME',
        'SENIOR',
        'CASH_BANKING',
        'Cash Handling & Banking Accuracy',
        'Cash handling accuracy, banking reconciliation, and deposit management',
        15,
        'MANUAL',
        5,
        1, 1
    ),
    (
        'FULLTIME',
        'SENIOR',
        'OPERATIONS_DISCIPLINE',
        'Store Operations & Staff Discipline',
        'Store operations management, staff discipline, and team coordination',
        10,
        'MANUAL',
        6,
        1, 1
    ),
    (
        'FULLTIME',
        'SENIOR',
        'COMPLIANCE_REPORTING',
        'Compliance & Reporting',
        'Regulatory compliance, reporting accuracy, and documentation',
        10,
        'MANUAL',
        7,
        1, 1
    );

-- Part-time Pharmacist KPI Categories (Total: 100 points)
INSERT INTO public.kpi_category_master
    (employment_type_code, role_code, category_code, category_name, description, max_points, calculation_method, display_order, created_by, updated_by)
VALUES
    (
        'PARTTIME',
        'PARTTIME_PHARMACIST',
        'STOCK_AUDIT_LOSS',
        'Stock Audit Accuracy & Loss Reduction',
        'Stock audit accuracy, discrepancy identification, and loss prevention',
        35,
        'AUTO_STOCK',
        1,
        1, 1
    ),
    (
        'PARTTIME',
        'PARTTIME_PHARMACIST',
        'EXPIRY_SHELF',
        'Expiry Control & Shelf Discipline',
        'Expiry monitoring, FEFO compliance, and shelf organization',
        20,
        'MANUAL',
        2,
        1, 1
    ),
    (
        'PARTTIME',
        'PARTTIME_PHARMACIST',
        'SALES_ETHICAL',
        'Sales Support & Ethical Conversion',
        'Professional sales support, ethical conversion, and customer counseling',
        25,
        'MANUAL',
        3,
        1, 1
    ),
    (
        'PARTTIME',
        'PARTTIME_PHARMACIST',
        'PROFESSIONAL_CONDUCT',
        'Professional Conduct & Reliability',
        'Professional conduct, reliability, punctuality, and ethical behavior',
        20,
        'MANUAL',
        4,
        1, 1
    );

-- ==========================================
-- 3. MONTHLY KPI SCORES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.monthly_kpi_score (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,

    -- Employee Configuration (snapshot)
    employment_type_code VARCHAR(20) NOT NULL,
    role_code VARCHAR(20) NOT NULL,

    -- Category-wise Scores (JSON for flexibility)
    category_scores JSONB NOT NULL DEFAULT '{}',
    -- Example for Associate:
    -- {
    --   "ATTENDANCE_PUNCTUALITY": 22,
    --   "BILLING_CASH": 20,
    --   "STOCK_EXPIRY": 18,
    --   "CUSTOMER_SERVICE": 17,
    --   "TEAMWORK": 8
    -- }
    -- Example for Part-time:
    -- {
    --   "STOCK_AUDIT_LOSS": 30,
    --   "EXPIRY_SHELF": 18,
    --   "SALES_ETHICAL": 20,
    --   "PROFESSIONAL_CONDUCT": 17
    -- }

    -- Total Score
    total_score DECIMAL(5,2) NOT NULL,
    max_possible_score INT DEFAULT 100,

    -- KPI Band (for payroll calculation)
    kpi_band VARCHAR(20),
    -- "90-100", "75-89", "60-74", "50-59", "below-50" (full-time)
    -- "90-100", "75-89", "60-74", "below-60" (part-time)

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    -- DRAFT: Being entered
    -- SUBMITTED: Submitted for review
    -- APPROVED: Approved by manager
    -- LOCKED: Locked for payroll calculation

    -- Workflow
    evaluated_by INT4,
    evaluated_on TIMESTAMPTZ,
    approved_by INT4,
    approved_on TIMESTAMPTZ,
    approval_remarks TEXT,

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    -- Constraints
    CONSTRAINT monthly_kpi_score_un UNIQUE (user_id, year, month),
    CONSTRAINT monthly_kpi_score_user_fk FOREIGN KEY (user_id) REFERENCES public.app_user(id),
    CONSTRAINT monthly_kpi_score_employment_type_fk FOREIGN KEY (employment_type_code)
        REFERENCES public.employment_type_master(code),
    CONSTRAINT monthly_kpi_score_role_fk FOREIGN KEY (role_code) REFERENCES public.role_master(code),
    CONSTRAINT monthly_kpi_score_evaluated_by_fk FOREIGN KEY (evaluated_by) REFERENCES public.app_user(id),
    CONSTRAINT monthly_kpi_score_approved_by_fk FOREIGN KEY (approved_by) REFERENCES public.app_user(id),
    CONSTRAINT monthly_kpi_score_created_by_fk FOREIGN KEY (created_by) REFERENCES public.app_user(id),
    CONSTRAINT monthly_kpi_score_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.app_user(id),
    CONSTRAINT monthly_kpi_score_status_check CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'APPROVED', 'LOCKED'
    ))
);

-- Table Comment
COMMENT ON TABLE public.monthly_kpi_score IS 'Monthly KPI scores per employee with category-wise breakdown';

-- Column Comments
COMMENT ON COLUMN public.monthly_kpi_score.category_scores IS 'JSON object with category codes as keys and scores as values';
COMMENT ON COLUMN public.monthly_kpi_score.kpi_band IS 'Score band for payroll calculation: 90-100, 75-89, 60-74, 50-59, below-50';
COMMENT ON COLUMN public.monthly_kpi_score.status IS 'DRAFT, SUBMITTED, APPROVED, LOCKED';

-- Create Indexes
CREATE INDEX idx_monthly_kpi_score_user ON public.monthly_kpi_score(user_id, year DESC, month DESC);
CREATE INDEX idx_monthly_kpi_score_period ON public.monthly_kpi_score(year DESC, month DESC);
CREATE INDEX idx_monthly_kpi_score_role ON public.monthly_kpi_score(role_code, year DESC, month DESC);
CREATE INDEX idx_monthly_kpi_score_status ON public.monthly_kpi_score(status) WHERE status IN ('DRAFT', 'SUBMITTED');

-- ==========================================
-- 4. ENHANCE ATTENDANCE TABLE FOR PAYROLL
-- ==========================================

-- Add columns to existing attendance table for payroll integration
-- COMMENTED OUT: attendance table doesn't exist yet
-- ALTER TABLE public.attendance
-- ADD COLUMN IF NOT EXISTS employment_type_code VARCHAR(20),
-- ADD COLUMN IF NOT EXISTS shift_type VARCHAR(20), -- REGULAR, WEEKEND, HOLIDAY
-- ADD COLUMN IF NOT EXISTS hours_worked DECIMAL(5,2), -- For hourly workers
-- ADD COLUMN IF NOT EXISTS billable_hours DECIMAL(5,2), -- For contractors
-- ADD COLUMN IF NOT EXISTS day_rate DECIMAL(10,2), -- Rate for this specific day (can vary)
-- ADD COLUMN IF NOT EXISTS is_extra_day BOOL DEFAULT false; -- For part-time (beyond retainer days)

-- Add comments
-- COMMENT ON COLUMN public.attendance.shift_type IS 'REGULAR, WEEKEND, HOLIDAY - determines payment calculation';
-- COMMENT ON COLUMN public.attendance.is_extra_day IS 'For part-time: indicates day beyond retainer coverage';
-- COMMENT ON COLUMN public.attendance.employment_type_code IS 'Snapshot of employment type at time of attendance';
-- COMMENT ON COLUMN public.attendance.hours_worked IS 'Actual hours worked (for hourly workers)';
-- COMMENT ON COLUMN public.attendance.billable_hours IS 'Billable hours (for contractors)';
-- COMMENT ON COLUMN public.attendance.day_rate IS 'Day rate applicable for this attendance (can vary for part-time)';

-- ==========================================
-- 5. FUNCTIONS FOR KPI CALCULATION
-- ==========================================

-- Function to calculate KPI band based on score
CREATE OR REPLACE FUNCTION calculate_kpi_band(
    p_score DECIMAL,
    p_employment_type VARCHAR,
    p_role VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
    IF p_employment_type = 'PARTTIME' AND p_role = 'PARTTIME_PHARMACIST' THEN
        -- Part-time bands (no 50-59 band)
        IF p_score >= 90 THEN RETURN '90-100';
        ELSIF p_score >= 75 THEN RETURN '75-89';
        ELSIF p_score >= 60 THEN RETURN '60-74';
        ELSE RETURN 'below-60';
        END IF;
    ELSE
        -- Full-time bands
        IF p_score >= 90 THEN RETURN '90-100';
        ELSIF p_score >= 75 THEN RETURN '75-89';
        ELSIF p_score >= 60 THEN RETURN '60-74';
        ELSIF p_score >= 50 THEN RETURN '50-59';
        ELSE RETURN 'below-50';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_kpi_band IS 'Calculates KPI band based on score, employment type, and role';

-- Function to automatically update KPI band when score changes
CREATE OR REPLACE FUNCTION update_kpi_band_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.kpi_band = calculate_kpi_band(
        NEW.total_score,
        NEW.employment_type_code,
        NEW.role_code
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update KPI band
CREATE TRIGGER trg_monthly_kpi_score_update_band
BEFORE INSERT OR UPDATE OF total_score, employment_type_code, role_code
ON public.monthly_kpi_score
FOR EACH ROW
EXECUTE FUNCTION update_kpi_band_trigger();

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Verify KPI categories by role
SELECT
    employment_type_code,
    role_code,
    category_code,
    category_name,
    max_points,
    calculation_method
FROM public.kpi_category_master
WHERE active = true
ORDER BY employment_type_code, role_code, display_order;

-- Verify total points per role
SELECT
    employment_type_code,
    role_code,
    COUNT(*) as category_count,
    SUM(max_points) as total_points
FROM public.kpi_category_master
WHERE active = true
GROUP BY employment_type_code, role_code
ORDER BY employment_type_code, role_code;

-- Verify KPI categories count per role
SELECT
    r.name as role_name,
    r.code as role_code,
    e.name as employment_type,
    COUNT(kc.id) as kpi_categories,
    SUM(kc.max_points) as total_points
FROM public.role_master r
JOIN public.employment_type_master e ON r.employment_type_code = e.code
LEFT JOIN public.kpi_category_master kc ON r.code = kc.role_code AND e.code = kc.employment_type_code AND kc.active = true
GROUP BY r.name, r.code, e.name
ORDER BY r.code;

-- Test KPI band calculation function
SELECT
    score,
    'FULLTIME' as employment_type,
    'ASSOCIATE' as role,
    calculate_kpi_band(score, 'FULLTIME', 'ASSOCIATE') as band
FROM (VALUES (95), (85), (70), (55), (45)) AS test_scores(score)
UNION ALL
SELECT
    score,
    'PARTTIME' as employment_type,
    'PARTTIME_PHARMACIST' as role,
    calculate_kpi_band(score, 'PARTTIME', 'PARTTIME_PHARMACIST') as band
FROM (VALUES (95), (85), (70), (55)) AS test_scores(score);

-- Summary
SELECT 'KPI system enhanced successfully' as status,
       (SELECT COUNT(*) FROM kpi_category_master WHERE active = true) as kpi_categories,
       (SELECT COUNT(DISTINCT role_code) FROM kpi_category_master WHERE active = true) as roles_with_kpis;
