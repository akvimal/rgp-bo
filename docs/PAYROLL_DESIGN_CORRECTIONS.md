# Payroll Design Corrections Based on Actual Pay Structure

## Document Information
- **Date**: 2026-01-10
- **Source**: Actual pay structure documents from Ramesh Generic Pharmacy
- **Purpose**: Correct the payroll design to match actual salary structure

---

## CRITICAL DIFFERENCES IDENTIFIED

### 1. Salary Component Structure ❌

#### My Design (INCORRECT):
```
Basic Salary
HRA (percentage or fixed)
DA (percentage or fixed)
Transport Allowance
Special Allowance
Medical Allowance
Overtime Pay
KPI Incentive
Attendance Bonus
```

#### Actual Structure (CORRECT):

**Associate Level (₹12,000 + ₹2,000):**
```
Fixed:
- Basic Salary: ₹7,000
- House Rent Allowance (HRA): ₹2,500
- Conveyance Allowance: ₹500
- Food/Meal Allowance: ₹1,000
- Special Allowance: ₹1,000
Total Fixed: ₹12,000

Variable:
- KPI Incentive: Up to ₹2,000
Maximum CTC: ₹14,000
```

**Senior Level (₹18,000 + ₹1,000):**
```
Fixed (TN Minimum Wage Compliant):
- Basic Salary: ₹11,000
- Dearness Allowance (DA): ₹7,000
Total Fixed: ₹18,000

Variable:
- KPI Incentive: Up to ₹1,000
Maximum Total: ₹19,000
```

**KEY INSIGHT**: Senior structure is MUCH SIMPLER - only Basic + DA (no other allowances)

---

### 2. KPI Incentive Calculation ❌

#### My Design (INCORRECT):
```
Grade-based on user_score.total_score:
- Grade A (≥90): 20% of basic
- Grade B (≥75): 15% of basic
- Grade C (≥60): 10% of basic
- Grade D (≥50): 5% of basic
- Below 50: ₹0
```

#### Actual Structure (CORRECT):

**Associate (Up to ₹2,000):**
```
Score-based with FIXED amounts:
- 90-100 points → ₹2,000 (fixed)
- 75-89 points → ₹1,500 (fixed)
- 60-74 points → ₹1,000 (fixed)
- 50-59 points → ₹500 (fixed)
- Below 50 → ₹0
```

**Senior (Up to ₹1,000):**
```
Score-based with FIXED amounts:
- 90-100 points → ₹1,000 (fixed)
- 75-89 points → ₹750 (fixed)
- 60-74 points → ₹500 (fixed)
- 50-59 points → ₹250 (fixed)
- Below 50 → ₹0
```

**KEY DIFFERENCE**: Fixed amounts per band, NOT percentages of basic salary

---

### 3. KPI Categories & Weightage ❌

#### My Design (Generic):
```
- Attendance Score: 30%
- Punctuality Score: 25%
- Working Hours Score: 25%
- Reliability Score: 20%
```

#### Actual Structure (Role-Specific):

**Associate KPIs (100 points):**
```
A. Attendance & Punctuality: 25 points
B. Billing accuracy & cash handling: 25 points
C. Stock handling & expiry support: 20 points
D. Customer service & store upkeep: 20 points
E. Support to Store Manager & teamwork: 10 points
```

**Senior KPIs (100 points):**
```
A. Stock ownership & audit accuracy: 15 points
B. Purchase planning & stock availability: 25 points
C. Expiry & dead stock control: 10 points
D. Sales support & conversion: 15 points
E. Cash handling & banking accuracy: 15 points
F. Store operations & staff discipline: 10 points
G. Compliance & reporting: 10 points
```

**KEY INSIGHT**: KPIs are ROLE-SPECIFIC and OPERATIONAL, not just attendance-based

---

### 4. Missing Components in My Design ❌

**NOT in actual structure:**
- ❌ Overtime Pay (not mentioned)
- ❌ Attendance Bonus (separate component)
- ❌ Medical Allowance (not used)
- ❌ Transport Allowance (they use "Conveyance" instead)

