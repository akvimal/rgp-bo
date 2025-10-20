# RGP Back Office - Data Consistency & Security Improvement Plan

**Date:** 2025-10-16
**Current Branch:** revamp
**Status:** Planning Phase

---

## Executive Summary

This document outlines critical data consistency and security issues found in the RGP Back Office system, along with a phased approach to address them systematically with proper testing before moving to production.

---

## Critical Issues Identified

### 🔴 **Priority 1 - Security Vulnerabilities**
- **Issue 1.1:** SQL Injection in multiple services (sale, stock, customer, returns)
- **Issue 1.2:** Race condition in bill number generation
- **Impact:** Data theft, manipulation, duplicate bill numbers, GST compliance violations

### 🔴 **Priority 2 - Transaction Management**
- **Issue 2.1:** Missing transaction wrappers in sale creation
- **Issue 2.2:** Missing transaction wrappers in purchase operations
- **Issue 2.3:** Missing transaction wrappers in return processing
- **Issue 2.4:** No rollback handling in existing transactions
- **Impact:** Orphaned records, partial updates, data inconsistency

### 🟡 **Priority 3 - Error Handling**
- **Issue 3.1:** No error handling in sale service operations
- **Issue 3.2:** No error handling in purchase service operations
- **Issue 3.3:** Minimal global error interceptor
- **Impact:** Silent failures, no error logs, poor debugging

### 🟡 **Priority 4 - Validation**
- **Issue 4.1:** Missing DTO validation decorators
- **Issue 4.2:** Business rule validation gaps (stock, returns)
- **Issue 4.3:** Type safety issues (any types)
- **Impact:** Invalid data entry, business logic violations

### 🟢 **Priority 5 - Data Integrity**
- **Issue 5.1:** Inconsistent soft delete patterns
- **Issue 5.2:** Missing database constraints
- **Issue 5.3:** Missing indexes for performance
- **Impact:** Data integrity issues, performance degradation

---

## Phase-by-Phase Implementation Plan

### **Phase 1: Fix SQL Injection Vulnerabilities** ⏱️ 3-5 days

**Scope:**
- Convert all raw SQL queries to parameterized queries
- Files: sale.service.ts, stock.service.ts, customer.service.ts, saleitem.service.ts, purchase-invoice.service.ts

**Testing Strategy:**
- Unit tests for each service method
- Integration tests with actual database
- Penetration testing with SQL injection payloads
- Regression testing for existing functionality

**Success Criteria:**
- ✅ Zero SQL injection vulnerabilities detected
- ✅ All existing API endpoints return same results
- ✅ No performance degradation

**Rollback Plan:**
- Keep original files as .backup
- Git branch: `fix/sql-injection`

---

### **Phase 2: Fix Bill Number Race Condition** ⏱️ 1-2 days

**Scope:**
- Update generate_bill_number() function with SELECT FOR UPDATE
- Add database-level locking
- File: sql/ddl/functions.sql

**Testing Strategy:**
- Concurrent transaction testing (simulate multiple sales at once)
- Load testing with multiple users
- Verify uniqueness of bill numbers under load
- Check fiscal year rollover logic

**Success Criteria:**
- ✅ No duplicate bill numbers under concurrent load (100+ simultaneous requests)
- ✅ Proper fiscal year handling
- ✅ Performance acceptable (< 100ms per call)

**Rollback Plan:**
- SQL migration with rollback script
- Git branch: `fix/bill-number-race-condition`

---

### **Phase 3: Add Transaction Wrappers** ⏱️ 2-3 days

**Scope:**
- Sale creation with transaction wrapper
- Purchase invoice creation with transaction wrapper
- Return processing with transaction wrapper
- Proper error handling and rollback

**Files:**
- sale.service.ts (create, update, delete methods)
- purchase-invoice.service.ts (create, remove methods)
- saleitem.service.ts (return operations)

**Testing Strategy:**
- Simulate failure at each step (bill generation, save, items save)
- Verify rollback occurs and no partial data
- Test transaction isolation levels
- Check for deadlocks under concurrent operations

**Success Criteria:**
- ✅ No orphaned sale headers without items
- ✅ Proper rollback on any step failure
- ✅ All operations atomic
- ✅ No deadlocks under normal load

**Rollback Plan:**
- Git branch: `fix/transaction-wrappers`

---

### **Phase 4: Comprehensive Error Handling** ⏱️ 2-3 days

**Scope:**
- Add try-catch blocks to all service methods
- Enhance global error interceptor
- Add structured error logging
- Return meaningful error messages

**Files:**
- All service files
- core/errors.interceptor.ts

**Testing Strategy:**
- Trigger various error scenarios (DB down, constraint violations, etc.)
- Verify proper error messages returned to client
- Check error logs for completeness
- Test error handling doesn't leak sensitive info

**Success Criteria:**
- ✅ All database operations wrapped in try-catch
- ✅ Meaningful error messages to frontend
- ✅ Comprehensive error logs
- ✅ No sensitive data in error responses

**Rollback Plan:**
- Git branch: `fix/error-handling`

---

### **Phase 5: Input Validation** ⏱️ 3-4 days

**Scope:**
- Add class-validator decorators to all DTOs
- Replace any types with proper interfaces
- Add validation pipe to main.ts

