# Phase 6: Employee Self-Service UI Components - Implementation Plan

**Date**: 2026-01-14
**Status**: IN PROGRESS - Build errors being fixed
**Overall Project Progress**: 92% → 100% (projected)

**Latest Update**: All 6 employee components created (18 files), module registration complete, fixing TypeScript compilation errors related to model field mismatches.

---

## Overview

Phase 6 involves creating employee-facing UI components for the HR Policies & Benefits system. These components allow employees to:
- View and acknowledge HR policies
- Enroll in benefits
- Submit benefit claims
- Track their benefits and claims

---

## Existing Components (Already Implemented)

### Employee Components ✅
1. **HrDashboardComponent** - Personal metrics, leave balance, leaderboard
2. **AttendanceClockComponent** - Clock in/out with photo
3. **LeaveRequestComponent** - Submit and track leave requests

### Admin Components ✅
1. **PolicyManagementComponent** - Admin policy management
2. **BenefitManagementComponent** - Admin benefit management
3. **EnrollmentManagementComponent** - Admin enrollment approval
4. **ClaimsManagementComponent** - Admin claims processing

---

## Missing Employee Components (To Be Built)

### 1. Employee Policy Viewer Component
**Priority**: HIGH
**Estimated Time**: 4-5h
**Description**: Allows employees to view company policies and acknowledge them

**Features**:
- List of all active policies with category filters
- Policy detail view with content display
- Acknowledgment button with confirmation
- Track acknowledgment status
- Search by policy name
- Badge indicators (mandatory, acknowledged)

**API Endpoints** (already available):
- `GET /api/hr/policies/my` - Get policies for logged-in employee
- `POST /api/hr/policies/:id/acknowledge` - Acknowledge a policy

**Files to Create**:
- `employee-policies.component.ts`
- `employee-policies.component.html`
- `employee-policies.component.scss`

---

### 2. Employee Benefit Enrollment Component
**Priority**: HIGH
**Estimated Time**: 5-6h
**Description**: Allows employees to browse available benefits and enroll

**Features**:
- List of available benefit policies (not yet enrolled)
- Benefit details card with coverage, cost sharing, terms
- Enrollment form with:
  - Enrollment type (SELF/FAMILY/DEPENDENT)
  - Dependent details (if family coverage)
  - Nominee information (name, relationship, DOB, contact)
  - Documents upload
- Coverage calculator
- Enrollment confirmation
- Status tracking (pending/active/cancelled)

**API Endpoints** (already available):
- `GET /api/hr/enrollments/available` - Get available benefits
- `POST /api/hr/enrollments` - Enroll in a benefit
- `GET /api/hr/enrollments/my` - Get my enrollments
- `PUT /api/hr/enrollments/:id/cancel` - Cancel enrollment

**Files to Create**:
- `employee-benefit-enrollment.component.ts`
- `employee-benefit-enrollment.component.html`
- `employee-benefit-enrollment.component.scss`

---

### 3. My Benefits Dashboard Component
**Priority**: MEDIUM
**Estimated Time**: 4h
**Description**: Central dashboard showing employee's active benefits

**Features**:
- Summary cards (total benefits, active, pending, cancelled)
- Active enrollments list with:
  - Benefit name and type
  - Coverage amount
  - Employee/employer contributions
  - Enrollment date
  - Status badges
  - Expiry date
- Quick actions (view details, cancel, submit claim)
- Filter by status and benefit type
- Empty state for no enrollments

**API Endpoints** (already available):
- `GET /api/hr/enrollments/my` - Get my enrollments

**Files to Create**:
- `my-benefits.component.ts`
- `my-benefits.component.html`
- `my-benefits.component.scss`

---

### 4. Employee Claims Submission Component
**Priority**: HIGH
**Estimated Time**: 5-6h
**Description**: Allows employees to submit benefit claims

