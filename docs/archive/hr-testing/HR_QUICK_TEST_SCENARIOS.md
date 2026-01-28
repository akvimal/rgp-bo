# HR Module - Quick Test Scenarios

## 🚀 Quick Start (5 Minutes)

### Scenario 1: Create & Enroll (Admin)
```
Login → HR → Benefits → Add Policy → Enrollments → Bulk Enroll
Time: 5 minutes
```

### Scenario 2: Acknowledge & Enroll (Employee)
```
Login → My Policies → Acknowledge All → Enroll in Benefits → Select Benefit → Submit
Time: 5 minutes
```

### Scenario 3: Submit & Approve Claim
```
Employee: Submit Claim → Upload Docs
Admin: Claims → Review → Approve → Mark Paid
Time: 5 minutes
```

---

## 📋 Test Scenarios by Role

### 👨‍💼 HR Admin Tests

| # | Scenario | Steps | Time |
|---|----------|-------|------|
| 1 | Create HR Policy | Policies → Add → Fill Form → Save | 2 min |
| 2 | Create Benefit Policy | Benefits → Add → Configure → Save | 3 min |
| 3 | Bulk Enroll Employees | Enrollments → Bulk → Select Users → Enroll | 2 min |
| 4 | Approve Claim | Claims → Pending → Review → Approve → Amount → Save | 3 min |
| 5 | Process Payment | Claims → Approved → Pay → Payment Details → Save | 2 min |

### 👨‍💻 Employee Tests

| # | Scenario | Steps | Time |
|---|----------|-------|------|
| 1 | Acknowledge Policy | My Policies → Select → Read → Acknowledge | 1 min |
| 2 | Browse Benefits | Enroll in Benefits → View All → Click Details | 2 min |
| 3 | Enroll in Benefit | Select Benefit → Add Dependents → Nominee → Submit | 5 min |
| 4 | Submit Claim | Submit Claim → Select Benefit → Fill Details → Upload → Submit | 5 min |
| 5 | Track Claim | My Claims → Click Claim → View Status & Remarks | 1 min |

---

## 🎯 Top 10 Critical Test Cases

### 1. End-to-End Medical Insurance Flow
```
Admin: Create Medical Insurance Policy
Employee: Enroll with Family Coverage
Employee: Submit Medical Claim
Admin: Review & Approve
Finance: Process Payment
Employee: Verify Payment Received
```
**Expected**: Complete flow without errors
**Time**: 20 minutes

---

### 2. Mandatory Policy Acknowledgment
```
Admin: Create Mandatory Policy
Employee: Login → See Pending Policies Alert
Employee: Acknowledge All Mandatory Policies
Admin: Verify 100% Compliance
```
**Expected**: Compliance tracked, audit trail maintained
**Time**: 5 minutes

---

### 3. Bulk Enrollment (EPF for All)
```
Admin: Select EPF Benefit Policy
Admin: Select All Active Employees
Admin: Set as Mandatory, Auto-Approve
Admin: Submit Bulk Enrollment
Verify: All employees enrolled automatically
```
**Expected**: All enrollments ACTIVE status
**Time**: 3 minutes

---

### 4. Claim Rejection Workflow
```
Employee: Submit Claim for Non-Covered Expense
Admin: Review Claim
Admin: Reject with Detailed Reason
Employee: View Rejection Reason
Employee: Understand Next Steps
```
**Expected**: Clear rejection communication
**Time**: 5 minutes

---

### 5. Family Coverage Enrollment
```
Employee: Select Family Medical Plan
Employee: Add Spouse + 2 Children
Employee: Set Nominee (Spouse 100%)
Employee: Submit Enrollment
Admin: Verify Dependent Details
Admin: Approve Enrollment
```
**Expected**: All dependents saved correctly
**Time**: 10 minutes

---

### 6. Claim Amount Adjustment
```
Employee: Claim ₹10,000
Admin: Review Bills
Admin: Approve ₹8,500 (Apply Deductible ₹1,500)
Admin: Add Clear Remarks
Employee: View Approved Amount & Reason
```
**Expected**: Adjustment clearly explained
**Time**: 5 minutes

---

