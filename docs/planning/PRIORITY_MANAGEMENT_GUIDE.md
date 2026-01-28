# Priority Management & Issue Ordering Guide
## Maintaining Critical Issues at Top

**Date**: 2026-01-15
**Purpose**: Ensure P0-critical issues always appear first and development follows priority order

---

## Overview

GitHub doesn't enforce strict ordering by default. You need to use a combination of:
1. **Labels** (P0-critical, P1-high) for filtering
2. **Milestones** (Month 1, 2, 3) for timeline
3. **Project Boards** for visual ordering
4. **Issue Numbers** for dependencies

---

## Step 1: Import Issues in Priority Order

**IMPORTANT**: Import in this exact sequence to get sequential issue numbers that match priority:

### Batch 1: P0-Critical (Import First)
```bash
# Issue #1 - Batch/Expiry Tracking (8 pts)
gh issue create \
  --title "[P0] Implement Batch/Expiry Tracking with FIFO/FEFO Enforcement" \
  --body-file docs/planning/issue-bodies/p0-issue-1.md \
  --label "P0-critical,compliance,products,inventory,feature" \
  --milestone "Q1 2026 - Month 1"

# Issue #2 - Stock Audit Trail (5 pts)
gh issue create \
  --title "[P0] Implement Immutable Stock Audit Trail" \
  --body-file docs/planning/issue-bodies/p0-issue-2.md \
  --label "P0-critical,security,inventory,compliance,feature" \
  --milestone "Q1 2026 - Month 1"

# Issue #3 - Purchase Return Atomicity (5 pts)
gh issue create \
  --title "[P0] Fix Purchase Return Transaction Atomicity & Data Integrity" \
  --body-file docs/planning/issue-bodies/p0-issue-3.md \
  --label "P0-critical,bug,data-integrity,purchases,backend" \
  --milestone "Q1 2026 - Month 1"

# Issue #4 - Payroll Audit (5 pts)
gh issue create \
  --title "[P0] Implement Payroll Processing Audit Trail" \
  --body-file docs/planning/issue-bodies/p0-issue-4.md \
  --label "P0-critical,compliance,payroll,feature" \
  --milestone "Q1 2026 - Month 1"

# Issue #5 - Password Policy (3 pts)
gh issue create \
  --title "[Security Hardening] Implement Strong Password Policy & Security Controls" \
  --body-file docs/planning/issue-bodies/p0-issue-5.md \
  --label "P0-critical,security,users,feature" \
  --milestone "Q1 2026 - Month 1"

# Issue #6 - Admin Audit Log (3 pts)
gh issue create \
  --title "[Security Hardening] Implement Administrative Actions Audit Log" \
  --body-file docs/planning/issue-bodies/p0-issue-6.md \
  --label "P0-critical,security,compliance,settings,feature" \
  --milestone "Q1 2026 - Month 2"
```

### Batch 2: P1-High (Import Second)
```bash
# Issue #7 - POS Performance (8 pts)
gh issue create \
  --title "[P1] Optimize POS Performance with Virtual Scrolling & Caching" \
  --body-file docs/planning/issue-bodies/p1-issue-7.md \
  --label "P1-high,performance,sales,pos,enhancement" \
  --milestone "Q1 2026 - Month 2"

# Issue #8 - Payment Gateway (13 pts)
gh issue create \
  --title "[P1] Integrate Payment Gateway (UPI, Razorpay, Card Terminals)" \
  --body-file docs/planning/issue-bodies/p1-issue-8.md \
  --label "P1-high,feature,sales,payments,integration" \
  --milestone "Q1 2026 - Month 2"

# Issue #9 - Multi-Device Sync (13 pts)
gh issue create \
  --title "[P1] Implement Multi-Device POS Synchronization" \
  --body-file docs/planning/issue-bodies/p1-issue-9.md \
  --label "P1-high,feature,sales,pos,realtime,architecture" \
  --milestone "Q1 2026 - Month 3"

# Issue #10 - Vendor Payment Aging (8 pts)
gh issue create \
  --title "[P1] Implement Vendor Payment Aging & Tracking" \
  --body-file docs/planning/issue-bodies/p1-issue-10.md \
  --label "P1-high,feature,purchases,vendors,finance" \
  --milestone "Q1 2026 - Month 2"

# Issue #11 - Customer Loyalty (13 pts)
gh issue create \
  --title "[P1] Implement Customer Loyalty Program" \
  --body-file docs/planning/issue-bodies/p1-issue-11.md \
  --label "P1-high,feature,customers,marketing,business-growth" \
  --milestone "Q1 2026 - Month 3"
```