**Features**:
- Enrollment selection dropdown (only active enrollments)
- Claim submission form:
  - Claim type (REIMBURSEMENT/DIRECT_BILLING/CASHLESS)
  - Claim date
  - Claimed amount
  - Description
  - Documents upload (bills, prescriptions, receipts)
- Form validation
- Document preview before upload
- Submission confirmation
- Success/error messages

**API Endpoints** (already available):
- `GET /api/hr/enrollments/my` - Get enrollments for dropdown
- `POST /api/hr/claims` - Submit a claim
- `POST /api/hr/claims/:id/documents` - Upload claim documents

**Files to Create**:
- `employee-claim-submission.component.ts`
- `employee-claim-submission.component.html`
- `employee-claim-submission.component.scss`

---

### 5. My Claims Tracker Component
**Priority**: HIGH
**Estimated Time**: 5h
**Description**: Allows employees to track their submitted claims

**Features**:
- Dashboard with status count cards (Submitted, Under Review, Approved, Rejected, Paid)
- Claims list with:
  - Claim number
  - Claim date
  - Benefit name
  - Claimed amount
  - Approved amount (if any)
  - Status badges
  - Workflow indicator (visual progress)
- Claim detail dialog:
  - Full claim information
  - Documents gallery
  - Timeline (submitted → review → approved/rejected → paid)
  - Rejection reason (if rejected)
  - Payment details (if paid)
- Filter by status and date range
- Search by claim number

**API Endpoints** (already available):
- `GET /api/hr/claims/my` - Get my claims
- `GET /api/hr/claims/:id` - Get claim details

