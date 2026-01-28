-- =====================================================
-- HR Policy & Benefits Management Schema
-- Migration: 006
-- Description: Comprehensive HR policy and benefits management system
-- Created: 2026-01-13
-- Dependencies: 003_hr_management_tables.sql
-- =====================================================

-- =====================================================
-- 1. HR POLICY MASTER
-- =====================================================
CREATE TABLE IF NOT EXISTS hr_policy_master (
  id SERIAL PRIMARY KEY,
  policy_code VARCHAR(50) UNIQUE NOT NULL,
  policy_name VARCHAR(100) NOT NULL,
  policy_category VARCHAR(50) NOT NULL,
  description TEXT,
  policy_content JSONB NOT NULL DEFAULT '{}',
  is_mandatory BOOLEAN DEFAULT false,
  requires_approval BOOLEAN DEFAULT false,
  version INT DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_to DATE,
  active BOOLEAN DEFAULT true,
  archive BOOLEAN DEFAULT false,
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES app_user(id),
  updated_by INT REFERENCES app_user(id)
);

CREATE INDEX idx_hr_policy_code ON hr_policy_master(policy_code);
CREATE INDEX idx_hr_policy_category ON hr_policy_master(policy_category);
CREATE INDEX idx_hr_policy_effective ON hr_policy_master(effective_from, effective_to) WHERE active = true;
CREATE INDEX idx_hr_policy_active ON hr_policy_master(active, archive);

COMMENT ON TABLE hr_policy_master IS 'Master table for HR policies like probation, notice period, WFH, etc.';
COMMENT ON COLUMN hr_policy_master.policy_content IS 'JSON configuration for policy rules and parameters';

-- =====================================================
-- 2. BENEFIT MASTER
-- =====================================================
CREATE TABLE IF NOT EXISTS benefit_master (
  id SERIAL PRIMARY KEY,
  benefit_code VARCHAR(50) UNIQUE NOT NULL,
  benefit_name VARCHAR(100) NOT NULL,
  benefit_category VARCHAR(50) NOT NULL,
  description TEXT,
  is_statutory BOOLEAN DEFAULT false,
  is_taxable BOOLEAN DEFAULT true,
  calculation_basis VARCHAR(50),
  active BOOLEAN DEFAULT true,
  archive BOOLEAN DEFAULT false,
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES app_user(id),
  updated_by INT REFERENCES app_user(id)
);

CREATE INDEX idx_benefit_code ON benefit_master(benefit_code);
CREATE INDEX idx_benefit_category ON benefit_master(benefit_category);
CREATE INDEX idx_benefit_active ON benefit_master(active, archive);

COMMENT ON TABLE benefit_master IS 'Catalog of benefit types (insurance, allowances, statutory, etc.)';
COMMENT ON COLUMN benefit_master.calculation_basis IS 'FIXED, CTC_PERCENTAGE, BASIC_PERCENTAGE, etc.';

-- =====================================================
-- 3. BENEFIT POLICY
-- =====================================================
CREATE TABLE IF NOT EXISTS benefit_policy (
  id SERIAL PRIMARY KEY,
  benefit_id INT NOT NULL REFERENCES benefit_master(id),
  policy_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Coverage Configuration
  coverage_amount DECIMAL(12,2),
  coverage_percentage DECIMAL(5,2),
  coverage_formula JSONB,

  -- Cost Configuration
  employee_contribution_amount DECIMAL(12,2) DEFAULT 0,
  employee_contribution_percentage DECIMAL(5,2) DEFAULT 0,
  employer_contribution_amount DECIMAL(12,2) DEFAULT 0,
  employer_contribution_percentage DECIMAL(5,2) DEFAULT 0,

  -- Family Coverage
  family_coverage_allowed BOOLEAN DEFAULT false,
  max_dependents INT DEFAULT 0,
  dependent_coverage_amount DECIMAL(12,2),

  -- Policy Details
  policy_provider VARCHAR(200),
  policy_number VARCHAR(100),
  policy_start_date DATE,
  policy_end_date DATE,
  renewal_date DATE,

  -- Rules & Conditions
  waiting_period_days INT DEFAULT 0,
  claim_submission_deadline_days INT DEFAULT 30,
  max_claims_per_year INT,
  documents_required TEXT[],
  terms_and_conditions TEXT,

  -- Effective Dates
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Audit
  active BOOLEAN DEFAULT true,
  archive BOOLEAN DEFAULT false,
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES app_user(id),
  updated_by INT REFERENCES app_user(id)
);

