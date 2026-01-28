# HR Policy & Benefits Management - Database Schema Design

## Overview
Comprehensive schema for managing company-wide HR policies, employee benefits, and eligibility rules.

## Design Principles
1. **Separation of Concerns**: Policies, benefits, and eligibility are separate entities
2. **Versioning**: Track policy changes over time with effective dates
3. **Flexibility**: JSON fields for dynamic policy parameters
4. **Audit Trail**: Complete audit logging for compliance
5. **Integration**: Seamless integration with payroll and employee modules

---

## Schema Design

### 1. HR Policy Master (`hr_policy_master`)
General HR policies like probation, notice period, work from home, etc.

```sql
CREATE TABLE hr_policy_master (
  id SERIAL PRIMARY KEY,
  policy_code VARCHAR(50) UNIQUE NOT NULL,           -- PROBATION, NOTICE_PERIOD, WFH, OVERTIME, etc.
  policy_name VARCHAR(100) NOT NULL,
  policy_category VARCHAR(50) NOT NULL,               -- EMPLOYMENT, COMPENSATION, ATTENDANCE, CONDUCT, etc.
  description TEXT,
  policy_content JSONB NOT NULL,                      -- Policy rules and parameters
  is_mandatory BOOLEAN DEFAULT false,                 -- Must be applied to all employees
  requires_approval BOOLEAN DEFAULT false,            -- Needs management approval
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
CREATE INDEX idx_hr_policy_effective ON hr_policy_master(effective_from, effective_to);
```

**Policy Content Examples**:

**PROBATION**:
```json
{
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
}
```

**NOTICE_PERIOD**:
```json
{
  "probation_period_days": 0,
  "post_probation_days": 30,
  "senior_management_days": 90,
  "payment_in_lieu_allowed": true,
  "buyout_allowed": true
}
```

**WFH_POLICY**:
```json
{
  "allowed": true,
  "max_days_per_week": 2,
  "requires_approval": true,
  "approver_role": "MANAGER",
  "advance_notice_days": 1,
  "eligible_roles": ["DEVELOPER", "DESIGNER", "ANALYST"]
}
```

**OVERTIME_POLICY**:
```json
{
  "overtime_allowed": true,
  "eligible_employment_types": ["FULL_TIME", "CONTRACT"],
  "calculation_method": "HOURLY_RATE_MULTIPLIER",
  "weekday_multiplier": 1.5,
  "weekend_multiplier": 2.0,
  "holiday_multiplier": 2.5,
  "max_overtime_hours_per_month": 40,
  "requires_approval": true
}
```

---

### 2. Benefit Master (`benefit_master`)
Catalog of all available benefit types.

```sql
CREATE TABLE benefit_master (
  id SERIAL PRIMARY KEY,
  benefit_code VARCHAR(50) UNIQUE NOT NULL,           -- MEDICAL_INS, LIFE_INS, GRATUITY, etc.
  benefit_name VARCHAR(100) NOT NULL,
  benefit_category VARCHAR(50) NOT NULL,               -- INSURANCE, STATUTORY, ALLOWANCE, WELLNESS, etc.
  description TEXT,
  is_statutory BOOLEAN DEFAULT false,                 -- Mandatory by law (PF, ESI, Gratuity)
  is_taxable BOOLEAN DEFAULT true,
  calculation_basis VARCHAR(50),                       -- FIXED, CTC_PERCENTAGE, BASIC_PERCENTAGE, etc.
  active BOOLEAN DEFAULT true,
  archive BOOLEAN DEFAULT false,
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES app_user(id),
  updated_by INT REFERENCES app_user(id)
);

CREATE INDEX idx_benefit_code ON benefit_master(benefit_code);
CREATE INDEX idx_benefit_category ON benefit_master(benefit_category);
```

**Benefit Categories**:
- `INSURANCE`: Medical, Life, Accidental, Disability
- `STATUTORY`: PF, ESI, Gratuity, Professional Tax
- `ALLOWANCE`: HRA, Transport, Mobile, Internet, Food
- `WELLNESS`: Gym, Health Checkup, Mental Health
- `EDUCATION`: Training, Certification, Tuition
- `LEAVE`: Maternity, Paternity, Adoption, Sabbatical
- `RETIREMENT`: NPS, Superannuation
- `OTHER`: Stock Options, Flexible Benefits

---

### 3. Benefit Policy (`benefit_policy`)
Specific benefit configurations and rules.

