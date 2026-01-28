# HR Module - Workflow Diagrams

Visual representation of all major workflows in the HR Benefits & Policies module.

---

## 📋 Policy Acknowledgment Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     POLICY ACKNOWLEDGMENT FLOW                       │
└─────────────────────────────────────────────────────────────────────┘

HR ADMIN                          EMPLOYEE
    │                                │
    │ 1. Create/Update Policy        │
    ├───────────────────────────────►│
    │                                │ 2. Login & See Alert
    │                                │    "3 Policies Pending"
    │                                │
    │                                │ 3. Navigate to
    │                                │    "My Policies"
    │                                │
    │                                │ 4. View Policy List
    │                                │    ├─ Probation (Mandatory) ⚠️
    │                                │    ├─ Notice Period (Mandatory) ⚠️
    │                                │    └─ WFH (Optional)
    │                                │
    │                                │ 5. Click Policy
    │                                │
    │                                │ 6. Read Policy Content
    │                                │
    │                                │ 7. Click "Acknowledge"
    │                                │
    │ 8. Record Acknowledgment       │◄──────────────────────────
    │    ├─ Digital Signature        │
    │    ├─ Timestamp                │
    │    └─ Policy Snapshot          │
    │                                │
    │                                │ 9. See "Acknowledged" ✓
    │                                │
   ✓ Compliance Tracked             ✓ Policy Acknowledged

DATABASE: hr_policy_acknowledgment table updated
```

---

## 💼 Benefit Enrollment Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BENEFIT ENROLLMENT FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

EMPLOYEE                          HR ADMIN
    │                                │
    │ 1. Browse Benefits             │
    │    "Enroll in Benefits"        │
    │                                │
    │ 2. Select Benefit Policy       │
    │    "Family Medical Plan"       │
    │                                │
    │ 3. Review Details              │
    │    ├─ Coverage: ₹5,00,000      │
    │    ├─ Employee: ₹2,000/mo      │
    │    └─ Employer: ₹3,000/mo      │
    │                                │
    │ 4. Click "Enroll Now"          │
    │                                │
    │ 5. Add Dependents              │
    │    ├─ Spouse: Sarah            │
    │    └─ Child: Tom (Age 8)       │
    │                                │
    │ 6. Add Nominee                 │
    │    └─ Sarah (Spouse) 100%      │
    │                                │
    │ 7. Review & Submit             │
    ├───────────────────────────────►│
    │                                │ 8. Review Enrollment
    │                                │    ├─ Verify documents
    │                                │    ├─ Check eligibility
    │                                │    └─ Validate dependents
    │                                │
    │                                │ 9. DECISION
    │                                │    ├─ Approve ✓
    │                                │    └─ OR Reject ✗
    │                                │
    │◄──────────────────────────────┤ 10. Notify Employee
    │                                │
    │ 11. Check "My Benefits"        │
    │     Status: ACTIVE ✓           │
    │     Effective: Feb 1, 2026     │
    │                                │
   ✓ Enrolled Successfully          ✓ Enrollment Approved

DATABASE: employee_benefit_enrollment table
          Status: PENDING → ACTIVE
```

---

## 🏥 Claims Submission & Approval Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAIMS PROCESSING FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

