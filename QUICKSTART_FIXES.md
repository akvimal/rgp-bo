# Quick Start Guide: Implementing Fixes

This guide will help you start working on the improvement phases systematically.

---

## Initial Setup

### 1. Set Up Test Infrastructure

```bash
# Navigate to API directory
cd api-v2

# Install dependencies (if not already)
npm install

# Install additional testing tools
npm install --save-dev @nestjs/testing supertest @types/supertest

# Verify tests work
npm run test
```

### 2. Create Test Database

```bash
# Create a separate test database
# Update docker-compose.yml or create docker-compose.test.yml

# Example test database configuration
DATABASE_URL=postgresql://postgres:password@localhost:5433/rgp_test
```

### 3. Set Up Database Backup

```bash
# Create backup directory
mkdir -p backups

# Backup current database
docker exec rgp-postgres pg_dump -U postgres rgp > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Or use the script below
```

**Create `backup.sh`:**
```bash
#!/bin/bash
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="rgp-postgres"
DB_NAME="rgp"
DB_USER="postgres"

mkdir -p $BACKUP_DIR
docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/backup_$TIMESTAMP.sql
echo "Backup created: $BACKUP_DIR/backup_$TIMESTAMP.sql"
```

---

## Workflow for Each Phase

### Step 1: Prepare

```bash
# 1. Ensure you're on revamp branch
git checkout revamp
git pull origin revamp

# 2. Create backup
./backup.sh

# 3. Create phase branch
git checkout -b fix/sql-injection  # Example for Phase 1

# 4. Copy testing checklist
cp TESTING_CHECKLIST.md .github/PHASE_1_CHECKLIST.md

# 5. Open both documents
# - IMPROVEMENT_PLAN.md (reference)
# - .github/PHASE_1_CHECKLIST.md (track progress)
```

### Step 2: Implement

```bash
# 1. Make code changes
# 2. Run tests frequently
npm run test

# 3. Check test coverage
npm run test -- --coverage

# 4. Lint code
npm run lint
```

### Step 3: Test

```bash
# Unit tests
npm run test

# Integration tests (if setup)
npm run test:e2e

# Manual testing
# - Start the application
npm run start:dev

# - Test with Postman/curl/frontend
```

### Step 4: Review & Commit

```bash
# 1. Review changes
git status
git diff

# 2. Stage changes
git add .

# 3. Commit with descriptive message
git commit -m "fix: [Phase 1] Parameterize SQL queries in sale service

- Converted raw queries to TypeORM query builder
- Added parameterization for all user inputs
- Added unit tests for SQL injection prevention
- All existing tests passing

Refs: IMPROVEMENT_PLAN.md Phase 1"

# 4. Push to remote
git push origin fix/sql-injection
```

### Step 5: Create Pull Request

**PR Title Format:**
```
[Phase X] Brief Description
```

**PR Description Template:**
```markdown
## Phase
Phase X: [Phase Name]

## Changes
- [Change 1]
- [Change 2]
- [Change 3]

## Testing
- [x] Unit tests passing
- [x] Integration tests passing
- [x] Manual testing completed
- [x] No performance degradation

## Test Results
```
[Paste test results]
```

## Before/After
**Before:** [Description of problem]
**After:** [Description of solution]

## Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes (describe below)

[Description if applicable]

## Checklist
- [x] Code follows project conventions
- [x] Tests written and passing
- [x] Documentation updated
- [x] Self-reviewed
- [x] Ready for review

## References
- IMPROVEMENT_PLAN.md - Phase X
- .github/PHASE_X_CHECKLIST.md
```

### Step 6: Merge & Verify

```bash
# After PR approval
git checkout revamp
git pull origin revamp

# Verify everything works
npm run test

# Tag the completion
git tag phase-1-complete
git push origin phase-1-complete

# Update progress tracker in IMPROVEMENT_PLAN.md
```

---

## Testing Commands Reference

### Unit Tests
```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- sale.service.spec.ts

# Run with coverage
npm run test -- --coverage

# Watch mode
npm run test -- --watch
```