CREATE INDEX idx_benefit_policy_benefit ON benefit_policy(benefit_id);
CREATE INDEX idx_benefit_policy_effective ON benefit_policy(effective_from, effective_to) WHERE active = true;
CREATE INDEX idx_benefit_policy_active ON benefit_policy(active, archive);

COMMENT ON TABLE benefit_policy IS 'Specific benefit configurations with coverage and cost details';
COMMENT ON COLUMN benefit_policy.coverage_formula IS 'Complex calculation rules for dynamic coverage';

-- =====================================================
-- 4. POLICY ELIGIBILITY RULE
-- =====================================================
CREATE TABLE IF NOT EXISTS policy_eligibility_rule (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,

  -- Eligibility Criteria
  employment_types VARCHAR(20)[],
  role_codes VARCHAR(50)[],
  min_tenure_months INT,
  max_tenure_months INT,
  store_ids INT[],

  -- Custom Rules
  custom_rule_sql TEXT,

  -- Priority
  priority INT DEFAULT 0,

  -- Effective Dates
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Audit
  active BOOLEAN DEFAULT true,
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES app_user(id)
);

CREATE INDEX idx_eligibility_entity ON policy_eligibility_rule(entity_type, entity_id);
CREATE INDEX idx_eligibility_employment_type ON policy_eligibility_rule USING GIN(employment_types);
CREATE INDEX idx_eligibility_roles ON policy_eligibility_rule USING GIN(role_codes);
CREATE INDEX idx_eligibility_stores ON policy_eligibility_rule USING GIN(store_ids);
CREATE INDEX idx_eligibility_effective ON policy_eligibility_rule(effective_from, effective_to) WHERE active = true;

COMMENT ON TABLE policy_eligibility_rule IS 'Define who is eligible for which policies/benefits';
COMMENT ON COLUMN policy_eligibility_rule.entity_type IS 'HR_POLICY or BENEFIT_POLICY';
COMMENT ON COLUMN policy_eligibility_rule.custom_rule_sql IS 'SQL expression for complex eligibility rules';

-- =====================================================
-- 5. EMPLOYEE BENEFIT ENROLLMENT
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_benefit_enrollment (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app_user(id),
  benefit_policy_id INT NOT NULL REFERENCES benefit_policy(id),

  -- Enrollment Details
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  enrollment_type VARCHAR(20) NOT NULL DEFAULT 'AUTO',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

  -- Custom Configuration
  custom_coverage_amount DECIMAL(12,2),
  custom_employee_contribution DECIMAL(12,2),

  -- Family Members
  dependents JSONB,

  -- Nomination
  nominee_name VARCHAR(200),
  nominee_relationship VARCHAR(50),
  nominee_dob DATE,
  nominee_contact VARCHAR(20),
  nominee_percentage DECIMAL(5,2) DEFAULT 100,

  -- Approval Workflow
  requires_approval BOOLEAN DEFAULT false,
  approved_by INT REFERENCES app_user(id),
  approved_on TIMESTAMPTZ,
  approval_remarks TEXT,

  -- Effective Dates
  effective_from DATE NOT NULL,
  effective_to DATE,
  cancellation_date DATE,
  cancellation_reason TEXT,

  -- Audit
  active BOOLEAN DEFAULT true,
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES app_user(id),
  updated_by INT REFERENCES app_user(id),

  CONSTRAINT unique_user_benefit_enrollment UNIQUE(user_id, benefit_policy_id, effective_from)
);