EMPLOYEE              HR ADMIN              FINANCE
    │                      │                    │
    │ 1. Submit Claim      │                    │
    │    ├─ Medical bills  │                    │
    │    ├─ Amount: ₹8,500 │                    │
    │    └─ Upload docs    │                    │
    ├─────────────────────►│                    │
    │                      │                    │
    │ Status: SUBMITTED    │                    │
    │                      │                    │
    │                      │ 2. Review Claim    │
    │                      │    ├─ Check docs   │
    │                      │    ├─ Verify bills │
    │                      │    └─ Check policy │
    │                      │                    │
    │                      │ Status: UNDER_REVIEW
    │                      │                    │
    │                      │ 3. DECISION        │
    │                      │    ┌─────────┐     │
    │                      │    │ Approve │     │
    │                      │    │ ₹8,500  │     │
    │                      │    │   OR    │     │
    │                      │    │ Reject  │     │
    │                      │    └─────────┘     │
    │                      │                    │
    │                      │ 4. If Approved:    │
    │                      │    ├─ Approved: ₹7,500
    │                      │    ├─ Deductible: ₹1,000
    │                      │    └─ Remarks added
    │◄─────────────────────┤                    │
    │                      │ Status: APPROVED   │
    │                      │                    │
    │ 5. View Approval     │                    │
    │    ├─ Amount: ₹7,500 │                    │
    │    └─ Remarks shown  │                    │
    │                      │                    │
    │                      ├───────────────────►│ 6. Process Payment
    │                      │                    │    ├─ NEFT Transfer
    │                      │                    │    ├─ Reference: TXN...
    │                      │                    │    └─ Date recorded
    │                      │                    │
    │                      │◄───────────────────┤ 7. Mark as PAID
    │                      │    Status: PAID    │
    │                      │                    │
    │◄─────────────────────┤ 8. Notification    │
    │                      │                    │
    │ 9. Check My Claims   │                    │
    │    Status: PAID ✓    │                    │
    │    Amount: ₹7,500    │                    │
    │                      │                    │
   ✓ Reimbursed          ✓ Processed         ✓ Paid

TIMELINE: 5-7 days from submission to payment

DATABASE: benefit_claim table
          Status: SUBMITTED → UNDER_REVIEW → APPROVED → PAID
```

---

## 🔄 Bulk Enrollment Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BULK ENROLLMENT FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

HR ADMIN                          SYSTEM
    │                                │
    │ 1. Select "Bulk Enroll"        │
    │                                │
    │ 2. Choose Benefit Policy       │
    │    "EPF Contribution"          │
    │    (Mandatory for all)         │
    │                                │
    │ 3. Select Employees            │
    │    ☑ John Employee             │
    │    ☑ Jane Employee             │
    │    ☑ Test Manager              │
    │    ☑ ... (100 employees)       │
    │                                │
    │ 4. Set Parameters              │
    │    ├─ Type: MANDATORY          │
    │    ├─ Effective: 2026-02-01    │
    │    └─ Auto-approve: Yes        │
    │                                │
    │ 5. Click "Bulk Enroll"         │
    ├───────────────────────────────►│
    │                                │ 6. Process in Transaction
    │                                │    FOR EACH employee:
    │                                │    ├─ Create enrollment
    │                                │    ├─ Set status: ACTIVE
    │                                │    ├─ Set effective date
    │                                │    └─ Record audit trail
    │                                │
    │                                │ 7. Track Progress
    │                                │    ├─ Processed: 95/100
    │                                │    ├─ Success: 93
    │                                │    ├─ Failed: 2 (already enrolled)
    │                                │    └─ Skipped: 5 (ineligible)
    │                                │
    │◄──────────────────────────────┤ 8. Return Summary
    │                                │
    │ 9. View Results                │
    │    ✓ 93 enrollments created    │
    │    ✗ 2 duplicates prevented    │
    │    ⚠ 5 eligibility issues      │
    │                                │
    │ 10. Review Failed Cases        │
    │     ├─ View error details      │
    │     └─ Manual intervention     │
    │                                │
   ✓ Bulk Operation Complete

TIME: ~2 minutes for 100 employees
ROLLBACK: On any critical error, all enrollments rolled back
```

---

## 📊 Complete Lifecycle - New Employee Onboarding