**Missing from my design:**
- ❌ Food/Meal Allowance (₹1,000 for Associate)
- ❌ Conveyance Allowance (₹500 for Associate)
- ❌ Insurance Premium Reimbursement (PMJJBY + PMSBY up to ₹1,000/year)
- ❌ Role-specific salary structure (Associate vs Senior have DIFFERENT structures)

---

### 5. Statutory Compliance ✓ (Correct)

My design correctly includes:
- ✅ PF (12% of basic)
- ✅ ESI (0.75% if applicable)
- ✅ Professional Tax (state-specific)
- ✅ TDS/Income Tax

---

## UPDATED DATABASE SCHEMA

### Corrected: `employee_salary_structure` Table

```sql
CREATE TABLE public.employee_salary_structure (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL UNIQUE,

    -- Role/Level
    salary_level VARCHAR(20) NOT NULL, -- ASSOCIATE, SENIOR, MANAGER

    -- Fixed Components (role-dependent)
    basic_salary DECIMAL(10,2) NOT NULL,

    -- Associate-level allowances
    hra DECIMAL(10,2) DEFAULT 0,
    conveyance_allowance DECIMAL(10,2) DEFAULT 0,
    food_meal_allowance DECIMAL(10,2) DEFAULT 0,
    special_allowance DECIMAL(10,2) DEFAULT 0,

    -- Senior-level allowances
    dearness_allowance DECIMAL(10,2) DEFAULT 0,

    -- Total fixed (computed)
    total_fixed_salary DECIMAL(10,2) NOT NULL,

    -- KPI Incentive Configuration
    kpi_eligible BOOL DEFAULT true,
    max_kpi_incentive DECIMAL(10,2) DEFAULT 0, -- e.g., 2000 for Associate, 1000 for Senior

    -- Payout Band Configuration (JSON for flexibility)
    kpi_payout_bands JSONB DEFAULT '{
        "90-100": 2000,
        "75-89": 1500,
        "60-74": 1000,
        "50-59": 500,
        "below-50": 0
    }'::jsonb,

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

    -- Insurance Benefits
    pmjjby_pmsby_reimbursement BOOL DEFAULT true,
    annual_insurance_reimbursement_limit DECIMAL(10,2) DEFAULT 1000,

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
    CONSTRAINT ess_updated_by_fk FOREIGN KEY (updated_by) REFERENCES app_user(id),
    CONSTRAINT ess_salary_level_check CHECK (salary_level IN ('ASSOCIATE', 'SENIOR', 'MANAGER', 'OTHER'))
);

-- Add computed column validation
ALTER TABLE employee_salary_structure
ADD CONSTRAINT ess_total_fixed_check
CHECK (total_fixed_salary = basic_salary + hra + conveyance_allowance +
       food_meal_allowance + special_allowance + dearness_allowance);

COMMENT ON TABLE employee_salary_structure IS 'Employee salary structure matching Ramesh Generic Pharmacy pay structure';
COMMENT ON COLUMN employee_salary_structure.conveyance_allowance IS 'Replaces transport_allowance - used for Associate level';
COMMENT ON COLUMN employee_salary_structure.food_meal_allowance IS 'Food/Meal allowance - used for Associate level';
COMMENT ON COLUMN employee_salary_structure.kpi_payout_bands IS 'Score-based fixed payout bands in JSON format';
```

### New Table: `kpi_category_master`