**Files to Create**:
- `my-claims.component.ts`
- `my-claims.component.html`
- `my-claims.component.scss`
- `claim-details-dialog.component.ts` (simplified read-only version of admin's claim-review-dialog)
- `claim-details-dialog.component.html`
- `claim-details-dialog.component.scss`

---

## Implementation Strategy

### Recommended Approach: Build in Order of User Flow

**Step 1: Policy Viewing** (4-5h)
- Create Employee Policy Viewer
- Test policy acknowledgment flow

**Step 2: Benefit Enrollment** (9-10h)
- Create My Benefits Dashboard (overview first)
- Create Employee Benefit Enrollment (enrollment flow)
- Test enrollment and dashboard update

**Step 3: Claims Management** (10-11h)
- Create Employee Claims Submission
- Create My Claims Tracker + Claim Details Dialog
- Test end-to-end claim submission and tracking

**Total Estimated Time**: ~24-26 hours

---

## Routing Configuration

Add these routes to `hr-routing.module.ts`:

```typescript
// Employee Routes
{
  path: 'my-policies',
  component: EmployeePoliciesComponent,
  canActivate: [AuthGuard],
  data: { title: 'My Policies' }
},
{
  path: 'my-benefits',
  component: MyBenefitsComponent,
  canActivate: [AuthGuard],
  data: { title: 'My Benefits' }
},
{
  path: 'enroll-benefits',
  component: EmployeeBenefitEnrollmentComponent,
  canActivate: [AuthGuard],
  data: { title: 'Enroll in Benefits' }
},
{
  path: 'submit-claim',
  component: EmployeeClaimSubmissionComponent,
  canActivate: [AuthGuard],
  data: { title: 'Submit Claim' }
},
{
  path: 'my-claims',
  component: MyClaimsComponent,
  canActivate: [AuthGuard],
  data: { title: 'My Claims' }
}
```

---

## Module Registration

Add to `hr.module.ts` declarations:

```typescript
declarations: [
  // ... existing components
  EmployeePoliciesComponent,
  EmployeeBenefitEnrollmentComponent,
  MyBenefitsComponent,
  EmployeeClaimSubmissionComponent,
  MyClaimsComponent,
  ClaimDetailsDialogComponent
]
```

---

## Design Patterns

1. **List-Detail Pattern**: Claims tracker with detail dialog
2. **Form-Wizard Pattern**: Enrollment form with multiple sections
3. **Dashboard Pattern**: Summary cards with drill-down
4. **Read-Only Dialog**: Claim details for employees (no actions)
5. **Empty State Pattern**: Helpful messages when no data

---

## UI/UX Considerations

### Employee vs Admin Differences

**Employee Components Should**:
- Show only user's own data (my enrollments, my claims)
- Be read-only for most data (can't edit others' data)
- Have simplified workflows (submit, view, track)
- Show clear status indicators (pending approval, approved, rejected)
- Provide helpful guidance (tooltips, empty states)
- Hide administrative fields (approver info, backend IDs)

**Admin Components**:
- Show all users' data with filters
- Allow CRUD operations on any record
- Have advanced workflows (approve, reject, process)
- Show detailed audit info (created by, updated by)
- Provide bulk operations

---

## PrimeNG Components to Use

- `p-card` - Content containers
- `p-table` - Data tables
- `p-dialog` - Modal dialogs
- `p-toast` - Notifications
- `p-dropdown` - Dropdowns
- `p-calendar` - Date pickers
- `p-fileUpload` - Document upload
- `p-timeline` - Claim timeline
- `p-badge` - Status indicators
- `p-inputNumber` - Amount inputs
- `p-inputTextarea` - Description fields

---

## Testing Checklist

### Per Component
- [ ] Component renders without errors
- [ ] Service calls work correctly (my endpoints)
- [ ] Form validation works
- [ ] Submit/save operations succeed
- [ ] Error handling displays messages
- [ ] Loading states work
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Empty states display correctly

### Integration Testing
- [ ] Navigation between employee components works
- [ ] Data flows correctly (enroll → my benefits → submit claim → my claims)
- [ ] Filters and search work
- [ ] Dialogs open/close properly
- [ ] File uploads work (claims documents)

### User Flow Testing
- [ ] Employee can view and acknowledge policies
- [ ] Employee can enroll in available benefits
- [ ] Enrolled benefits appear in My Benefits
- [ ] Employee can submit claims for enrolled benefits
- [ ] Submitted claims appear in My Claims tracker
- [ ] Claim status updates reflect in tracker

---

## Code Quality Standards

✅ Follow existing component patterns (especially LeaveRequestComponent)
✅ Use TypeScript strict mode
✅ Implement error handling with toast notifications
✅ Add loading states for async operations
✅ Use reactive forms for complex forms
✅ Add comments for complex logic
✅ Keep components < 400 lines
✅ Extract reusable logic to services
✅ Use PrimeNG components consistently
✅ Optimize SCSS to stay within 6KB budget per file

---

## Security Considerations

- All employee endpoints use `/my` or check userId server-side
- AuthGuard ensures only authenticated users access routes
- File uploads validated server-side for type and size
- Sensitive admin data (cost, approver info) not exposed to employees
- Employee cannot modify enrollment/claim status (only submit/cancel)

---

## Next Steps

1. **Start with Employee Policy Viewer** (simplest component)
2. **Move to My Benefits Dashboard** (overview component)
3. **Implement Benefit Enrollment** (complex form)
4. **Build Claims Submission** (another complex form)
5. **Finish with My Claims Tracker** (most complex - list + detail dialog)

---

**Phase 6 Component Summary**

| Component | Priority | Time Est. | Status |
|-----------|----------|-----------|--------|
| Employee Policy Viewer | HIGH | 4-5h | Pending |
| My Benefits Dashboard | MEDIUM | 4h | Pending |
| Employee Benefit Enrollment | HIGH | 5-6h | Pending |
| Employee Claims Submission | HIGH | 5-6h | Pending |
| My Claims Tracker | HIGH | 5h | Pending |
| Claim Details Dialog | MEDIUM | 2h | Pending |
| **TOTAL** | - | **~26h** | **0% Complete** |

---

**Last Updated**: 2026-01-14
**Next Component**: Employee Policy Viewer Component
**Backend Dependencies**: All required endpoints already available ✅