```
┌─────────────────────────────────────────────────────────────────────┐
│              EMPLOYEE ONBOARDING - MONTH 1 TO 3                      │
└─────────────────────────────────────────────────────────────────────┘

DAY 1: First Login
├─ Employee logs in
├─ Sees HR Dashboard
├─ Alert: "5 Policies Pending Acknowledgment"
└─ Acknowledges all mandatory policies (15 min)

DAY 2-7: Benefit Exploration
├─ Browse available benefits
├─ Review coverage details
├─ Calculate costs
└─ Discuss with family

DAY 7: Enrollment
├─ Select Medical Insurance
├─ Add spouse + 2 children as dependents
├─ Designate spouse as nominee
└─ Submit enrollment request (10 min)

DAY 8-10: HR Review
├─ HR reviews enrollment
├─ Verifies marriage certificate
├─ Validates children's birth certificates
└─ Approves enrollment

MONTH 1 END: Coverage Active
├─ Enrollment status: ACTIVE
├─ Effective date: Next month start
├─ Monthly deduction: ₹2,000
└─ Employer contribution: ₹3,000

MONTH 2: Active Benefits
├─ Coverage is active
├─ Payroll deduction applied
├─ Health card issued (future)
└─ Employee can make claims

MONTH 3: First Claim
├─ Medical expense incurred: ₹8,500
├─ Collect bills and receipts
├─ Submit claim online (10 min)
├─ Track status daily
├─ HR approves: ₹7,500 (after ₹1,000 deductible)
├─ Finance processes payment
└─ Reimbursement in next payroll

TOTAL TIME: 3 months from joining to first reimbursement
EMPLOYEE EFFORT: ~1 hour total
COMPANY EFFORT: ~30 min per employee
```

---

## 🔄 Claim Lifecycle Detailed

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAIM STATUS TRANSITIONS                          │
└─────────────────────────────────────────────────────────────────────┘

                    SUBMITTED
                        │
                        │ HR clicks "Review"
                        ▼
                 UNDER_REVIEW
                        │
                        │ Decision Point
                   ┌────┴────┐
                   │         │
            APPROVE│         │REJECT
                   │         │
                   ▼         ▼
              APPROVED    REJECTED
                   │         │
                   │         └──► END
                   │
                   │ Finance processes
                   ▼
                 PAID
                   │
                   └──► END

TIMELINES:
- SUBMITTED → UNDER_REVIEW: 24 hours
- UNDER_REVIEW → APPROVED: 48 hours
- APPROVED → PAID: 7 days (next payroll)
- TOTAL: ~10 days

ALERTS:
- Day 3: Reminder to HR if still SUBMITTED
- Day 5: Escalation if not APPROVED
- Day 10: Payment overdue alert
```

---

## 👥 Multi-Role Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│              BENEFIT PROGRAM LAUNCH - ALL ROLES                      │
└─────────────────────────────────────────────────────────────────────┘

WEEK 1: HR ADMIN
├─ Create new benefit type: "Gym Membership"
├─ Configure policy:
│  ├─ Coverage: ₹24,000/year
│  ├─ Employee: ₹500/month
│  └─ Employer: ₹1,500/month
└─ Set enrollment period: Feb 1-28, 2026

WEEK 2: COMMUNICATION
├─ HR sends announcement email
├─ Upload policy documents
├─ Schedule info sessions
└─ Answer employee queries

WEEK 3: EMPLOYEE ENROLLMENT
├─ 50 employees browse benefit
├─ 35 employees enroll
├─ 15 employees skip
└─ Deadline: Feb 28

WEEK 4: HR PROCESSING
├─ Review 35 enrollments
├─ Approve 33 (verified gym membership)
├─ Reject 2 (invalid documents)
├─ Request corrections
└─ Final approval: 35/35

MONTH 2: BENEFIT ACTIVATION
├─ All enrollments active
├─ Payroll deductions begin
├─ Employees receive gym cards
└─ First month coverage active

MONTH 3: CLAIMS START
├─ Employees submit gym fee claims
├─ HR reviews monthly
├─ Process payments
└─ Track utilization

MONTH 6: REVIEW
├─ Utilization: 80% (28/35 using)
├─ Satisfaction: High
├─ Cost: Within budget
└─ Decision: Continue program

METRICS:
- Enrollment rate: 70% (35/50)
- Activation rate: 100% (35/35)
- Utilization rate: 80% (28/35)
- Employee satisfaction: 4.5/5
```