```sql
CREATE TABLE benefit_policy (
  id SERIAL PRIMARY KEY,
  benefit_id INT NOT NULL REFERENCES benefit_master(id),
  policy_name VARCHAR(100) NOT NULL,                  -- "Gold Medical Plan", "Basic Life Insurance"
  description TEXT,

  -- Coverage Configuration
  coverage_amount DECIMAL(12,2),                       -- Maximum coverage/limit
  coverage_percentage DECIMAL(5,2),                    -- Percentage of salary
  coverage_formula JSONB,                              -- Complex calculation rules

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
  policy_provider VARCHAR(200),                        -- Insurance company, vendor
  policy_number VARCHAR(100),
  policy_start_date DATE,
  policy_end_date DATE,
  renewal_date DATE,

  -- Rules & Conditions
  waiting_period_days INT DEFAULT 0,                   -- Before benefit is active
  claim_submission_deadline_days INT DEFAULT 30,
  max_claims_per_year INT,
  documents_required TEXT[],                           -- Array of required documents
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
CREATE INDEX idx_benefit_policy_effective ON benefit_policy(effective_from, effective_to);
```

**Coverage Formula Examples**:

**Medical Insurance**:
```json
{
  "base": "FIXED",
  "base_amount": 500000,
  "additional_rules": [
    {"condition": "role_level >= 'MANAGER'", "additional_amount": 300000},
    {"condition": "tenure_years >= 5", "additional_amount": 200000}
  ]
}
```

**Housing Allowance**:
```json
{
  "base": "BASIC_PERCENTAGE",
  "percentage": 40,
  "max_amount": 25000,
  "metro_cities": ["MUMBAI", "DELHI", "BANGALORE"],
  "metro_percentage": 50
}
```

---

### 4. Policy Eligibility Rules (`policy_eligibility_rule`)
Define who is eligible for which policies/benefits.

```sql
CREATE TABLE policy_eligibility_rule (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,                    -- HR_POLICY, BENEFIT_POLICY
  entity_id INT NOT NULL,                               -- Foreign key to hr_policy_master or benefit_policy

  -- Eligibility Criteria
  employment_types VARCHAR(20)[],                       -- FULL_TIME, PART_TIME, CONTRACT, INTERN
  role_codes VARCHAR(50)[],                             -- Specific roles
  min_tenure_months INT,                                -- Minimum service period
  max_tenure_months INT,                                -- Maximum (e.g., only for first 2 years)
  store_ids INT[],                                      -- Specific stores

  -- Custom Rules (SQL expression)
  custom_rule_sql TEXT,                                 -- e.g., "salary > 50000 AND department = 'IT'"

  -- Priority & Overrides
  priority INT DEFAULT 0,                               -- Higher priority rules take precedence

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
```

---

### 5. Employee Benefit Enrollment (`employee_benefit_enrollment`)
Track which employees are enrolled in which benefits.

```sql
CREATE TABLE employee_benefit_enrollment (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app_user(id),
  benefit_policy_id INT NOT NULL REFERENCES benefit_policy(id),

  -- Enrollment Details
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  enrollment_type VARCHAR(20) NOT NULL DEFAULT 'AUTO',  -- AUTO, VOLUNTARY, MANDATORY
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',          -- ACTIVE, PENDING, SUSPENDED, CANCELLED

  -- Custom Configuration (employee-specific overrides)
  custom_coverage_amount DECIMAL(12,2),
  custom_employee_contribution DECIMAL(12,2),

  -- Family Members (for family coverage benefits)
  dependents JSONB,                                      -- Array of dependent details

  -- Nomination (for life insurance, gratuity, etc.)
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
CREATE INDEX idx_employee_enrollment_effective ON employee_benefit_enrollment(effective_from, effective_to);
```

**Dependents JSON Example**:
```json
[
  {
    "name": "Jane Doe",
    "relationship": "SPOUSE",
    "dob": "1992-05-15",
    "gender": "F",
    "coverage_amount": 300000,
    "documents": ["marriage_certificate.pdf", "id_proof.pdf"]
  },
  {
    "name": "John Doe Jr",
    "relationship": "CHILD",
    "dob": "2020-03-10",
    "gender": "M",
    "coverage_amount": 200000,
    "documents": ["birth_certificate.pdf"]
  }
]
```

---

### 6. Benefit Claims (`benefit_claim`)
Track benefit claims and reimbursements.

