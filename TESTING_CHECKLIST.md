# Testing Checklist Template

Use this template for each phase. Copy and fill out before marking phase as complete.

---

## Phase: [PHASE NAME]
**Branch:** `fix/[branch-name]`
**Date Started:** YYYY-MM-DD
**Date Completed:** YYYY-MM-DD

---

## Pre-Implementation Checklist

- [ ] Created feature branch from `revamp`
- [ ] Database backup completed
- [ ] Test database setup/refreshed
- [ ] All dependencies installed
- [ ] Current tests passing (baseline)

---

## Implementation Checklist

### Code Changes
- [ ] All planned files modified
- [ ] Code follows project conventions
- [ ] No console.log statements left in code
- [ ] No commented-out code blocks
- [ ] Type safety maintained (no `any` added)

### Documentation
- [ ] Code comments added for complex logic
- [ ] API documentation updated (if endpoints changed)
- [ ] CHANGELOG.md updated

---

## Testing Checklist

### Unit Tests
- [ ] New unit tests written for changes
- [ ] All unit tests passing
- [ ] Test coverage > 80% for modified files
- [ ] Edge cases covered
- [ ] Error scenarios tested

**Command:**
```bash
cd api-v2
npm run test -- --coverage
```

**Results:**
```
[Paste test results here]
```

### Integration Tests
- [ ] Integration tests written/updated
- [ ] All integration tests passing
- [ ] Database state verified after tests
- [ ] Transaction rollback tested

**Command:**
```bash
cd api-v2
npm run test:e2e
```

**Results:**
```
[Paste test results here]
```

### Manual Testing
- [ ] Happy path tested manually
- [ ] Error scenarios tested manually
- [ ] Boundary conditions tested
- [ ] UI tested (if frontend changes)

**Test Scenarios:**
| Scenario | Expected | Actual | Status |
|----------|----------|--------|--------|
| [Describe scenario] | [Expected result] | [Actual result] | ✅/❌ |

### Performance Testing
- [ ] No performance degradation
- [ ] Query performance benchmarked
- [ ] Load testing completed (if applicable)

**Benchmark Results:**
```
Before: [metrics]
After: [metrics]
Change: [% change]
```

### Security Testing
- [ ] SQL injection testing (if applicable)
- [ ] Authentication/authorization tested
- [ ] No sensitive data in logs/responses

**Security Test Results:**
```
[Results here]
```

---

## Code Review Checklist

- [ ] Self-review completed
- [ ] PR created with detailed description
- [ ] Reviewer assigned
- [ ] All review comments addressed
- [ ] PR approved

**PR Link:** [Link to PR]

---

## Deployment Checklist

### Staging Deployment
- [ ] Code merged to `revamp`
- [ ] Deployed to staging environment
- [ ] Smoke tests passed on staging
- [ ] Monitored for 24-48 hours
- [ ] No errors in staging logs

### Production Deployment
- [ ] Production database backup
- [ ] Deployment plan documented
- [ ] Rollback plan ready
- [ ] Deployed during low-traffic window
- [ ] Post-deployment smoke tests
- [ ] Monitoring active

---

## Post-Deployment Monitoring

**First 24 Hours:**
- [ ] Error rate within normal range
- [ ] Response times acceptable
- [ ] No data corruption detected
- [ ] User feedback reviewed

**First Week:**
- [ ] All metrics stable
- [ ] No rollback needed
- [ ] Phase marked as complete

---

## Issues Encountered

| Issue | Description | Resolution | Status |
|-------|-------------|------------|--------|
| | | | |

---

## Rollback Information

**Rollback Trigger:** [Condition that would trigger rollback]
**Rollback Procedure:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Rollback Tested:** ✅ Yes / ❌ No

---

## Sign-off

- [ ] Developer sign-off
- [ ] QA sign-off (if applicable)
- [ ] Tech lead sign-off

**Completed By:** [Name]
**Date:** YYYY-MM-DD

---

## Notes

[Any additional notes, lessons learned, or recommendations for future phases]