---

## 🔀 Error Handling & Recovery Flows

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING FLOWS                              │
└─────────────────────────────────────────────────────────────────────┘

SCENARIO 1: Duplicate Enrollment Attempt
──────────────────────────────────────────
Employee                          System
    │ 1. Try to enroll in           │
    │    already enrolled benefit   │
    ├──────────────────────────────►│
    │                               │ 2. Check existing enrollment
    │                               │    └─ Found: ACTIVE enrollment
    │                               │
    │◄──────────────────────────────┤ 3. Return Error 409
    │   "Already enrolled in        │
    │    this benefit"              │
    │                               │
    │ 4. View current enrollment    │
    │    ├─ Status: ACTIVE          │
    │    └─ Option: Update/Cancel   │
    │                               │
   ✓ Prevented duplicate           ✓ Data integrity maintained


SCENARIO 2: Claim Amount Exceeds Coverage
──────────────────────────────────────────
Employee                  System                  HR Admin
    │ 1. Submit claim      │                         │
    │    Amount: ₹5,00,000 │                         │
    ├─────────────────────►│                         │
    │                      │ 2. Validate             │
    │                      │    Coverage: ₹3,00,000  │
    │                      │    Claim: ₹5,00,000     │
    │                      │    Status: OVER LIMIT   │
    │                      │                         │
    │◄─────────────────────┤ 3. Allow with Warning   │
    │   ⚠️ "Claim exceeds   │                         │
    │   policy coverage"   │                         │
    │                      │                         │
    │ 4. Confirm submit    ├────────────────────────►│ 5. Review claim
    │                      │    Flag: OVER_LIMIT     │    Flagged for
    │                      │                         │    special review
    │                      │                         │
    │                      │◄────────────────────────┤ 6. Approve up to
    │                      │    Approved: ₹3,00,000  │    coverage limit
    │◄─────────────────────┤                         │
    │ 7. Notification      │                         │
    │    "Approved ₹3L     │                         │
    │    (max coverage)"   │                         │
    │                      │                         │
   ✓ Expectation set     ✓ Business rule applied   ✓ Manual review


SCENARIO 3: Network Failure During Submission
──────────────────────────────────────────────
Employee                          System
    │ 1. Fill claim form            │
    │    (10 minutes of work)       │
    │                               │
    │ 2. Click "Submit"             │
    ├──────────────────────────────►│
    │                               │ 3. Save draft to localStorage
    │                               │
    │                               │ 4. Send to server
    │                               │    └─ Network error
    │                               │
    │◄──────────────────────────────┤ 5. Show error
    │   "Network error.             │
    │   Draft saved locally"        │
    │                               │
    │ 6. Fix network issue          │
    │                               │
    │ 7. Return to form             │
    │    └─ All data still there ✓  │
    │                               │
    │ 8. Click "Submit" again       │
    ├──────────────────────────────►│
    │                               │ 9. Success ✓
    │◄──────────────────────────────┤
    │   "Claim submitted"           │
    │                               │
   ✓ No data loss                 ✓ Draft recovery