```sql
CREATE TABLE benefit_claim (
  id SERIAL PRIMARY KEY,
  enrollment_id INT NOT NULL REFERENCES employee_benefit_enrollment(id),
  user_id INT NOT NULL REFERENCES app_user(id),
  benefit_policy_id INT NOT NULL REFERENCES benefit_policy(id),

  -- Claim Details
  claim_number VARCHAR(50) UNIQUE NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claim_type VARCHAR(50) NOT NULL,                     -- REIMBURSEMENT, DIRECT_SETTLEMENT, CASHLESS
  incident_date DATE,

  -- Amount Details
  claimed_amount DECIMAL(12,2) NOT NULL,
  approved_amount DECIMAL(12,2),
  rejected_amount DECIMAL(12,2),
  paid_amount DECIMAL(12,2),

  -- Description & Documents
  description TEXT NOT NULL,
  documents JSONB,                                      -- Array of document references

  -- Workflow
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',      -- SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PAID
  submitted_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT REFERENCES app_user(id),
  reviewed_on TIMESTAMPTZ,
  reviewer_remarks TEXT,
  approved_by INT REFERENCES app_user(id),
  approved_on TIMESTAMPTZ,
  approval_remarks TEXT,
  rejection_reason TEXT,

  -- Payment Details
  payment_mode VARCHAR(20),                             -- BANK_TRANSFER, CASH, CHEQUE
  payment_reference VARCHAR(100),
  payment_date DATE,

  -- Audit
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES app_user(id),
  updated_by INT REFERENCES app_user(id)
);

CREATE INDEX idx_benefit_claim_enrollment ON benefit_claim(enrollment_id);
CREATE INDEX idx_benefit_claim_user ON benefit_claim(user_id);
CREATE INDEX idx_benefit_claim_status ON benefit_claim(status);
CREATE INDEX idx_benefit_claim_number ON benefit_claim(claim_number);
CREATE UNIQUE INDEX idx_claim_number ON benefit_claim(claim_number);
```

---

### 7. HR Policy Acknowledgment (`hr_policy_acknowledgment`)
Track employee acknowledgment of HR policies.

```sql
CREATE TABLE hr_policy_acknowledgment (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app_user(id),
  policy_id INT NOT NULL REFERENCES hr_policy_master(id),

  -- Acknowledgment Details
  acknowledged_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledgment_method VARCHAR(20) NOT NULL,           -- DIGITAL_SIGNATURE, EMAIL, PHYSICAL
  ip_address INET,
  user_agent TEXT,
  digital_signature TEXT,                               -- Base64 encoded signature

  -- Policy Version at Time of Acknowledgment
  policy_version INT NOT NULL,
  policy_content_snapshot JSONB NOT NULL,               -- Snapshot of policy content

  -- Audit
  created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_user_policy_acknowledgment UNIQUE(user_id, policy_id, policy_version)
);

CREATE INDEX idx_policy_ack_user ON hr_policy_acknowledgment(user_id);
CREATE INDEX idx_policy_ack_policy ON hr_policy_acknowledgment(policy_id);
```

---

### 8. HR Audit Log Enhancement
Add policy-specific entries to existing `hr_audit_log`.

New resource types:
- `HR_POLICY`
- `BENEFIT_MASTER`
- `BENEFIT_POLICY`
- `POLICY_ELIGIBILITY`
- `BENEFIT_ENROLLMENT`
- `BENEFIT_CLAIM`

---

## Pre-configured Data

### Default HR Policies

1. **PROBATION_POLICY**
   - 3 months probation
   - 1 extension allowed
   - 50% leave entitlement during probation

2. **NOTICE_PERIOD_POLICY**
   - 0 days during probation
   - 30 days after confirmation
   - 60 days for managers
   - Payment in lieu allowed

3. **WFH_POLICY**
   - 2 days per week allowed
   - Advance approval required
   - Eligible for all full-time employees

4. **OVERTIME_POLICY**
   - 1.5x on weekdays
   - 2.0x on weekends
   - 2.5x on holidays

5. **DRESS_CODE_POLICY**
   - Business casual
   - Formal on client meetings
   - Casual Fridays

### Default Benefits

1. **MEDICAL_INSURANCE**
   - Basic: 300,000 coverage
   - Gold: 500,000 coverage
   - Platinum: 1,000,000 coverage
   - Family coverage available

2. **LIFE_INSURANCE**
   - 2x annual CTC coverage
   - Nominee required

3. **PROVIDENT_FUND**
   - 12% employee + 12% employer
   - Statutory benefit

4. **GRATUITY**
   - Statutory benefit
   - Payable after 5 years

5. **MOBILE_ALLOWANCE**
   - 1,000/month for all employees
   - 2,000/month for managers

6. **INTERNET_ALLOWANCE**
   - 500/month for WFH eligible employees

7. **MEAL_ALLOWANCE**
   - 100/day for in-office employees

8. **GYM_MEMBERSHIP**
   - 2,000/month reimbursement
   - Eligible after 1 year