CREATE INDEX idx_employee_enrollment_user ON employee_benefit_enrollment(user_id);
CREATE INDEX idx_employee_enrollment_benefit ON employee_benefit_enrollment(benefit_policy_id);
CREATE INDEX idx_employee_enrollment_status ON employee_benefit_enrollment(status);
CREATE INDEX idx_employee_enrollment_effective ON employee_benefit_enrollment(effective_from, effective_to) WHERE active = true;
CREATE INDEX idx_employee_enrollment_type ON employee_benefit_enrollment(enrollment_type);

COMMENT ON TABLE employee_benefit_enrollment IS 'Track employee enrollments in benefit policies';
COMMENT ON COLUMN employee_benefit_enrollment.enrollment_type IS 'AUTO, VOLUNTARY, MANDATORY';
COMMENT ON COLUMN employee_benefit_enrollment.status IS 'ACTIVE, PENDING, SUSPENDED, CANCELLED';
COMMENT ON COLUMN employee_benefit_enrollment.dependents IS 'Array of dependent details with coverage';

-- =====================================================
-- 6. BENEFIT CLAIM
-- =====================================================
CREATE TABLE IF NOT EXISTS benefit_claim (
  id SERIAL PRIMARY KEY,
  enrollment_id INT NOT NULL REFERENCES employee_benefit_enrollment(id),
  user_id INT NOT NULL REFERENCES app_user(id),
  benefit_policy_id INT NOT NULL REFERENCES benefit_policy(id),

  -- Claim Details
  claim_number VARCHAR(50) UNIQUE NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claim_type VARCHAR(50) NOT NULL,
  incident_date DATE,

  -- Amount Details
  claimed_amount DECIMAL(12,2) NOT NULL,
  approved_amount DECIMAL(12,2),
  rejected_amount DECIMAL(12,2),
  paid_amount DECIMAL(12,2),

  -- Description & Documents
  description TEXT NOT NULL,
  documents JSONB,

  -- Workflow
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
  submitted_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT REFERENCES app_user(id),
  reviewed_on TIMESTAMPTZ,
  reviewer_remarks TEXT,
  approved_by INT REFERENCES app_user(id),
  approved_on TIMESTAMPTZ,
  approval_remarks TEXT,
  rejection_reason TEXT,

  -- Payment Details
  payment_mode VARCHAR(20),
  payment_reference VARCHAR(100),
  payment_date DATE,
  payroll_run_id INT,

  -- Audit
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES app_user(id),
  updated_by INT REFERENCES app_user(id)
);

CREATE INDEX idx_benefit_claim_enrollment ON benefit_claim(enrollment_id);
CREATE INDEX idx_benefit_claim_user ON benefit_claim(user_id);
CREATE INDEX idx_benefit_claim_benefit ON benefit_claim(benefit_policy_id);
CREATE INDEX idx_benefit_claim_status ON benefit_claim(status);
CREATE INDEX idx_benefit_claim_number ON benefit_claim(claim_number);
CREATE INDEX idx_benefit_claim_date ON benefit_claim(claim_date);
CREATE INDEX idx_benefit_claim_payroll ON benefit_claim(payroll_run_id);
CREATE UNIQUE INDEX idx_claim_number_unique ON benefit_claim(claim_number);

COMMENT ON TABLE benefit_claim IS 'Track benefit claims and reimbursements';
COMMENT ON COLUMN benefit_claim.claim_type IS 'REIMBURSEMENT, DIRECT_SETTLEMENT, CASHLESS';
COMMENT ON COLUMN benefit_claim.status IS 'SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PAID';
COMMENT ON COLUMN benefit_claim.documents IS 'Array of document file references';