**Files:**
- All DTO files in modules/*/dto/
- Service method signatures

**Testing Strategy:**
- Send invalid data to each endpoint
- Verify proper validation errors returned
- Test edge cases (null, undefined, empty strings, negative numbers)
- Check performance impact

**Success Criteria:**
- ✅ All DTOs have validation decorators
- ✅ Invalid requests rejected with clear messages
- ✅ No any types in service methods
- ✅ No performance impact

**Rollback Plan:**
- Git branch: `fix/input-validation`

---

### **Phase 6: Business Rule Validations** ⏱️ 3-5 days

**Scope:**
- Stock availability checks before sale
- Expiry date validation
- Return quantity validation against original sale
- Customer existence checks
- Prevent deletion of completed sales

**Files:**
- sale.service.ts
- stock.service.ts
- saleitem.service.ts (returns)

**Testing Strategy:**
- Try to sell out-of-stock items
- Try to sell expired items
- Try to return more than purchased
- Try to delete completed/billed sales
- Verify proper error messages

**Success Criteria:**
- ✅ Cannot sell unavailable stock
- ✅ Cannot sell expired items
- ✅ Return quantity <= original sale quantity
- ✅ Cannot delete completed sales

**Rollback Plan:**
- Git branch: `fix/business-validations`

---

### **Phase 7: Standardize Soft Delete** ⏱️ 2-3 days

**Scope:**
- Choose single approach (isActive vs isArchived)
- Add soft delete interceptor
- Update all queries to filter soft-deleted records
- Add restore functionality

**Files:**
- base.entity.ts
- All service files

**Testing Strategy:**
- Soft delete records and verify they don't appear in queries
- Verify hard deletes only where appropriate
- Test restore functionality
- Check cascade behavior

**Success Criteria:**
- ✅ Consistent soft delete across all entities
- ✅ Soft-deleted records not in normal queries
- ✅ Restore functionality works
- ✅ No accidental data loss

**Rollback Plan:**
- Git branch: `fix/soft-delete-standardization`

---

### **Phase 8: Database Optimizations** ⏱️ 2-3 days

**Scope:**
- Add database constraints (CHECK, UNIQUE)
- Add indexes on frequently queried columns
- Optimize N+1 queries with batch operations

**Files:**
- sql/ddl/*.sql (new migration files)
- Service files for batch operations

**Testing Strategy:**
- Benchmark query performance before/after
- Test constraint violations are properly caught
- Load testing with large datasets
- Verify index usage with EXPLAIN ANALYZE

**Success Criteria:**
- ✅ Query performance improved by 30%+
- ✅ Database constraints prevent invalid data
- ✅ No N+1 query issues

**Rollback Plan:**
- SQL migration with rollback scripts
- Git branch: `fix/database-optimizations`

---

## Testing Infrastructure Needed

### Unit Testing
- **Framework:** Jest (already in NestJS)
- **Coverage Target:** 80%+ for service files
- **Focus:** Business logic, validation, error handling

### Integration Testing
- **Framework:** Supertest with test database
- **Coverage:** All API endpoints
- **Focus:** Transaction handling, data consistency

### Load Testing
- **Tool:** k6 or Artillery
- **Scenarios:**
  - 100 concurrent sales
  - Bill number generation under load
  - Multiple users accessing same stock

### Security Testing
- **Tool:** OWASP ZAP or manual testing
- **Focus:** SQL injection, authentication bypass

---

## Branch Strategy

```
main (protected)
  ├── revamp (current branch)
      ├── fix/sql-injection
      ├── fix/bill-number-race-condition
      ├── fix/transaction-wrappers
      ├── fix/error-handling
      ├── fix/input-validation
      ├── fix/business-validations
      ├── fix/soft-delete-standardization
      └── fix/database-optimizations
```

**Workflow:**
1. Create feature branch from `revamp`
2. Implement fix
3. Write tests
4. Run all tests (unit + integration)
5. Create PR with test results
6. Code review
7. Merge to `revamp` after approval
8. Test on `revamp` branch
9. Move to next phase

---

## Risk Mitigation

### Backup Strategy
- Full database backup before each phase
- Keep backups for 30 days
- Test restore procedure

### Deployment Strategy
- Deploy to staging environment first
- Run full test suite
- Monitor for 24-48 hours
- Deploy to production during low-traffic hours
- Have rollback plan ready

### Rollback Triggers
- Critical bugs found in production
- Performance degradation > 20%
- Data corruption detected
- Security vulnerabilities introduced

---

## Progress Tracking

| Phase | Status | Branch | Started | Completed | Tested | Merged |
|-------|--------|--------|---------|-----------|--------|--------|
| 1. SQL Injection | Not Started | - | - | - | - | - |
| 2. Bill Number Race | Not Started | - | - | - | - | - |
| 3. Transaction Wrappers | Not Started | - | - | - | - | - |
| 4. Error Handling | Not Started | - | - | - | - | - |
| 5. Input Validation | Not Started | - | - | - | - | - |
| 6. Business Validations | Not Started | - | - | - | - | - |
| 7. Soft Delete | Not Started | - | - | - | - | - |
| 8. DB Optimizations | Not Started | - | - | - | - | - |

---

## Next Steps

1. **Review this plan** with team and get approval
2. **Set up testing infrastructure** (test database, testing frameworks)
3. **Create backup procedures**
4. **Start Phase 1**: Fix SQL Injection Vulnerabilities
5. **Update progress tracker** after each phase

---

## Notes

- Each phase should be **completed, tested, and merged** before moving to the next
- **No skipping phases** - dependencies exist between phases
- Maintain **backward compatibility** where possible
- Document **all breaking changes**
- Update **API documentation** after each phase if needed

---

## Estimated Total Timeline

- **Critical Fixes (Phases 1-4):** 8-13 days
- **High Priority (Phases 5-6):** 6-9 days
- **Optimizations (Phases 7-8):** 4-6 days
- **Total:** 18-28 days (3.5-5.5 weeks)

With proper testing and review cycles, budget **6-8 weeks** for complete implementation.