9. **ANNUAL_HEALTH_CHECKUP**
   - 5,000/year
   - All employees

10. **PROFESSIONAL_DEVELOPMENT**
    - 50,000/year for certifications
    - Manager approval required

---

## Integration Points

### 1. Payroll Module Integration
- Benefit costs added to payroll calculations
- Statutory deductions (PF, ESI) auto-calculated
- Allowances included in salary slip
- Claims reimbursement in payroll

### 2. Employee Onboarding Integration
- Auto-assign mandatory policies
- Auto-enroll in default benefits
- Policy acknowledgment workflow
- Probation period tracking

### 3. Leave Module Integration
- Leave benefits from benefit policies
- Maternity/paternity leave tracking
- Leave without pay policies

### 4. Attendance Module Integration
- Overtime calculation using policy rules
- WFH attendance marking
- Shift allowances

### 5. Performance Module Integration
- Performance-based benefit eligibility
- KPI-linked incentives
- Tenure-based benefit upgrades

---

## API Endpoints Structure

### HR Policies
- `GET /hr/policies` - List all policies
- `GET /hr/policies/:id` - Get policy details
- `POST /hr/policies` - Create policy
- `PATCH /hr/policies/:id` - Update policy
- `DELETE /hr/policies/:id` - Archive policy
- `GET /hr/policies/my` - Get policies applicable to current user
- `POST /hr/policies/:id/acknowledge` - Acknowledge policy

### Benefits
- `GET /hr/benefits/master` - List benefit types
- `GET /hr/benefits/policies` - List benefit policies
- `POST /hr/benefits/policies` - Create benefit policy
- `GET /hr/benefits/my` - Get my benefits
- `GET /hr/benefits/eligible` - Get benefits I'm eligible for
- `POST /hr/benefits/enroll` - Enroll in benefit
- `DELETE /hr/benefits/enroll/:id` - Cancel enrollment

### Claims
- `POST /hr/claims` - Submit claim
- `GET /hr/claims/my` - Get my claims
- `GET /hr/claims/pending` - Get pending claims (for approvers)
- `PATCH /hr/claims/:id/review` - Review claim
- `PATCH /hr/claims/:id/approve` - Approve claim
- `PATCH /hr/claims/:id/reject` - Reject claim
- `PATCH /hr/claims/:id/pay` - Mark as paid

### Eligibility
- `GET /hr/eligibility/check` - Check eligibility for policy/benefit
- `GET /hr/eligibility/rules` - List eligibility rules
- `POST /hr/eligibility/rules` - Create eligibility rule

---

## UI Components Structure

### Admin Views
1. **Policy Management Dashboard**
   - List all policies
   - Create/edit/archive policies
   - Policy versioning

2. **Benefit Configuration**
   - Benefit master management
   - Benefit policy configuration
   - Eligibility rules setup

3. **Enrollment Management**
   - View all enrollments
   - Approve/reject enrollments
   - Bulk enrollment operations

4. **Claims Management**
   - Pending claims queue
   - Claim review interface
   - Payment processing

### Employee Views
1. **My Policies**
   - View applicable policies
   - Acknowledge policies
   - Policy history

2. **My Benefits**
   - View enrolled benefits
   - View eligible benefits
   - Enroll in voluntary benefits
   - Update dependent information

3. **Submit Claim**
   - Claim submission form
   - Document upload
   - Track claim status

4. **Benefit Dashboard**
   - Coverage summary
   - Claim history
   - Utilization tracking

---

## Security & Permissions

### New Permissions
```
hr_policy.read
hr_policy.create
hr_policy.update
hr_policy.delete

benefit.read
benefit.create
benefit.update
benefit.delete

benefit_enrollment.read
benefit_enrollment.manage
benefit_enrollment.approve

benefit_claim.read
benefit_claim.submit
benefit_claim.review
benefit_claim.approve
benefit_claim.pay
```

---

## Migration Strategy

### Phase 1: Database Schema
1. Create all tables
2. Add indexes and constraints
3. Seed default policies and benefits

### Phase 2: Backend Implementation
1. Create entities
2. Implement services
3. Build controllers
4. Add validations

### Phase 3: Frontend Implementation
1. Create models and services
2. Build admin components
3. Build employee components
4. Add to navigation

### Phase 4: Integration
1. Connect with payroll
2. Connect with onboarding
3. Connect with leave module
4. Connect with attendance

### Phase 5: Testing & Deployment
1. Unit tests
2. Integration tests
3. User acceptance testing
4. Production deployment

---

**Document Version**: 1.0
**Created**: 2026-01-13
**Status**: Design Approved - Ready for Implementation