-- =====================================================
-- 7. HR POLICY ACKNOWLEDGMENT
-- =====================================================
CREATE TABLE IF NOT EXISTS hr_policy_acknowledgment (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app_user(id),
  policy_id INT NOT NULL REFERENCES hr_policy_master(id),

  -- Acknowledgment Details
  acknowledged_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledgment_method VARCHAR(20) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  digital_signature TEXT,

  -- Policy Version Snapshot
  policy_version INT NOT NULL,
  policy_content_snapshot JSONB NOT NULL,

  -- Audit
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_user_policy_acknowledgment UNIQUE(user_id, policy_id, policy_version)
);

CREATE INDEX idx_policy_ack_user ON hr_policy_acknowledgment(user_id);
CREATE INDEX idx_policy_ack_policy ON hr_policy_acknowledgment(policy_id);
CREATE INDEX idx_policy_ack_date ON hr_policy_acknowledgment(acknowledged_on);

COMMENT ON TABLE hr_policy_acknowledgment IS 'Track employee acknowledgment of HR policies';
COMMENT ON COLUMN hr_policy_acknowledgment.acknowledgment_method IS 'DIGITAL_SIGNATURE, EMAIL, PHYSICAL';
COMMENT ON COLUMN hr_policy_acknowledgment.policy_content_snapshot IS 'Snapshot of policy at time of acknowledgment';

-- =====================================================
-- SEED DATA - DEFAULT HR POLICIES
-- =====================================================

-- Probation Policy
INSERT INTO hr_policy_master (policy_code, policy_name, policy_category, description, policy_content, is_mandatory, version, effective_from, created_by)
VALUES (
  'PROBATION',
  'Probation Period Policy',
  'EMPLOYMENT',
  'Standard probation period policy for new employees',
  '{
    "duration_months": 3,
    "extension_allowed": true,
    "max_extensions": 1,
    "extension_duration_months": 3,
    "evaluation_required": true,
    "benefits_during_probation": {
      "leave_entitlement": "50%",
      "insurance_coverage": false,
      "bonus_eligible": false
    }
  }'::jsonb,
  true,
  1,
  CURRENT_DATE,
  2
);

-- Notice Period Policy
INSERT INTO hr_policy_master (policy_code, policy_name, policy_category, description, policy_content, is_mandatory, version, effective_from, created_by)
VALUES (
  'NOTICE_PERIOD',
  'Notice Period Policy',
  'EMPLOYMENT',
  'Notice period requirements for resignation/termination',
  '{
    "probation_period_days": 0,
    "post_probation_days": 30,
    "senior_management_days": 60,
    "payment_in_lieu_allowed": true,
    "buyout_allowed": true
  }'::jsonb,
  true,
  1,
  CURRENT_DATE,
  2
);

-- Work From Home Policy
INSERT INTO hr_policy_master (policy_code, policy_name, policy_category, description, policy_content, is_mandatory, version, effective_from, created_by)
VALUES (
  'WFH',
  'Work From Home Policy',
  'ATTENDANCE',
  'Policy for remote work arrangements',
  '{
    "allowed": true,
    "max_days_per_week": 2,
    "requires_approval": true,
    "approver_role": "MANAGER",
    "advance_notice_days": 1,
    "eligible_roles": ["DEVELOPER", "DESIGNER", "ANALYST", "MANAGER"]
  }'::jsonb,
  false,
  1,
  CURRENT_DATE,
  2
);

-- Overtime Policy
INSERT INTO hr_policy_master (policy_code, policy_name, policy_category, description, policy_content, is_mandatory, version, effective_from, created_by)
VALUES (
  'OVERTIME',
  'Overtime Compensation Policy',
  'COMPENSATION',
  'Policy for overtime work and compensation',
  '{
    "overtime_allowed": true,
    "eligible_employment_types": ["FULL_TIME", "CONTRACT"],
    "calculation_method": "HOURLY_RATE_MULTIPLIER",
    "weekday_multiplier": 1.5,
    "weekend_multiplier": 2.0,
    "holiday_multiplier": 2.5,
    "max_overtime_hours_per_month": 40,
    "requires_approval": true
  }'::jsonb,
  false,
  1,
  CURRENT_DATE,
  2
);