```sql
CREATE TABLE public.kpi_category_master (
    id SERIAL4 PRIMARY KEY,
    salary_level VARCHAR(20) NOT NULL,
    category_code VARCHAR(50) NOT NULL,
    category_name VARCHAR(200) NOT NULL,
    description TEXT,
    max_points INT NOT NULL,
    display_order INT DEFAULT 0,

    active BOOL DEFAULT true NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT kpi_category_un UNIQUE (salary_level, category_code),
    CONSTRAINT kpi_category_level_check CHECK (salary_level IN ('ASSOCIATE', 'SENIOR', 'MANAGER', 'OTHER'))
);

COMMENT ON TABLE kpi_category_master IS 'KPI categories and weightage per salary level';

-- Insert Associate KPIs
INSERT INTO kpi_category_master (salary_level, category_code, category_name, max_points, display_order) VALUES
    ('ASSOCIATE', 'ATTENDANCE_PUNCTUALITY', 'Attendance & Punctuality', 25, 1),
    ('ASSOCIATE', 'BILLING_CASH', 'Billing accuracy & cash handling', 25, 2),
    ('ASSOCIATE', 'STOCK_EXPIRY', 'Stock handling & expiry support', 20, 3),
    ('ASSOCIATE', 'CUSTOMER_SERVICE', 'Customer service & store upkeep', 20, 4),
    ('ASSOCIATE', 'TEAMWORK', 'Support to Store Manager & teamwork', 10, 5);

-- Insert Senior KPIs
INSERT INTO kpi_category_master (salary_level, category_code, category_name, max_points, display_order) VALUES
    ('SENIOR', 'STOCK_OWNERSHIP', 'Stock ownership & audit accuracy', 15, 1),
    ('SENIOR', 'PURCHASE_PLANNING', 'Purchase planning & stock availability', 25, 2),
    ('SENIOR', 'EXPIRY_CONTROL', 'Expiry & dead stock control', 10, 3),
    ('SENIOR', 'SALES_SUPPORT', 'Sales support & conversion', 15, 4),
    ('SENIOR', 'CASH_BANKING', 'Cash handling & banking accuracy', 15, 5),
    ('SENIOR', 'OPERATIONS', 'Store operations & staff discipline', 10, 6),
    ('SENIOR', 'COMPLIANCE', 'Compliance & reporting', 10, 7);
```

### Updated: `user_score` Integration

```sql
-- Add columns to existing user_score table to support role-specific KPIs
ALTER TABLE public.user_score
ADD COLUMN salary_level VARCHAR(20),
ADD COLUMN kpi_breakdown JSONB,
ADD COLUMN incentive_amount DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN user_score.salary_level IS 'Associate level to determine applicable KPIs';
COMMENT ON COLUMN user_score.kpi_breakdown IS 'JSON breakdown of scores per KPI category';
COMMENT ON COLUMN user_score.incentive_amount IS 'Calculated incentive based on score band';

-- Example kpi_breakdown structure:
-- {
--   "ATTENDANCE_PUNCTUALITY": 23,
--   "BILLING_CASH": 25,
--   "STOCK_EXPIRY": 18,
--   "CUSTOMER_SERVICE": 20,
--   "TEAMWORK": 9
-- }
```

---

## UPDATED PAYROLL CALCULATION LOGIC

### TypeScript Service Update

```typescript
export class PayrollCalculationService {

  async calculateKPIIncentive(
    userId: number,
    year: number,
    month: number
  ): Promise<number> {

    // 1. Get employee salary structure
    const salaryStructure = await this.employeeSalaryStructureRepository.findOne({
      where: { userId, active: true }
    });

    if (!salaryStructure || !salaryStructure.kpiEligible) {
      return 0;
    }

    // 2. Get monthly KPI score
    const userScore = await this.userScoreRepository.findOne({
      where: {
        userId,
        scorePeriod: 'MONTHLY',
        scoreDate: new Date(year, month - 1, 1)
      }
    });

    if (!userScore) {
      return 0;
    }

    const totalScore = userScore.totalScore || 0;

    // 3. Determine payout based on score band (from JSON config)
    const payoutBands = salaryStructure.kpiPayoutBands as any;

    let incentiveAmount = 0;

    if (totalScore >= 90) {
      incentiveAmount = payoutBands['90-100'] || 0;
    } else if (totalScore >= 75) {
      incentiveAmount = payoutBands['75-89'] || 0;
    } else if (totalScore >= 60) {
      incentiveAmount = payoutBands['60-74'] || 0;
    } else if (totalScore >= 50) {
      incentiveAmount = payoutBands['50-59'] || 0;
    } else {
      incentiveAmount = payoutBands['below-50'] || 0;
    }

    return incentiveAmount;
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

    // Components based on salary level
    let hra = 0;
    let da = 0;
    let conveyance = 0;
    let foodMeal = 0;
    let special = 0;

    if (salaryStructure.salaryLevel === 'ASSOCIATE') {
      hra = salaryStructure.hra;
      conveyance = salaryStructure.conveyanceAllowance;
      foodMeal = salaryStructure.foodMealAllowance;
      special = salaryStructure.specialAllowance;
    } else if (salaryStructure.salaryLevel === 'SENIOR') {
      da = salaryStructure.dearnessAllowance;
    }

    // KPI Incentive (calculated from score)
    const kpiIncentive = await this.calculateKPIIncentive(employee.id, year, month);

    const grossSalary = basic + hra + da + conveyance + foodMeal + special + kpiIncentive;

    return {
      basic,
      hra,
      da,
      conveyance,
      foodMeal,
      special,
      kpiIncentive,
      grossSalary
    };
  }
}
```