### 7. Multiple Claims Same Month
```
Employee: Submit 3 Claims in January
Admin: Review All 3
Admin: Approve 2, Reject 1
Finance: Process 2 Payments
Employee: Verify Statuses
```
**Expected**: Each claim tracked independently
**Time**: 15 minutes

---

### 8. Policy Update & Re-acknowledgment
```
Admin: Update WFH Policy to Version 2
Admin: Flag for Re-acknowledgment
Employee: See "Policy Updated" Alert
Employee: Review Changes
Employee: Re-acknowledge
```
**Expected**: Version control maintained
**Time**: 5 minutes

---

### 9. Enrollment Effective Date
```
Admin: Create Enrollment with Future Effective Date
Verify: Status = PENDING until Effective Date
Wait/Simulate: Reach Effective Date
Verify: Status = ACTIVE automatically
```
**Expected**: Date-based status change
**Time**: 5 minutes (or use date simulation)

---

### 10. Claim Document Upload
```
Employee: Start Claim Submission
Employee: Upload Multiple Files (PDF + Images)
Employee: Verify Upload Success
Employee: Submit Claim
Admin: View All Uploaded Documents
Admin: Download and Verify Files
```
**Expected**: All file types supported, download works
**Time**: 5 minutes

---

## 🔥 Negative Test Cases

### N1: Duplicate Enrollment Prevention
```
Employee: Enroll in Medical Insurance
Wait: Enrollment Approved
Employee: Try to Enroll Again in Same Benefit
Expected: ❌ Error "Already Enrolled"
```

### N2: Claim Without Active Enrollment
```
Employee: Cancel Medical Enrollment
Employee: Try to Submit Claim
Expected: ❌ Error "No Active Enrollment"
```

### N3: Invalid Dependent Age
```
Employee: Add 30-year-old Child
Policy: Max child age = 25
Expected: ❌ Validation Error
```

### N4: Claim Date Before Enrollment
```
Enrollment: Feb 1, 2026
Claim Incident: Jan 15, 2026
Expected: ❌ Error "Date Before Enrollment"
```

### N5: Exceed Annual Claim Limit
```
Policy: 5 claims per year max
Employee: Submit 6th claim in same year
Expected: ❌ Error "Claim Limit Exceeded"
```

### N6: Missing Required Documents
```
Employee: Submit Claim
Employee: Skip Document Upload
Expected: ❌ Validation "Documents Required"
```

### N7: Claim Exceeds Coverage
```
Policy: ₹3,00,000 coverage
Claim: ₹5,00,000
Expected: ⚠️ Warning, Allow with Flag for Review
```

### N8: Policy Code Duplication
```
Admin: Create Policy with Code "WFH"
Code: Already exists
Expected: ❌ Error "Policy Code Must Be Unique"
```

---

## 📊 Performance Test Scenarios

### P1: 50 Concurrent Enrollments
```bash
# Use JMeter/Postman to simulate
50 employees enrolling simultaneously
Expected: All succeed, < 3 sec response time
```

### P2: 1000 Claims Search
```
Create 1000 test claims
Apply filters + sorting
Expected: Results in < 1 second
```

### P3: Dashboard with Large Data
```
1000 enrollments + 500 claims
Load HR Dashboard
Expected: < 3 seconds load time
```

---

## 🔄 Integration Test Scenarios

### I1: Payroll Deduction Integration
```sql
-- Get active enrollments
SELECT SUM(employee_contribution_amount) as total_deductions
FROM employee_benefit_enrollment e
JOIN benefit_policy bp ON e.benefit_policy_id = bp.id
WHERE e.status = 'ACTIVE';

-- Verify in payroll
Expected: Deductions match enrollments
```

### I2: Claim Reimbursement Flow
```
Month 1: Claims approved
Month 2: Export approved claims
Month 2: Add to payroll credits
Month 2: Process payroll
Month 2: Mark claims as PAID
Expected: Employees receive reimbursement
```

### I3: Performance-Based Benefits
```
Annual Review: High performers identified
HR: Offer premium benefits
Employees: Accept/Enroll
System: Activate premium benefits
Expected: Benefits linked to performance
```

---

## 🎨 UI/UX Test Checklist

- [ ] All forms have proper validation
- [ ] Error messages are clear and helpful
- [ ] Success messages confirm actions
- [ ] Loading indicators show progress
- [ ] Tables are sortable and filterable
- [ ] Pagination works correctly
- [ ] Buttons are disabled during submission
- [ ] Responsive design works on mobile
- [ ] Icons and badges are meaningful
- [ ] Colors indicate status correctly