-- Dress Code Policy
INSERT INTO hr_policy_master (policy_code, policy_name, policy_category, description, policy_content, is_mandatory, version, effective_from, created_by)
VALUES (
  'DRESS_CODE',
  'Dress Code Policy',
  'CONDUCT',
  'Professional dress code guidelines',
  '{
    "default": "BUSINESS_CASUAL",
    "client_meetings": "FORMAL",
    "casual_friday": true,
    "guidelines": [
      "Neat and professional appearance",
      "Formal wear for client meetings",
      "Casual on Fridays"
    ]
  }'::jsonb,
  true,
  1,
  CURRENT_DATE,
  2
);

-- =====================================================
-- SEED DATA - BENEFIT MASTERS
-- =====================================================

-- Insurance Benefits
INSERT INTO benefit_master (benefit_code, benefit_name, benefit_category, description, is_statutory, is_taxable, calculation_basis, created_by)
VALUES
  ('MEDICAL_INS', 'Medical Insurance', 'INSURANCE', 'Group health insurance coverage', false, false, 'FIXED', 2),
  ('LIFE_INS', 'Life Insurance', 'INSURANCE', 'Term life insurance coverage', false, false, 'CTC_PERCENTAGE', 2),
  ('ACCIDENT_INS', 'Accidental Insurance', 'INSURANCE', 'Personal accident coverage', false, false, 'FIXED', 2);

-- Statutory Benefits
INSERT INTO benefit_master (benefit_code, benefit_name, benefit_category, description, is_statutory, is_taxable, calculation_basis, created_by)
VALUES
  ('PF', 'Provident Fund', 'STATUTORY', 'Employee Provident Fund contribution', true, false, 'BASIC_PERCENTAGE', 2),
  ('ESI', 'Employee State Insurance', 'STATUTORY', 'ESI contribution for eligible employees', true, false, 'GROSS_PERCENTAGE', 2),
  ('GRATUITY', 'Gratuity', 'STATUTORY', 'Gratuity benefit as per Payment of Gratuity Act', true, false, 'FORMULA', 2);

-- Allowances
INSERT INTO benefit_master (benefit_code, benefit_name, benefit_category, description, is_statutory, is_taxable, calculation_basis, created_by)
VALUES
  ('HRA', 'House Rent Allowance', 'ALLOWANCE', 'Housing rent allowance', false, true, 'BASIC_PERCENTAGE', 2),
  ('TRANSPORT', 'Transport Allowance', 'ALLOWANCE', 'Daily commute allowance', false, true, 'FIXED', 2),
  ('MOBILE', 'Mobile Allowance', 'ALLOWANCE', 'Mobile phone reimbursement', false, true, 'FIXED', 2),
  ('INTERNET', 'Internet Allowance', 'ALLOWANCE', 'Internet connection reimbursement', false, true, 'FIXED', 2),
  ('MEAL', 'Meal Allowance', 'ALLOWANCE', 'Daily meal allowance', false, true, 'FIXED', 2);

-- Wellness Benefits
INSERT INTO benefit_master (benefit_code, benefit_name, benefit_category, description, is_statutory, is_taxable, calculation_basis, created_by)
VALUES
  ('GYM', 'Gym Membership', 'WELLNESS', 'Gym membership reimbursement', false, true, 'FIXED', 2),
  ('HEALTH_CHECKUP', 'Annual Health Checkup', 'WELLNESS', 'Preventive health checkup', false, false, 'FIXED', 2);

-- Education Benefits
INSERT INTO benefit_master (benefit_code, benefit_name, benefit_category, description, is_statutory, is_taxable, calculation_basis, created_by)
VALUES
  ('TRAINING', 'Professional Development', 'EDUCATION', 'Training and certification support', false, false, 'FIXED', 2);

-- =====================================================
-- SEED DATA - DEFAULT BENEFIT POLICIES
-- =====================================================