### Integration Tests
```bash
# Run e2e tests
npm run test:e2e

# Run specific e2e test
npm run test:e2e -- sale.e2e-spec.ts
```

### Manual API Testing
```bash
# Start dev server
npm run start:dev

# Test endpoint with curl
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"test": "data"}'
```

---

## Common Issues & Solutions

### Issue: Tests failing after changes
**Solution:**
```bash
# Clear Jest cache
npm run test -- --clearCache

# Reinstall dependencies
rm -rf node_modules
npm install
```

### Issue: Database connection in tests
**Solution:**
```typescript
// Use separate test database configuration
// In test files:
beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: 'localhost',
        port: 5433, // Different port for test DB
        database: 'rgp_test',
        // ... other config
      }),
    ],
  }).compile();
});
```

### Issue: Port already in use
**Solution:**
```bash
# Find process using port
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

---

## Phase 1 Quick Start (SQL Injection Fix)

### Files to Update (Priority Order):

1. **sale.service.ts**
   ```bash
   code api-v2/src/modules/app/sales/sale.service.ts
   ```

2. **stock.service.ts**
   ```bash
   code api-v2/src/modules/app/stock/stock.service.ts
   ```

3. **customer.service.ts**
   ```bash
   code api-v2/src/modules/app/customers/customer.service.ts
   ```

4. **saleitem.service.ts**
   ```bash
   code api-v2/src/modules/app/returns/saleitem.service.ts
   ```

### Example Fix (Before/After):

**Before (Vulnerable):**
```typescript
async findSale(id: number) {
  const query = `SELECT * FROM sale WHERE id = ${id}`;
  return this.repo.query(query);
}
```

**After (Fixed):**
```typescript
async findSale(id: number) {
  return this.repo.findOne({
    where: { id },
    relations: ['saleItems', 'customer']
  });
}

// Or using query builder if complex:
async findSale(id: number) {
  return this.repo
    .createQueryBuilder('sale')
    .where('sale.id = :id', { id })
    .leftJoinAndSelect('sale.saleItems', 'items')
    .leftJoinAndSelect('sale.customer', 'customer')
    .getOne();
}
```

### Testing the Fix:

**Create test file:** `sale.service.spec.ts`
```typescript
describe('SaleService - SQL Injection Prevention', () => {
  it('should not allow SQL injection via id parameter', async () => {
    const maliciousId = "1 OR 1=1; DROP TABLE sale;--";

    await expect(
      service.findSale(maliciousId as any)
    ).rejects.toThrow();
  });

  it('should return correct sale for valid id', async () => {
    const result = await service.findSale(1);
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });
});
```

---

## Help & Support

**If stuck:**
1. Refer to IMPROVEMENT_PLAN.md for context
2. Check NestJS documentation: https://docs.nestjs.com/
3. Check TypeORM documentation: https://typeorm.io/
4. Review existing tests for patterns

**Before asking for help, provide:**
- Which phase you're working on
- What you've tried
- Error messages (full stack trace)
- Relevant code snippets

---

## Progress Tracking

Update this section after each phase:

- [ ] Phase 1: SQL Injection - Started: _____ / Completed: _____
- [ ] Phase 2: Bill Number Race - Started: _____ / Completed: _____
- [ ] Phase 3: Transaction Wrappers - Started: _____ / Completed: _____
- [ ] Phase 4: Error Handling - Started: _____ / Completed: _____
- [ ] Phase 5: Input Validation - Started: _____ / Completed: _____
- [ ] Phase 6: Business Validations - Started: _____ / Completed: _____
- [ ] Phase 7: Soft Delete - Started: _____ / Completed: _____
- [ ] Phase 8: DB Optimizations - Started: _____ / Completed: _____

**Target Completion Date:** [Set your goal]
**Actual Completion Date:** [Fill when done]

---

## Next Steps

1. ✅ Review IMPROVEMENT_PLAN.md
2. ⬜ Set up test infrastructure
3. ⬜ Create database backup
4. ⬜ Start Phase 1: SQL Injection Fix
5. ⬜ Complete all 8 phases
6. ⬜ Deploy to production

Good luck! 🚀