**Why This Order Matters**:
- Issue numbers will be sequential (e.g., #107-117 if current is #106)
- P0 issues get lower numbers → appear first when sorted by issue number
- Easy to reference: "Work on #107-112 first (P0), then #113-117 (P1)"

---

## Step 2: Update Existing Issues with Cross-References

After importing, update these existing issues to maintain relationships:

### Update Issue #43 (Duplicate Sale Invoice Bug)
```bash
gh issue comment 43 --body "## Solution Planned

This duplicate bill issue will be addressed by the **Multi-Device POS Synchronization** feature (Issue #[NEW-9]).

**Root Cause**: Multiple POS terminals operate independently without real-time synchronization, allowing duplicate bills to be created.

**Solution**: Issue #[NEW-9] implements WebSocket-based real-time synchronization with optimistic locking to prevent duplicate sales across terminals.

**Status**: Keep this issue open until #[NEW-9] is implemented and verified.

**Related Issues**:
- #[NEW-9] Multi-Device POS Synchronization (implements fix)
- #52 Multi-Tenant Architecture (related but different scope)
"
```

### Update Issue #47 (Security & Stability Hardening EPIC)
```bash
gh issue comment 47 --body "## Sub-Issues Added

This EPIC now includes two new sub-issues for security hardening:

### Password & Access Control
- **#[NEW-5]** Strong Password Policy & Security Controls (3 pts)
  - Enforces complexity requirements (8+ chars, upper, lower, numbers, special)
  - Password expiry (90 days)
  - Account lockout after failed attempts
  - Rate limiting on login endpoint

### Administrative Audit Trail
- **#[NEW-6]** Administrative Actions Audit Log (3 pts)
  - Logs all settings changes
  - Tracks role/permission modifications
  - Records user activations/deactivations
  - Diff view for before/after values

**Total Security Hardening Effort**: 6 story points
**Timeline**: Q1 2026 - Month 1-2

These sub-issues complete the security hardening foundation mentioned in this EPIC.
"
```

### Update Issue #48 (Enhanced Purchase Invoice Lifecycle EPIC)
```bash
gh issue comment 48 --body "## Sub-Issues Added

This EPIC now includes additional purchase lifecycle improvements:

### Purchase Returns - Backend Atomicity
- **#[NEW-3]** Fix Purchase Return Transaction Atomicity & Data Integrity (5 pts)
  - SERIALIZABLE transactions for atomic updates
  - Prevents partial return failures
  - Updates stock + vendor payables + invoice status atomically
  - Complements #62 (UI visibility layer)

### Vendor Payment Management (Optional)
- **#[NEW-10]** Implement Vendor Payment Aging & Tracking (8 pts)
  - Aging analysis (0-30, 31-60, 61-90, >90 days)
  - Payment due alerts and reminders
  - Vendor relationship management
  - Can be part of this EPIC or standalone

**Note**: Issue #62 (Purchase Returns Tracking Visibility) handles the frontend/UI layer, while #[NEW-3] ensures backend data integrity.
"
```

### Update Issue #62 (Purchase Returns Tracking Visibility)
```bash
gh issue comment 62 --body "## Scope Clarification

This issue focuses on **UI/visibility improvements** for purchase returns tracking.

**Backend Data Integrity**: Now addressed by **#[NEW-3]** Fix Purchase Return Transaction Atomicity
- #[NEW-3] handles SERIALIZABLE transactions and atomic updates
- This issue (#62) handles frontend visibility and tracking UI

**Division of Work**:
- **#[NEW-3]** (P0, Backend): Transaction atomicity, rollback handling, validation
- **#62** (P2, Frontend): UI dashboards, tracking reports, visibility improvements

Both issues can be worked in parallel or #[NEW-3] can be completed first to provide solid backend foundation.

**Related Issues**:
- #[NEW-3] Purchase Return Transaction Atomicity (backend)
- #48 Enhanced Purchase Invoice Lifecycle EPIC (parent)
"
```

---

## Step 3: Create GitHub Project Board for Priority Ordering

**Visual organization is KEY to maintaining priority order.**

### Create Project Board
```bash
gh project create \
  --owner YOUR_USERNAME \
  --title "RGP BO - Q1 2026 Development" \
  --body "Prioritized development backlog with P0 issues at top"
```

### Add Custom Fields to Project
After creating project in GitHub UI:
1. Go to Project → Settings
2. Add custom fields:
   - **Priority**: Single select (P0-Critical, P1-High, P2-Medium)
   - **Story Points**: Number (0-13)
   - **Sprint**: Single select (Sprint 1, Sprint 2, Sprint 3...)
   - **Status**: Single select (Backlog, In Progress, Review, Done)

### Add Issues to Project in Priority Order
```bash
# Get project ID first
gh project list --owner YOUR_USERNAME

# Add P0 issues first (assuming issue numbers 107-112)
gh project item-add PROJECT_ID --owner YOUR_USERNAME --url https://github.com/YOUR_USERNAME/rgp-bo/issues/107
gh project item-add PROJECT_ID --owner YOUR_USERNAME --url https://github.com/YOUR_USERNAME/rgp-bo/issues/108
gh project item-add PROJECT_ID --owner YOUR_USERNAME --url https://github.com/YOUR_USERNAME/rgp-bo/issues/109
gh project item-add PROJECT_ID --owner YOUR_USERNAME --url https://github.com/YOUR_USERNAME/rgp-bo/issues/110
gh project item-add PROJECT_ID --owner YOUR_USERNAME --url https://github.com/YOUR_USERNAME/rgp-bo/issues/111
gh project item-add PROJECT_ID --owner YOUR_USERNAME --url https://github.com/YOUR_USERNAME/rgp-bo/issues/112

# Then add P1 issues (113-117)
gh project item-add PROJECT_ID --owner YOUR_USERNAME --url https://github.com/YOUR_USERNAME/rgp-bo/issues/113
# ... etc
```

### Organize Project Board Columns
1. **Backlog** - All issues sorted by priority
2. **Sprint 1** - P0 security issues (#110, #111, #108)
3. **Sprint 2** - P0 compliance (#107, #109)
4. **Sprint 3** - P0 payroll + P1 performance (#112, #113)
5. **Sprint 4+** - Remaining P1 issues
6. **In Progress** - Currently being worked
7. **Done** - Completed issues

**Project View Settings**:
- **Group by**: Priority (shows P0 group at top)
- **Sort by**: Issue number (ascending)
- **Filter**: `is:open` to hide closed issues

---

## Step 4: Use Issue Filters to Maintain Priority View

### Filter URLs (Bookmark These)

**All P0 Issues (Top Priority)**
```
https://github.com/YOUR_USERNAME/rgp-bo/issues?q=is:open+label:P0-critical+sort:created-asc
```

**P0 Issues - Sprint 1 (Security)**
```
https://github.com/YOUR_USERNAME/rgp-bo/issues?q=is:open+label:P0-critical+label:security+milestone:"Q1+2026+-+Month+1"
```

**P0 Issues - Month 1 Milestone**
```
https://github.com/YOUR_USERNAME/rgp-bo/issues?q=is:open+label:P0-critical+milestone:"Q1+2026+-+Month+1"+sort:created-asc
```

**All Issues Sorted by Priority**
```
https://github.com/YOUR_USERNAME/rgp-bo/issues?q=is:open+sort:label-asc
```
(Labels sort alphabetically: P0 before P1 before P2)

### Quick Filters in GitHub UI
1. Click "Labels" dropdown
2. Select "P0-critical" → Shows only P0 issues
3. Sort by "Oldest" → Sequential order (107, 108, 109...)

---

## Step 5: Sprint Assignment & Prioritization

### Sprint 1: Critical Security (Weeks 1-2)
**Goal**: Foundation security hardening
**Issues**:
- #[NEW-5] Password Policy (3 pts)
- #[NEW-6] Admin Audit Log (3 pts)
- #[NEW-2] Stock Audit Trail (5 pts)
**Total**: 11 points
**Milestone**: Q1 2026 - Month 1

```bash
# Assign to Sprint 1 (using labels)
gh issue edit [NEW-5] --add-label "sprint:1"
gh issue edit [NEW-6] --add-label "sprint:1"
gh issue edit [NEW-2] --add-label "sprint:1"

# Assign to developer
gh issue edit [NEW-5] --add-assignee developer-username
```

### Sprint 2: Inventory Compliance (Weeks 3-4)
**Goal**: Pharmacy regulatory compliance
**Issues**:
- #[NEW-1] Batch/Expiry Tracking (8 pts)
- #[NEW-3] Purchase Return Atomicity (5 pts)
**Total**: 13 points
**Milestone**: Q1 2026 - Month 1

### Sprint 3: Payroll & Performance (Weeks 5-6)
**Goal**: HR compliance + POS improvements
**Issues**:
- #[NEW-4] Payroll Audit Trail (5 pts)
- #[NEW-7] POS Performance (8 pts)
**Total**: 13 points
**Milestone**: Q1 2026 - Month 2

### Sprint 4-6: Strategic Features (Weeks 7-12)
**Goal**: Payment, sync, loyalty
**Issues**: #[NEW-8], #[NEW-9], #[NEW-10], #[NEW-11]

---

## Step 6: Enforce Priority with Automation

### GitHub Actions Workflow (Optional)

Create `.github/workflows/issue-priority.yml`:

```yaml
name: Issue Priority Enforcement

on:
  issues:
    types: [opened, labeled, unlabeled]
  pull_request:
    types: [opened, labeled]

jobs:
  enforce-priority:
    runs-on: ubuntu-latest
    steps:
      - name: Check P0 blocking P1
        uses: actions/github-script@v6
        with:
          script: |
            const { data: issues } = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: 'open',
              labels: 'P0-critical'
            });

            const p0Open = issues.length;

            if (p0Open > 0 && context.payload.issue.labels.some(l => l.name === 'P1-high')) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.issue.number,
                body: `⚠️ **Priority Warning**: ${p0Open} P0-critical issues are still open. Consider prioritizing those first:\n\n${issues.map(i => `- #${i.number} ${i.title}`).join('\n')}`
              });
            }
```

**What this does**:
- Automatically comments on new P1 issues if P0 issues are still open
- Reminds team to prioritize P0 over P1

---

## Step 7: Development Order Checklist

### Before Starting Work on Any Issue

- [ ] **Check P0 issues**: Are all P0 issues completed?
  - If NO → Work on P0 first
  - If YES → Proceed with P1

- [ ] **Check dependencies**: Does this issue depend on others?
  - Example: #[NEW-6] depends on #[NEW-5]
  - Work on dependencies first

- [ ] **Check sprint assignment**: Is this issue assigned to current sprint?
  - If NO → Don't work on it unless higher priority

- [ ] **Check milestone**: Is milestone date approaching?
  - Prioritize issues in current month's milestone

### Development Order Rules

**STRICT ORDER**:
1. ✅ P0-critical issues ALWAYS before P1-high
2. ✅ Within P0: Lower issue numbers first (#107 before #112)
3. ✅ Dependencies before dependents (#5 before #6)
4. ✅ Current sprint before future sprints
5. ✅ Current milestone before future milestones

**EXCEPTIONS** (When you can break order):
- ❌ NEVER start P1 if P0 is incomplete (unless blocked)
- ✅ CAN work on P0 issue #112 before #107 if #107 is blocked
- ✅ CAN parallelize independent P0 issues (e.g., #107 + #110 simultaneously)
- ✅ CAN skip issue if waiting for external dependency (but flag it)

---

## Step 8: Update Issue Relationships

After all issues are created, add these relationships to issue descriptions:

### Issue #[NEW-5] (Password Policy)
Add to description:
```markdown
**Dependencies**:
- None (foundational security)

**Blocks**:
- #[NEW-6] (Admin Audit Log - needs password change auditing)

**Related**:
- #47 (Security & Stability Hardening EPIC)
```

### Issue #[NEW-6] (Admin Audit Log)
Add to description:
```markdown
**Dependencies**:
- #[NEW-5] (Password Policy - audit logs password changes)

**Blocks**:
- None

**Related**:
- #47 (Security & Stability Hardening EPIC)
- #[NEW-2] (Stock Audit Trail - similar logging pattern)
- #[NEW-4] (Payroll Audit Trail - similar pattern)
```

### Issue #[NEW-3] (Purchase Return Atomicity)
Add to description:
```markdown
**Dependencies**:
- None

**Blocks**:
- None

**Related**:
- #48 (Enhanced Purchase Invoice Lifecycle EPIC)
- #62 (Purchase Returns Tracking Visibility - UI layer)
- #[NEW-2] (Stock Audit Trail - logs return movements)
```

### Issue #[NEW-9] (Multi-Device Sync)
Add to description:
```markdown
**Dependencies**:
- Recommended: #[NEW-7] (POS Performance - faster sync with optimized POS)

**Blocks**:
- None

**Solves**:
- #43 (Duplicate Sale invoice bug)

**Related**:
- #52 (Multi-Tenant Architecture - different scope)
- #[NEW-7] (POS Performance)
```

---

## Step 9: Daily Standup Priority Check

### Team Standup Template

**For each developer**:
1. What did you work on yesterday?
   - Issue #XXX (P0/P1)
2. What will you work on today?
   - Issue #XXX (P0/P1) ← **Must justify if P1 while P0 open**
3. Any blockers?
   - If blocked on P0, move to next P0 (don't jump to P1)

**Standup Rules**:
- ✅ If working on P1 while P0 open → Must explain why
- ✅ If P0 blocked → Escalate immediately (don't wait)
- ✅ Track "Days since last P0 completion" → Should be <7 days

---

## Step 10: Monitoring & Tracking

### Weekly Priority Dashboard

Create a script to check priority status:

```bash
#!/bin/bash
# priority-check.sh

echo "=== RGP BO Priority Status ==="
echo ""

P0_OPEN=$(gh issue list --label "P0-critical" --state open --json number --jq '. | length')
P1_OPEN=$(gh issue list --label "P1-high" --state open --json number --jq '. | length')

echo "P0 Issues Open: $P0_OPEN"
echo "P1 Issues Open: $P1_OPEN"
echo ""

if [ $P0_OPEN -gt 0 ]; then
  echo "⚠️  WARNING: P0 issues still open. Do NOT start P1 work!"
  echo ""
  echo "Open P0 Issues:"
  gh issue list --label "P0-critical" --state open --json number,title --jq '.[] | "  - #\(.number) \(.title)"'
else
  echo "✅ All P0 issues completed! Ready for P1 work."
fi
```

Run weekly:
```bash
bash priority-check.sh
```

### Metrics to Track

**P0 Completion Rate**:
- Target: 100% within 6 weeks
- Current: Track weekly

**P1 Blocked by P0**:
- Count of P1 issues waiting for P0 completion
- Should trend to 0 as P0s complete

**Development Order Compliance**:
- % of time team worked on highest priority issue
- Target: >90%

---

## Quick Reference Card

### Priority Order Summary
```
┌─────────────────────────────────────────────┐
│ DEVELOPMENT PRIORITY ORDER                  │
├─────────────────────────────────────────────┤
│ 1. P0 Security (#5, #6, #2)     [Sprint 1] │
│ 2. P0 Compliance (#1, #3)       [Sprint 2] │
│ 3. P0 Payroll (#4)              [Sprint 3] │
│ 4. P1 Performance (#7)          [Sprint 3] │
│ 5. P1 Payments (#8, #10)        [Sprint 4] │
│ 6. P1 Strategic (#9, #11)       [Sprint 5] │
└─────────────────────────────────────────────┘

RULE: Never work on P1 if ANY P0 is incomplete
      (unless P0 is blocked)
```

### Issue Number Mapping (After Import)
Assuming current last issue is #106:
- #107 → P0 Batch/Expiry Tracking
- #108 → P0 Stock Audit Trail
- #109 → P0 Purchase Return Atomicity
- #110 → P0 Payroll Audit Trail
- #111 → P0 Password Policy
- #112 → P0 Admin Audit Log
- #113 → P1 POS Performance
- #114 → P1 Payment Gateway
- #115 → P1 Multi-Device Sync
- #116 → P1 Vendor Payment Aging
- #117 → P1 Customer Loyalty

### Quick GitHub Filters
- **P0 Only**: `is:open label:P0-critical sort:created-asc`
- **Sprint 1**: `is:open label:P0-critical milestone:"Q1 2026 - Month 1"`
- **All Sorted**: `is:open sort:label-asc` (P0, then P1, then P2)

---

**Document Version**: 1.0
**Created**: 2026-01-15
**Purpose**: Maintain strict priority ordering in GitHub issue management