-- Medical Insurance - Basic Plan
INSERT INTO benefit_policy (benefit_id, policy_name, description, coverage_amount, employee_contribution_amount, employer_contribution_amount,
  family_coverage_allowed, max_dependents, dependent_coverage_amount, waiting_period_days, max_claims_per_year, effective_from, created_by)
SELECT
  id,
  'Basic Medical Plan',
  'Basic health insurance with 300,000 coverage',
  300000,
  500,
  1500,
  true,
  4,
  200000,
  90,
  NULL,
  CURRENT_DATE,
  2
FROM benefit_master WHERE benefit_code = 'MEDICAL_INS';

-- Life Insurance
INSERT INTO benefit_policy (benefit_id, policy_name, description, coverage_percentage, employer_contribution_amount,
  waiting_period_days, effective_from, created_by)
SELECT
  id,
  'Standard Life Insurance',
  'Life insurance coverage of 2x annual CTC',
  200,
  0,
  0,
  CURRENT_DATE,
  2
FROM benefit_master WHERE benefit_code = 'LIFE_INS';

-- Provident Fund
INSERT INTO benefit_policy (benefit_id, policy_name, description, employee_contribution_percentage, employer_contribution_percentage,
  effective_from, created_by)
SELECT
  id,
  'EPF Contribution',
  'Employee Provident Fund - 12% employee + 12% employer contribution',
  12,
  12,
  CURRENT_DATE,
  2
FROM benefit_master WHERE benefit_code = 'PF';

-- Mobile Allowance
INSERT INTO benefit_policy (benefit_id, policy_name, description, coverage_amount, effective_from, created_by)
SELECT
  id,
  'Mobile Allowance',
  'Monthly mobile reimbursement',
  1000,
  CURRENT_DATE,
  2
FROM benefit_master WHERE benefit_code = 'MOBILE';

-- Internet Allowance
INSERT INTO benefit_policy (benefit_id, policy_name, description, coverage_amount, effective_from, created_by)
SELECT
  id,
  'Internet Allowance',
  'Monthly internet reimbursement for WFH',
  500,
  CURRENT_DATE,
  2
FROM benefit_master WHERE benefit_code = 'INTERNET';

-- Meal Allowance
INSERT INTO benefit_policy (benefit_id, policy_name, description, coverage_amount, effective_from, created_by)
SELECT
  id,
  'Meal Allowance',
  'Daily meal allowance for in-office employees',
  100,
  CURRENT_DATE,
  2
FROM benefit_master WHERE benefit_code = 'MEAL';

-- Health Checkup
INSERT INTO benefit_policy (benefit_id, policy_name, description, coverage_amount, max_claims_per_year, effective_from, created_by)
SELECT
  id,
  'Annual Health Checkup',
  'Preventive health checkup once per year',
  5000,
  1,
  CURRENT_DATE,
  2
FROM benefit_master WHERE benefit_code = 'HEALTH_CHECKUP';

-- Professional Development
INSERT INTO benefit_policy (benefit_id, policy_name, description, coverage_amount, max_claims_per_year,
  claim_submission_deadline_days, documents_required, effective_from, created_by)
SELECT
  id,
  'Professional Development',
  'Training and certification support',
  50000,
  3,
  30,
  ARRAY['invoice', 'certificate', 'approval_email'],
  CURRENT_DATE,
  2
FROM benefit_master WHERE benefit_code = 'TRAINING';

-- =====================================================
-- AUDIT LOG INTEGRATION
-- =====================================================

-- Add new resource types to hr_audit_log (if not already present)
-- These will be used by backend services for audit tracking

COMMENT ON TABLE hr_audit_log IS 'Audit trail for HR operations including policies and benefits';

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

SELECT 'HR Policy & Benefits schema created successfully!' as status,
       (SELECT COUNT(*) FROM hr_policy_master) as policies_created,
       (SELECT COUNT(*) FROM benefit_master) as benefit_types_created,
       (SELECT COUNT(*) FROM benefit_policy) as benefit_policies_created;
