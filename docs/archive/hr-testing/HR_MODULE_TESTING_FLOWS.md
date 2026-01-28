# HR Module - Complete Testing Flows

## Table of Contents
1. [Test Data Setup](#test-data-setup)
2. [Admin User Flows](#admin-user-flows)
3. [Employee User Flows](#employee-user-flows)
4. [Integration Scenarios](#integration-scenarios)
5. [Edge Cases & Error Handling](#edge-cases--error-handling)
6. [Performance Testing](#performance-testing)

---

## Test Data Setup

### Prerequisites

**Application URL**: http://localhost:8000

**Default Admin Account**:
- Email: `admin@rgp.com`
- Password: `admin123`

### Step 1: Create Test Users

Login as admin and create the following test users:

```sql
-- Create test users (run in database)
INSERT INTO app_user (email, full_name, password, role_id, active, created_on, updated_on)
VALUES
  ('manager@rgp.com', 'Test Manager', '$2b$10$...', 3, true, NOW(), NOW()),
  ('employee1@rgp.com', 'John Employee', '$2b$10$...', 2, true, NOW(), NOW()),
  ('employee2@rgp.com', 'Jane Employee', '$2b$10$...', 2, true, NOW(), NOW()),
  ('hr.admin@rgp.com', 'HR Admin', '$2b$10$...', 1, true, NOW(), NOW());
```

**Or use the password utility**:
```bash
cd util
node password-util.js password123
# Copy the hash and use in INSERT statement
```

### Step 2: Verify Seed Data

```sql
-- Verify policies
SELECT policy_code, policy_name, is_mandatory FROM hr_policy_master;

-- Verify benefit types
SELECT benefit_code, benefit_name, benefit_category FROM benefit_master;

-- Verify benefit policies
SELECT id, policy_name, coverage_amount FROM benefit_policy WHERE active = true;
```

**Expected Results**:
- 5 HR Policies (Probation, Notice Period, WFH, Overtime, Dress Code)
- 14 Benefit Types (Medical, PF, HRA, etc.)
- 16 Benefit Policies

---

## Admin User Flows

### Flow 1: HR Policy Management

#### Use Case 1.1: Create New HR Policy

**Persona**: HR Admin
**Objective**: Create a new company policy

**Steps**:
1. Login as `admin@rgp.com`
2. Navigate to **Human Resources** → **Policies**
3. Click **"Add New Policy"** button
4. Fill in the form:
   - Policy Code: `REMOTE_WORK`
   - Policy Name: `Remote Work Policy`
   - Category: `ATTENDANCE`
   - Description: `Guidelines for remote work arrangement`
   - Policy Content (JSON):
     ```json
     {
       "allowedDays": 2,
       "frequency": "per week",
       "approvalRequired": true,
       "tools": ["VPN", "Laptop", "Communication tools"]
     }
     ```
   - Version: `1`
   - Mandatory: `No`
   - Requires Acknowledgment: `Yes`
   - Effective From: `2026-01-15`
   - Active: `Yes`

5. Click **"Save"**

**Expected Results**:
- ✅ Success message displayed
- ✅ New policy appears in the list
- ✅ Policy code is unique (cannot duplicate)

**Verification**:
```sql
SELECT * FROM hr_policy_master WHERE policy_code = 'REMOTE_WORK';
```

---

#### Use Case 1.2: Edit Existing Policy

**Steps**:
1. From Policies list, find "Work From Home Policy"
2. Click **Edit** icon
3. Update policy content:
   ```json
   {
     "maxDaysPerWeek": 3,
     "priorApproval": true,
     "internetSpeed": "minimum 10 Mbps required"
   }
   ```
4. Increment version to `2`
5. Click **"Update"**

**Expected Results**:
- ✅ Policy updated successfully
- ✅ Version incremented
- ✅ Updated date reflects change

---

#### Use Case 1.3: Filter and Search Policies

**Steps**:
1. Use Category filter → Select `EMPLOYMENT`
2. Verify only employment policies shown (Probation, Notice Period)
3. Use Mandatory filter → Select `Yes`
4. Verify only mandatory policies shown
5. Clear filters

**Expected Results**:
- ✅ Filters work correctly
- ✅ Multiple filters combine properly
- ✅ Clear filters resets to all policies

---

### Flow 2: Benefits Management

#### Use Case 2.1: Create New Benefit Type

**Persona**: HR Admin
**Objective**: Add a new benefit category

**Steps**:
1. Navigate to **Human Resources** → **Benefits**
2. Click **"Benefit Types"** tab
3. Click **"Add Benefit Type"**
4. Fill in the form:
   - Benefit Code: `CHILDCARE`
   - Benefit Name: `Child Care Allowance`
   - Category: `ALLOWANCE`
   - Description: `Monthly allowance for child care expenses`
   - Is Statutory: `No`
   - Tax Exempt: `Yes`
   - Max Tax Exempt Amount: `50000` (annual)

5. Click **"Save"**

**Expected Results**:
- ✅ New benefit type created
- ✅ Appears in benefit types list
- ✅ Available for policy creation

---

#### Use Case 2.2: Configure Benefit Policy

**Persona**: HR Admin
**Objective**: Create insurance policy with family coverage

**Steps**:
1. Click **"Benefit Policies"** tab
2. Click **"Add Benefit Policy"**
3. Select benefit type: `Medical Insurance`
4. Fill in policy details:
   - Policy Name: `Family Medical Plan - Premium`
   - Coverage Amount: `500000`
   - Employee Contribution: `2000` per month
   - Employer Contribution: `3000` per month
   - Coverage Type: `FAMILY`
   - Max Dependents: `4`
   - Spouse Coverage: `Yes`
   - Children Coverage: `Yes`
   - Max Children Age: `25`
   - Parents Coverage: `Yes`
   - Max Parents Age: `70`
   - Claim Limit Per Year: `5`
   - Claim Limit Amount: `500000`
   - Pre-existing Coverage Waiting: `2 years`
   - Maternity Coverage: `Yes`
   - Deductible Amount: `5000`

5. Set effective dates:
   - Effective From: `2026-01-15`
   - Effective To: Leave empty (ongoing)

6. Click **"Save"**

**Expected Results**:
- ✅ Policy created successfully
- ✅ All configuration saved correctly
- ✅ Available for employee enrollment

**Verification**:
```sql
SELECT bp.*, bm.benefit_name
FROM benefit_policy bp
JOIN benefit_master bm ON bp.benefit_id = bm.id
WHERE bp.policy_name = 'Family Medical Plan - Premium';
```

---

#### Use Case 2.3: Update Coverage Amounts

**Scenario**: Annual policy review - increase coverage

**Steps**:
1. Find "Basic Medical Plan" in policies list
2. Click **Edit**
3. Update coverage amount from `300000` to `350000`
4. Update employee contribution from `1000` to `1200`
5. Update claim limit from `300000` to `350000`
6. Click **"Update"**

**Expected Results**:
- ✅ Policy updated successfully
- ✅ Existing enrollments continue with old rates (unless renewed)
- ✅ New enrollments use new rates

---

### Flow 3: Enrollment Management

#### Use Case 3.1: Manual Employee Enrollment

**Persona**: HR Admin
**Objective**: Enroll employee in benefit manually

**Steps**:
1. Navigate to **Human Resources** → **Enrollments**
2. Click **"New Enrollment"**
3. Select employee: `John Employee`
4. Select benefit policy: `Basic Medical Plan`
5. Set enrollment details:
   - Enrollment Type: `AUTO` (company-provided)
   - Effective From: `2026-02-01`
   - Nominee Name: `Sarah Employee`
   - Nominee Relationship: `Spouse`
   - Nominee DOB: `1992-05-15`
   - Nominee Percentage: `100`

6. Add dependents:
   - Dependent 1:
     - Name: `Sarah Employee`
     - Relationship: `Spouse`
     - DOB: `1992-05-15`
   - Dependent 2:
     - Name: `Tom Employee`
     - Relationship: `Son`
     - DOB: `2018-03-20`

7. Click **"Enroll"**

**Expected Results**:
- ✅ Enrollment created with status `ACTIVE` (auto-approved for admin)
- ✅ Dependents saved correctly
- ✅ Nominee details recorded

---

#### Use Case 3.2: Bulk Enrollment

**Scenario**: New policy rollout - enroll all eligible employees

**Steps**:
1. From Enrollments page, click **"Bulk Enroll"**
2. Select benefit policy: `EPF Contribution` (mandatory)
3. Select enrollment type: `MANDATORY`
4. Select employees:
   - Check `John Employee`
   - Check `Jane Employee`
   - Check `Test Manager`

5. Set effective date: `2026-02-01`
6. Click **"Bulk Enroll"**

**Expected Results**:
- ✅ Success message with count: "3 employees enrolled successfully"
- ✅ All enrollments appear in list with status `ACTIVE`
- ✅ Enrollment type set to `MANDATORY`

**Verification**:
```sql
SELECT u.full_name, bp.policy_name, e.status, e.enrollment_type
FROM employee_benefit_enrollment e
JOIN app_user u ON e.user_id = u.id
JOIN benefit_policy bp ON e.benefit_policy_id = bp.id
WHERE bp.id = (SELECT id FROM benefit_policy WHERE policy_name LIKE '%EPF%' LIMIT 1);
```

---

#### Use Case 3.3: Approve/Reject Enrollment Request

**Scenario**: Employee submitted enrollment request

**Steps**:
1. Filter enrollments by status: `PENDING`
2. Click on pending enrollment
3. Review enrollment details:
   - Employee info
   - Benefit policy
   - Dependents
   - Nominee

4. **Option A - Approve**:
   - Click **"Approve"**
   - Add remarks: `Approved - All documents verified`
   - Click **"Confirm"**

5. **Option B - Reject**:
   - Click **"Reject"**
   - Enter reason: `Missing marriage certificate for spouse coverage`
   - Click **"Confirm"**

**Expected Results**:
- ✅ Status updated to `ACTIVE` (approved) or `CANCELLED` (rejected)
- ✅ Approval/rejection remarks saved
- ✅ Approved by and date recorded
- ✅ Employee notified (future enhancement)

---

### Flow 4: Claims Management

#### Use Case 4.1: Review Submitted Claim

**Persona**: HR Admin/Manager
**Objective**: Review and approve medical claim

**Steps**:
1. Navigate to **Human Resources** → **Claims**
2. Filter by status: `SUBMITTED`
3. Click on claim to view details
4. Review claim information:
   - Claim number
   - Employee name
   - Benefit policy
   - Claimed amount
   - Incident date
   - Description
   - Uploaded documents (bills, receipts)

5. Click **"Review"**
6. Change status to `UNDER_REVIEW`
7. Add reviewer remarks: `Documents received. Verifying with insurance provider.`
8. Click **"Save Review"**

**Expected Results**:
- ✅ Status changed to `UNDER_REVIEW`
- ✅ Reviewer name and timestamp recorded
- ✅ Remarks saved

---

#### Use Case 4.2: Approve Claim with Adjustment

**Scenario**: Approve claim but reduce amount

**Steps**:
1. Open claim in `UNDER_REVIEW` status
2. Click **"Approve"**
3. Review claimed amount: `₹5,000`
4. Set approved amount: `₹4,500`
5. Enter approval remarks:
   ```
   Approved ₹4,500.
   Deductible of ₹500 applied as per policy terms.
   Insurance claim ID: INS-2026-0123
   ```
6. Click **"Approve"**

**Expected Results**:
- ✅ Status changed to `APPROVED`
- ✅ Approved amount: `₹4,500` (not `₹5,000`)
- ✅ Approval remarks saved
- ✅ Approved by and date recorded
- ✅ Ready for payment processing

**Verification**:
```sql
SELECT
  claim_number,
  status,
  claimed_amount,
  approved_amount,
  approval_remarks,
  approved_by,
  approved_on
FROM benefit_claim
WHERE claim_number = 'CLM202601140001';
```

---

#### Use Case 4.3: Reject Claim

**Scenario**: Invalid claim or insufficient documentation

**Steps**:
1. Open claim
2. Click **"Reject"**
3. Enter rejection reason:
   ```
   Claim rejected - Reason: Treatment not covered under policy.
   Policy covers only hospitalization expenses, not OPD consultation.
   Please refer to policy terms section 4.2.
   ```
4. Click **"Confirm Rejection"**

**Expected Results**:
- ✅ Status changed to `REJECTED`
- ✅ Rejection reason saved
- ✅ Approved amount remains NULL
- ✅ Employee can view rejection reason

---

#### Use Case 4.4: Mark Claim as Paid

**Scenario**: Finance team processed payment

**Steps**:
1. Filter claims by status: `APPROVED`
2. Select claim
3. Click **"Mark as Paid"**
4. Enter payment details:
   - Payment Mode: `BANK_TRANSFER`
   - Payment Reference: `TXN20260115001234`
   - Payment Date: `2026-01-15`
   - Paid Amount: `₹4,500`

5. Click **"Confirm Payment"**

**Expected Results**:
- ✅ Status changed to `PAID`
- ✅ Payment details saved
- ✅ Payment date recorded
- ✅ Claim workflow complete

---

### Flow 5: Multi-Step Admin Workflow

#### Complete Benefit Lifecycle Management

**Scenario**: Launch new wellness program

**Steps**:

1. **Create Benefit Type** (5 min)
   - Code: `GYM_PREMIUM`
   - Name: `Premium Gym Membership`
   - Category: `WELLNESS`

2. **Create Benefit Policy** (10 min)
   - Policy Name: `Platinum Gym Membership 2026`
   - Coverage: `₹24,000/year` (₹2,000/month)
   - Employee Contribution: `₹500/month`
   - Employer Contribution: `₹1,500/month`

3. **Bulk Enrollment** (5 min)
   - Select all employees
   - Enrollment type: `VOLUNTARY`
   - Effective from: Start of next month

4. **Approve Enrollments** (10 min)
   - Review each enrollment request
   - Approve valid requests
   - Reject incomplete requests

5. **Process First Claims** (15 min)
   - Review gym fee reimbursement claims
   - Verify payment receipts
   - Approve valid claims
   - Process payments

**Total Time**: ~45 minutes
**Expected Outcome**: Complete benefit program from creation to payment

---

## Employee User Flows

### Flow 6: Employee Self-Service

#### Use Case 6.1: View and Acknowledge HR Policies

**Persona**: New Employee
**Objective**: Review and acknowledge company policies

**Steps**:
1. Login as `employee1@rgp.com`
2. Navigate to **Human Resources** → **My Policies**
3. See list of applicable policies:
   - Probation Period Policy (Mandatory) - ⚠️ Pending Acknowledgment
   - Notice Period Policy (Mandatory) - ⚠️ Pending Acknowledgment
   - Dress Code Policy (Mandatory) - ⚠️ Pending Acknowledgment
   - Work From Home Policy (Optional)
   - Overtime Policy (Optional)

4. Click on **"Probation Period Policy"**
5. Read policy details and content
6. Click **"Acknowledge"**
7. Confirm: `I have read and understood this policy`
8. Submit acknowledgment

**Expected Results**:
- ✅ Policy marked as acknowledged
- ✅ Acknowledgment timestamp recorded
- ✅ Digital signature method recorded
- ✅ Policy content snapshot saved
- ✅ Badge/indicator shows "Acknowledged"

**Repeat for all mandatory policies**

**Verification**:
```sql
SELECT
  u.full_name,
  p.policy_name,
  a.acknowledged_on,
  a.acknowledgment_method
FROM hr_policy_acknowledgment a
JOIN app_user u ON a.user_id = u.id
JOIN hr_policy_master p ON a.policy_id = p.id
WHERE u.email = 'employee1@rgp.com';
```

---

#### Use Case 6.2: Browse Available Benefits

**Persona**: Employee during open enrollment
**Objective**: Explore benefit options

**Steps**:
1. Navigate to **Human Resources** → **Enroll in Benefits**
2. Browse available benefit policies:
   - View benefit categories (Insurance, Allowances, etc.)
   - See coverage amounts
   - Check contribution amounts
   - Review eligibility criteria

3. Click on **"Family Medical Plan - Premium"**
4. Review details:
   - Coverage: ₹5,00,000
   - Employee pays: ₹2,000/month
   - Employer pays: ₹3,000/month
   - Family coverage included
   - Max 4 dependents
   - Claim limit: 5 per year

5. Calculate total cost:
   - Annual employee cost: ₹24,000
   - Annual employer cost: ₹36,000
   - Net benefit value: ₹60,000

**Expected Results**:
- ✅ All active policies visible
- ✅ Policy details clear and comprehensive
- ✅ Cost breakdown visible
- ✅ Eligibility criteria shown

---

#### Use Case 6.3: Enroll in Benefit

**Scenario**: Employee enrolls in medical insurance with family

**Steps**:
1. From available benefits, select **"Basic Medical Plan"**
2. Click **"Enroll Now"**
3. Select enrollment type: `VOLUNTARY`
4. Add dependents:
   - **Dependent 1**:
     - Name: `Sarah Employee`
     - Relationship: `Spouse`
     - DOB: `1992-05-15`
     - Gender: `Female`

   - **Dependent 2**:
     - Name: `Tom Employee`
     - Relationship: `Son`
     - DOB: `2018-03-20`
     - Gender: `Male`

5. Add nominee details:
   - Nominee Name: `Sarah Employee`
   - Relationship: `Spouse`
   - DOB: `1992-05-15`
   - Contact: `+91 9876543210`
   - Percentage: `100%`

6. Review enrollment summary:
   - Benefit: Basic Medical Plan
   - Coverage: ₹3,00,000
   - Monthly deduction: ₹1,000
   - Dependents: 2 (Spouse, 1 Child)
   - Nominee: Sarah Employee (100%)

7. Confirm and submit enrollment

**Expected Results**:
- ✅ Enrollment created with status `PENDING` (awaiting approval)
- ✅ Confirmation message displayed
- ✅ Enrollment appears in "My Benefits"
- ✅ Email notification sent (future)

**Verification**:
```sql
SELECT
  e.id,
  e.status,
  e.dependents,
  e.nominee_name,
  bp.policy_name
FROM employee_benefit_enrollment e
JOIN benefit_policy bp ON e.benefit_policy_id = bp.id
WHERE e.user_id = (SELECT id FROM app_user WHERE email = 'employee1@rgp.com');
```

---

#### Use Case 6.4: View My Benefits

**Persona**: Employee
**Objective**: Check enrolled benefits

**Steps**:
1. Navigate to **Human Resources** → **My Benefits**
2. View enrolled benefits:
   - **Active Enrollments**:
     - Basic Medical Plan (Active since Feb 1, 2026)
     - EPF Contribution (Mandatory)

   - **Pending Enrollments**:
     - Family Medical Plan - Premium (Pending Approval)

3. Click on **"Basic Medical Plan"** to view details:
   - Coverage amount
   - Monthly deduction
   - Enrollment date
   - Dependents covered
   - Nominee information
   - Claim history

4. Check contribution summary:
   - Employee contribution: ₹1,000/month
   - Employer contribution: ₹2,000/month
   - Total benefit value: ₹3,000/month

**Expected Results**:
- ✅ All enrollments displayed
- ✅ Status clearly indicated
- ✅ Complete benefit details visible
- ✅ Contribution breakdown shown

---

#### Use Case 6.5: Submit Claim

**Scenario**: Employee had medical expenses, submitting reimbursement

**Steps**:
1. Navigate to **Human Resources** → **Submit Claim**
2. Select enrolled benefit: `Basic Medical Plan`
3. View enrollment details:
   - Coverage: ₹3,00,000
   - Enrolled on: Feb 1, 2026
   - Status: Active

4. Fill claim details:
   - Claim Type: `REIMBURSEMENT`
   - Incident Date: `2026-01-10`
   - Claimed Amount: `₹8,500`
   - Description:
     ```
     Medical consultation and treatment for viral fever
     - Consultation: ₹1,500
     - Medicines: ₹2,000
     - Lab tests: ₹5,000
     Total: ₹8,500
     ```

5. Upload documents:
   - Doctor's prescription (PDF)
   - Medical bills (PDF)
   - Lab reports (PDF)
   - Pharmacy receipts (Images)

6. Review claim summary
7. Click **"Submit Claim"**

**Expected Results**:
- ✅ Claim created with unique claim number (e.g., CLM202601150001)
- ✅ Status: `SUBMITTED`
- ✅ Documents uploaded successfully
- ✅ Confirmation message with claim number
- ✅ Claim appears in "My Claims"

**Verification**:
```sql
SELECT
  c.claim_number,
  c.status,
  c.claimed_amount,
  c.description,
  c.submitted_date,
  bp.policy_name
FROM benefit_claim c
JOIN benefit_policy bp ON c.benefit_policy_id = bp.id
WHERE c.user_id = (SELECT id FROM app_user WHERE email = 'employee1@rgp.com')
ORDER BY c.submitted_date DESC;
```

---

#### Use Case 6.6: Track Claim Status

**Persona**: Employee
**Objective**: Monitor claim approval and payment

**Steps**:
1. Navigate to **Human Resources** → **My Claims**
2. View claims list with statuses:
   - CLM202601150001 - `UNDER_REVIEW` - ₹8,500
   - CLM202601050001 - `PAID` - ₹5,000 (approved: ₹4,500)

3. Click on **"CLM202601150001"** to view details:
   - Status: Under Review
   - Submitted on: Jan 15, 2026
   - Claimed amount: ₹8,500
   - Reviewer: HR Admin
   - Reviewer remarks: "Documents received. Verifying with insurance provider."

4. Check claim timeline:
   - ✅ Submitted: Jan 15, 2026 10:30 AM
   - ✅ Under Review: Jan 15, 2026 2:15 PM (by HR Admin)
   - ⏳ Approved: Pending
   - ⏳ Paid: Pending

5. View uploaded documents
6. Download documents if needed

**Expected Results**:
- ✅ Current status clearly visible
- ✅ Timeline shows progress
- ✅ Reviewer remarks visible
- ✅ Documents accessible
- ✅ Status updates in real-time

---

#### Use Case 6.7: View Paid Claims

**Scenario**: Check payment history

**Steps**:
1. Filter claims by status: `PAID`
2. Click on paid claim: **CLM202601050001**
3. View complete claim details:
   - Claimed: ₹5,000
   - Approved: ₹4,500
   - Paid: ₹4,500
   - Payment mode: Bank Transfer
   - Payment reference: TXN20260115001234
   - Payment date: Jan 15, 2026
   - Approval remarks: "Approved ₹4,500. Deductible of ₹500 applied."

4. Download payment receipt (future feature)

**Expected Results**:
- ✅ Full claim lifecycle visible
- ✅ Payment details complete
- ✅ Amount differences explained (deductible)
- ✅ Transaction reference available

---

### Flow 7: Employee Multi-Step Workflow

#### Complete Employee Onboarding to First Claim

**Scenario**: New employee joins and uses benefits

**Timeline**: Month 1-3

**Month 1: Onboarding**
1. Day 1: Login first time
2. Day 1: Acknowledge all mandatory policies (15 min)
3. Day 2: Browse available benefits (10 min)
4. Day 7: Enroll in medical insurance (20 min)
5. Day 10: Enrollment approved by HR
6. Week 2: Receive benefit confirmation

**Month 2: Active Enrollment**
1. Coverage becomes active (Feb 1)
2. View active benefits in dashboard
3. Check monthly deductions in payroll
4. Review benefit details

**Month 3: First Claim**
1. Incur medical expense
2. Collect bills and documents
3. Submit claim (15 min)
4. Track claim status daily
5. Receive approval notification
6. Get reimbursement in next payroll

**Total Employee Effort**: ~1.5 hours
**Time to First Benefit**: 1 month
**Time to First Reimbursement**: 3 months

---

## Integration Scenarios

### Flow 8: Cross-Module Integration

#### Use Case 8.1: Benefits + Payroll Integration

**Scenario**: Monthly payroll processing with benefit deductions

**Steps**:

1. **HR Admin**: Review active enrollments
   ```sql
   SELECT
     u.full_name,
     bp.policy_name,
     bp.employee_contribution_amount,
     e.status
   FROM employee_benefit_enrollment e
   JOIN app_user u ON e.user_id = u.id
   JOIN benefit_policy bp ON e.benefit_policy_id = bp.id
   WHERE e.status = 'ACTIVE'
   AND e.effective_from <= CURRENT_DATE
   AND (e.effective_to IS NULL OR e.effective_to >= CURRENT_DATE);
   ```

2. **Finance**: Export deduction report
   - Total employees: 10
   - Total deductions: ₹15,000
   - Breakdown by benefit type

3. **Payroll**: Apply deductions
   - Medical insurance: ₹1,000/employee
   - EPF: 12% of basic
   - Professional tax: As applicable

4. **Verification**: Check payslips
   - Deductions match enrollment
   - Employer contributions recorded

**Expected Results**:
- ✅ All active enrollments processed
- ✅ Deductions accurate
- ✅ Employer contributions tracked
- ✅ Payslip shows benefit details

---

#### Use Case 8.2: Claims + Payroll Reimbursement

**Scenario**: Process approved claims in payroll

**Steps**:

1. **HR**: Filter approved claims for current month
   ```sql
   SELECT
     u.full_name,
     c.claim_number,
     c.approved_amount,
     bp.policy_name
   FROM benefit_claim c
   JOIN app_user u ON c.user_id = u.id
   JOIN benefit_policy bp ON c.benefit_policy_id = bp.id
   WHERE c.status = 'APPROVED'
   AND c.approved_on >= '2026-01-01'
   AND c.approved_on < '2026-02-01'
   ORDER BY u.full_name;
   ```

2. **Export reimbursement list**
   - John Employee: ₹4,500
   - Jane Employee: ₹3,200
   - Test Manager: ₹6,000
   - **Total**: ₹13,700

3. **Finance**: Process payments
   - Add to payroll credits
   - Or separate NEFT transfers

4. **HR**: Mark claims as paid
   - Update payment reference
   - Update payment date
   - Change status to `PAID`

**Expected Results**:
- ✅ All approved claims paid
- ✅ Payment references recorded
- ✅ Employees receive reimbursement
- ✅ Claims closed successfully

---

#### Use Case 8.3: Performance + Benefits Eligibility

**Scenario**: Performance-based benefit upgrades

**Steps**:

1. **HR**: Review annual performance scores
2. **Identify high performers** (Grade A/A+)
3. **Offer premium benefits**:
   - Upgrade to Family Medical Plan - Premium
   - Add gym membership
   - Increase HRA

4. **Send enrollment invitations**
5. **Process enrollments**
6. **Update benefit levels**

**Expected Results**:
- ✅ Performance-linked benefits
- ✅ Employee retention tool
- ✅ Automated eligibility check

---

### Flow 9: Policy Compliance Workflow

#### Use Case 9.1: Policy Update Notification

**Scenario**: Policy updated, employees need to re-acknowledge

**Steps**:

1. **HR Admin**: Update policy
   - Edit "Work From Home Policy"
   - Increment version to `2`
   - Update content with new guidelines

2. **System**: Flag existing acknowledgments as outdated

3. **Employees**: See notification
   - "Policy updated - Acknowledgment required"
   - Review changes (diff view - future feature)
   - Re-acknowledge updated policy

4. **HR**: Track compliance
   - 80% acknowledged (8/10 employees)
   - 2 pending - send reminders

5. **Generate compliance report**

**Expected Results**:
- ✅ Policy version tracked
- ✅ Re-acknowledgment enforced
- ✅ Compliance tracked
- ✅ Audit trail maintained

---

## Edge Cases & Error Handling

### Flow 10: Error Scenarios

#### Use Case 10.1: Duplicate Enrollment Prevention

**Steps**:
1. Employee tries to enroll in benefit they're already enrolled in
2. System shows error: "You are already enrolled in this benefit"
3. Show current enrollment details
4. Suggest alternative: "Would you like to update your enrollment?"

**Expected**: ✅ Duplicate prevented

---

#### Use Case 10.2: Claim Exceeds Coverage Limit

**Steps**:
1. Employee submits claim for ₹3,50,000
2. Policy coverage: ₹3,00,000
3. System shows warning: "Claimed amount exceeds policy coverage"
4. Allow submission but flag for review
5. HR approves up to coverage limit: ₹3,00,000

**Expected**: ✅ Over-limit handled gracefully

---

#### Use Case 10.3: Enrollment Outside Open Period

**Steps**:
1. Employee tries to enroll outside enrollment window
2. System shows: "Enrollment period closed"
3. Show next enrollment period dates
4. Allow special enrollment for qualifying events:
   - Marriage
   - Childbirth
   - Loss of coverage

**Expected**: ✅ Enrollment period enforced with exceptions

---

#### Use Case 10.4: Claim for Inactive Enrollment

**Steps**:
1. Employee tries to claim against cancelled enrollment
2. System shows error: "This enrollment is not active"
3. Show enrollment status and dates
4. Prevent claim submission

**Expected**: ✅ Invalid claim prevented

---

#### Use Case 10.5: Missing Required Documents

**Steps**:
1. Employee submits claim without documents
2. System shows validation error: "Please upload at least one document"
3. Highlight required document types:
   - Medical bills
   - Prescription
   - Lab reports

**Expected**: ✅ Document validation enforced

---

#### Use Case 10.6: Invalid Dependent Age

**Steps**:
1. Employee adds 28-year-old son as dependent
2. Policy allows children up to age 25
3. System shows error: "Child age exceeds policy limit (25 years)"
4. Remove invalid dependent
5. Continue with valid dependents

**Expected**: ✅ Policy rules enforced

---

#### Use Case 10.7: Claim Date Before Enrollment

**Steps**:
1. Employee enrolled on Feb 1, 2026
2. Tries to claim for Jan 15, 2026 expense
3. System shows error: "Incident date is before enrollment date"
4. Show enrollment effective date
5. Prevent claim submission

**Expected**: ✅ Date validation working

---

## Performance Testing

### Flow 11: Load Testing Scenarios

#### Use Case 11.1: Bulk Operations

**Test**: 100 employees enrolling simultaneously

**Steps**:
1. Create 100 test users
2. Simulate concurrent enrollment requests
3. Measure response time
4. Check for deadlocks or race conditions
5. Verify data integrity

**Success Criteria**:
- ✅ All enrollments processed
- ✅ No duplicates created
- ✅ Response time < 2 seconds
- ✅ No database errors

---

#### Use Case 11.2: Large Dataset Queries

**Test**: Search/filter with 10,000+ records

**Steps**:
1. Create 10,000 test claims
2. Apply multiple filters
3. Sort by different columns
4. Paginate through results
5. Measure query performance

**Success Criteria**:
- ✅ Filters work correctly
- ✅ Query time < 1 second
- ✅ Pagination smooth
- ✅ No timeout errors

---

#### Use Case 11.3: Dashboard Performance

**Test**: Dashboard with complex aggregations

**Steps**:
1. Load HR dashboard with 1000+ enrollments
2. Load 500+ claims
3. Calculate statistics
4. Render charts and graphs
5. Measure total load time

**Success Criteria**:
- ✅ Dashboard loads in < 3 seconds
- ✅ No console errors
- ✅ Charts render correctly
- ✅ Data accurate

---

## Test Execution Checklist

### Pre-Testing
- [ ] Database migration completed
- [ ] Seed data verified
- [ ] Test users created
- [ ] Services running
- [ ] Browser cache cleared

### Admin Flows
- [ ] Policy management (create, edit, archive)
- [ ] Benefit type management
- [ ] Benefit policy configuration
- [ ] Manual enrollment
- [ ] Bulk enrollment
- [ ] Enrollment approval/rejection
- [ ] Claim review
- [ ] Claim approval/rejection
- [ ] Payment processing

### Employee Flows
- [ ] Policy acknowledgment
- [ ] Browse benefits
- [ ] Self-enrollment
- [ ] View my benefits
- [ ] Submit claim
- [ ] Track claim status
- [ ] View payment history

### Integration
- [ ] Payroll deduction integration
- [ ] Claim reimbursement integration
- [ ] Performance-based benefits

### Error Handling
- [ ] Duplicate prevention
- [ ] Validation errors
- [ ] Business rule enforcement
- [ ] Edge cases

### Performance
- [ ] Concurrent operations
- [ ] Large datasets
- [ ] Dashboard load times

---

## Quick Test Script (30 Minutes)

For a quick smoke test, run this 30-minute flow:

1. **Admin** (10 min):
   - Create 1 new policy
   - Create 1 benefit policy
   - Bulk enroll 3 employees
   - Approve 1 claim

2. **Employee** (15 min):
   - Acknowledge 2 policies
   - Enroll in 1 benefit
   - Submit 1 claim
   - Check status

3. **Verification** (5 min):
   - Check database for records
   - Verify no console errors
   - Check all statuses correct

---

## Reporting

After testing, generate reports:

```sql
-- Test Summary Report
SELECT
  'Total Policies' as metric,
  COUNT(*) as value
FROM hr_policy_master
UNION ALL
SELECT
  'Total Benefits',
  COUNT(*)
FROM benefit_master
UNION ALL
SELECT
  'Active Enrollments',
  COUNT(*)
FROM employee_benefit_enrollment
WHERE status = 'ACTIVE'
UNION ALL
SELECT
  'Total Claims',
  COUNT(*)
FROM benefit_claim
UNION ALL
SELECT
  'Paid Claims',
  COUNT(*)
FROM benefit_claim
WHERE status = 'PAID';
```

---

**Testing Complete!** 🎉

For issues or questions, refer to:
- `HR_BENEFITS_POLICIES_TESTING_GUIDE.md`
- `DASHBOARD_FIX_VERIFICATION.md`