---

## 🐛 Common Issues to Check

### Database
- [ ] All foreign keys enforce correctly
- [ ] Unique constraints prevent duplicates
- [ ] Indexes improve query performance
- [ ] Transactions rollback on error
- [ ] Timestamps update automatically

### Backend
- [ ] APIs return proper HTTP status codes
- [ ] Validation errors are descriptive
- [ ] Null values handled gracefully
- [ ] Date formats consistent (YYYY-MM-DD)
- [ ] Decimal precision correct (2 places)

### Frontend
- [ ] No console errors
- [ ] Date pickers work correctly
- [ ] File uploads show progress
- [ ] Forms reset after submission
- [ ] Navigation works smoothly

---

## 📈 Test Data Generation

### Quick SQL to Create Test Data

```sql
-- Create 10 test employees
INSERT INTO app_user (email, full_name, password, role_id, active)
SELECT
  'employee' || generate_series || '@test.com',
  'Test Employee ' || generate_series,
  '$2b$10$YourHashedPasswordHere',
  2,
  true
FROM generate_series(1, 10);

-- Bulk enroll in medical insurance
INSERT INTO employee_benefit_enrollment (
  user_id, benefit_policy_id, enrollment_date,
  enrollment_type, status, effective_from,
  created_by, updated_by
)
SELECT
  id as user_id,
  1 as benefit_policy_id,
  CURRENT_DATE,
  'AUTO',
  'ACTIVE',
  CURRENT_DATE,
  2,
  2
FROM app_user
WHERE email LIKE 'employee%@test.com';

-- Create test claims
INSERT INTO benefit_claim (
  enrollment_id, user_id, benefit_policy_id,
  claim_number, claim_type, claimed_amount,
  description, status, created_by, updated_by
)
SELECT
  e.id,
  e.user_id,
  e.benefit_policy_id,
  'CLM2026' || LPAD(generate_series::text, 6, '0'),
  'REIMBURSEMENT',
  (random() * 10000 + 1000)::numeric(10,2),
  'Test medical claim ' || generate_series,
  'SUBMITTED',
  e.user_id,
  e.user_id
FROM employee_benefit_enrollment e
CROSS JOIN generate_series(1, 5)
WHERE e.status = 'ACTIVE';
```

---

## 🎯 Test Execution Priority

### Priority 1 (Must Test)
1. ✅ Policy acknowledgment workflow
2. ✅ Benefit enrollment (manual & bulk)
3. ✅ Claim submission & approval
4. ✅ Payment processing

### Priority 2 (Should Test)
1. ✅ Policy CRUD operations
2. ✅ Benefit policy configuration
3. ✅ Enrollment approval workflow
4. ✅ Claim rejection workflow
5. ✅ Filter and search features

### Priority 3 (Nice to Test)
1. ✅ Policy versioning
2. ✅ Dependent management
3. ✅ Nominee updates
4. ✅ Document download
5. ✅ Report generation

---

## 📞 Quick Commands

### Check Service Status
```bash
docker-compose ps
```

### View Logs
```bash
docker logs rgp-bo-api-1 -f        # Backend
docker logs rgp-bo-frontend-1 -f   # Frontend
```

### Database Query
```bash
docker exec rgp-db psql -U rgpapp -d rgpdb -c "SELECT COUNT(*) FROM benefit_claim;"
```

### Rebuild Frontend
```bash
docker-compose build frontend
docker-compose up -d frontend
```

---

## 🎉 Success Metrics

After testing, verify:

- [ ] **0 Console Errors**: No JavaScript errors
- [ ] **100% CRUD**: All create/read/update/delete work
- [ ] **All Workflows Complete**: End-to-end flows successful
- [ ] **Validation Works**: Invalid data rejected
- [ ] **Performance Acceptable**: < 3 sec page loads
- [ ] **Data Integrity**: No orphaned records
- [ ] **Audit Trail**: All actions logged
- [ ] **User Experience**: Intuitive and clear

---

**Happy Testing!** 🚀

For detailed scenarios, see: `HR_MODULE_TESTING_FLOWS.md`