---

## CORRECTED PAYROLL_DETAIL SCHEMA

```sql
CREATE TABLE public.payroll_detail (
    id SERIAL4 PRIMARY KEY,
    payroll_run_id INT4 NOT NULL,
    user_id INT4 NOT NULL,

    -- Period Info
    year INT NOT NULL,
    month INT NOT NULL,
    salary_level VARCHAR(20) NOT NULL,
    working_days INT NOT NULL,
    present_days DECIMAL(4,1) NOT NULL,
    paid_leave_days DECIMAL(4,1) DEFAULT 0,
    lwp_days DECIMAL(4,1) DEFAULT 0,

    -- Fixed Earnings (role-dependent)
    basic_salary DECIMAL(10,2) NOT NULL,
    hra DECIMAL(10,2) DEFAULT 0,
    dearness_allowance DECIMAL(10,2) DEFAULT 0,
    conveyance_allowance DECIMAL(10,2) DEFAULT 0,
    food_meal_allowance DECIMAL(10,2) DEFAULT 0,
    special_allowance DECIMAL(10,2) DEFAULT 0,

    -- Variable Earnings
    kpi_incentive DECIMAL(10,2) DEFAULT 0,
    other_allowances DECIMAL(10,2) DEFAULT 0,

    gross_salary DECIMAL(10,2) NOT NULL,

    -- Deductions (same as before)
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
    kpi_breakdown JSONB, -- Score breakdown per category

    -- Payment Status
    payment_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
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
    )),
    CONSTRAINT payroll_detail_salary_level_check CHECK (salary_level IN ('ASSOCIATE', 'SENIOR', 'MANAGER', 'OTHER'))
);

COMMENT ON TABLE payroll_detail IS 'Individual employee payroll records matching actual pay structure';
```

---

## KEY TAKEAWAYS

### ✅ What to Keep from Original Design:
1. Overall database structure (payroll_run, payroll_detail, payment_request, etc.)
2. Workflow states and approval process
3. Statutory deduction logic (PF, ESI, PT, TDS)
4. Attendance integration concept
5. Transaction management and audit trail

### ❌ What to Change:
1. **Salary components** - use actual allowances (Conveyance, Food/Meal for Associate; only DA for Senior)
2. **KPI calculation** - use score-based fixed amounts, not percentage-based
3. **KPI categories** - implement role-specific operational KPIs
4. **Remove overtime** - not part of actual structure
5. **Add insurance reimbursement** - PMJJBY/PMSBY benefit
6. **Role-based structure** - Associate and Senior have DIFFERENT component structures

---

## IMPLEMENTATION PRIORITY

### Phase 1: Core Schema Corrections
1. ✅ Update `employee_salary_structure` table
2. ✅ Create `kpi_category_master` table
3. ✅ Update `user_score` table
4. ✅ Update `payroll_detail` table

### Phase 2: Service Logic Updates
1. ✅ Update KPI incentive calculation (score-based, not grade-based)
2. ✅ Update earnings calculation (role-specific components)
3. ✅ Add insurance reimbursement tracking

### Phase 3: Frontend Updates
1. ✅ Update salary structure forms (role-specific fields)
2. ✅ Update payslip display (show correct components)
3. ✅ Update KPI scoring interface (category-based)

---

## CONCLUSION

The **fundamental approach** of the payroll design is CORRECT:
- ✅ Fixed + Variable structure
- ✅ KPI-based incentives
- ✅ Attendance integration
- ✅ Statutory compliance
- ✅ Payment workflow

But the **specific implementation details** need significant updates to match the actual pay structure used by Ramesh Generic Pharmacy.

**Next Step**: Implement Phase 1 schema corrections with the updated database structure.