```

---

## 📈 Reporting & Analytics Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    REPORTING WORKFLOW                                │
└─────────────────────────────────────────────────────────────────────┘

HR MANAGER
    │
    │ 1. Navigate to Reports
    │
    ├─► Benefits Utilization Report
    │   ├─ Enrolled: 85% (85/100 employees)
    │   ├─ Active: 80% (80/85 enrollments)
    │   ├─ Cost: ₹2,55,000/month
    │   └─ Export to Excel
    │
    ├─► Claims Analysis
    │   ├─ Total claims: 45
    │   ├─ Approved: 38 (84%)
    │   ├─ Rejected: 7 (16%)
    │   ├─ Avg claim: ₹4,500
    │   ├─ Total paid: ₹1,71,000
    │   └─ By benefit type:
    │       ├─ Medical: 30 claims (₹1,35,000)
    │       ├─ Gym: 10 claims (₹24,000)
    │       └─ Education: 5 claims (₹12,000)
    │
    ├─► Compliance Report
    │   ├─ Policy acknowledgment: 98%
    │   ├─ Pending: 2 employees
    │   ├─ By policy type:
    │   │   ├─ Mandatory: 100%
    │   │   └─ Optional: 75%
    │   └─ Send reminders to pending
    │
    ├─► Cost Analysis
    │   ├─ Total benefit cost: ₹30,60,000/year
    │   ├─ Employee contribution: ₹10,20,000
    │   ├─ Employer contribution: ₹20,40,000
    │   ├─ Claims paid: ₹20,52,000
    │   └─ ROI calculation
    │
    └─► Trend Analysis
        ├─ Claims trend: +15% vs last year
        ├─ Enrollment trend: +5% vs last year
        ├─ Popular benefits:
        │   1. Medical (95% enrollment)
        │   2. EPF (100% - mandatory)
        │   3. Gym (70% enrollment)
        └─ Recommendations for next year

DATABASE QUERIES:
- Aggregations across all tables
- Time-based comparisons
- Department-wise breakdown
- Cost center analysis
```

---

## 🔐 Security & Audit Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECURITY & AUDIT TRAIL                            │
└─────────────────────────────────────────────────────────────────────┘

ANY USER ACTION
    │
    ├─► 1. AUTHENTICATION
    │   ├─ JWT token verification
    │   ├─ Role check
    │   └─ Permission validation
    │
    ├─► 2. AUTHORIZATION
    │   ├─ Route guard
    │   ├─ API endpoint protection
    │   └─ Data scope validation
    │
    ├─► 3. ACTION EXECUTION
    │   ├─ Business logic
    │   ├─ Data validation
    │   └─ Transaction processing
    │
    ├─► 4. AUDIT LOGGING
    │   ├─ User: john@example.com
    │   ├─ Action: Approved claim
    │   ├─ Resource: Claim #CLM001
    │   ├─ Timestamp: 2026-01-14 10:30:45
    │   ├─ IP Address: 192.168.1.10
    │   ├─ Details: Changed status from
    │   │          UNDER_REVIEW to APPROVED
    │   ├─ Old value: claimed_amount=8500
    │   └─ New value: approved_amount=7500
    │
    └─► 5. COMPLIANCE CHECK
        ├─ Policy version tracked ✓
        ├─ Digital signature recorded ✓
        ├─ Approval chain maintained ✓
        └─ Data retention complied ✓

AUDIT REPORTS:
- Who accessed what, when
- All approvals and rejections
- Policy acknowledgments
- Data modifications
- Failed access attempts
```

---

## 🎯 Quick Reference

### Common Paths

**Admin - Approve Claim**
```
Login → HR → Claims → Filter: Pending → Select Claim → Review → Approve → Amount → Save
```

**Employee - Enroll in Benefit**
```
Login → HR → Enroll in Benefits → Select Benefit → Add Dependents → Add Nominee → Submit
```

**Employee - Submit Claim**
```
Login → HR → Submit Claim → Select Enrollment → Fill Details → Upload Docs → Submit
```

**Admin - Bulk Enroll**
```
Login → HR → Enrollments → Bulk Enroll → Select Policy → Select Employees → Submit
```

---

**For detailed step-by-step instructions, see:**
- `HR_MODULE_TESTING_FLOWS.md` - Complete test flows
- `HR_QUICK_TEST_SCENARIOS.md` - Quick scenarios
- `HR_IMPLEMENTATION_COMPLETE.md` - Full implementation guide
