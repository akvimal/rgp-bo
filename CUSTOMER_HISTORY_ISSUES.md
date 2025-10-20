# Customer History Issues Analysis

## Executive Summary

The customer history functionality has **3 critical issues** when viewing customer sales records by phone number:

1. ❌ **ORDER BY syntax error** - Using backticks instead of string
2. ⚠️ **Route path conflict** - Mobile lookup route conflicts with ID route
3. ⚠️ **Date calculation bug** - Leap year logic is incorrect

## Issue Details

### 🔴 CRITICAL: Issue 1 - ORDER BY Syntax Error

**Location**: `api-v2/src/modules/app/customers/customer.service.ts:150`

**Problem**:
```typescript
.orderBy(`sale.billdate`,'DESC')  // ❌ WRONG - using backticks (template literal)
```

**Why it fails**:
- Template literals (backticks) are being used where a regular string is expected
- Should use regular quotes for the column name

**Impact**:
- Query will fail when trying to order results
- Customers cannot view their sales history sorted by date

**Fix**:
```typescript
.orderBy('sale.bill_date','DESC')  // ✅ CORRECT
```

---

### 🟡 MEDIUM: Issue 2 - Route Path Conflict

**Location**: `api-v2/src/modules/app/customers/customer.controller.ts:35-43`

**Problem**:
```typescript
@Get(':mobile/mobile')           // Route 1: /customers/1234567890/mobile
async findOneByMobile(@Param('mobile') mobile: string) {
  return this.customerService.findByMobile(mobile);
}

@Get(':id')                      // Route 2: /customers/1234567890
async findOne(@Param('id') id: number) {
  return this.customerService.findById(id);
}
```

**Why it's problematic**:
- Route `/customers/:mobile/mobile` (line 35) comes BEFORE `/customers/:id` (line 40)
- Express/NestJS routes are matched in order
- A request to `/customers/1234567890/mobile` will work correctly
- BUT the `/mobile` suffix is confusing and non-standard

**Impact**:
- Confusion about which endpoint to use
- Non-standard API design
- Potential for incorrect usage

**Recommended Fix**:
```typescript
// Option 1: Use query parameter
@Get()
async findByMobile(@Query('mobile') mobile?: string) {
  if (mobile) {
    return this.customerService.findByMobile(mobile);
  }
  return this.customerService.findAll();
}

// Option 2: Use dedicated route
@Get('search/mobile/:mobile')
async findOneByMobile(@Param('mobile') mobile: string) {
  return this.customerService.findByMobile(mobile);
}
```

---

### 🟡 MEDIUM: Issue 3 - Leap Year Calculation Bug

**Location**: `api-v2/src/modules/app/customers/customer.service.ts:132-137`

**Problem**:
```typescript
let day = 31;
if(month == 2)
  day = year%4 == 0 ? 29 : 28;  // ❌ WRONG - Simplified leap year check
if(month <= 6 && month != 2 && month%2 == 0)
  day = 30;
if(month > 8 && month%2 == 1)
  day = 30;
```

**Why it's wrong**:
1. **Leap year logic is oversimplified**:
   - Years divisible by 4 are NOT always leap years
   - 1900 is NOT a leap year (divisible by 100)
   - 2000 IS a leap year (divisible by 400)
   - Correct rule: `(year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)`

2. **Unnecessary complexity**:
   - JavaScript's Date object handles this automatically
   - Manual calculation is error-prone

**Impact**:
- Incorrect date ranges for February in certain years (e.g., 1900, 2100)
- May miss sales records at end of month

**Recommended Fix**:
```typescript
// Use JavaScript's built-in date handling
const startDate = new Date(year, month - 1, 1);
const endDate = new Date(year, month, 0);  // Day 0 = last day of previous month

const startDateStr = startDate.toISOString().split('T')[0];
const endDateStr = endDate.toISOString().split('T')[0];
```

---

## Additional SQL Injection Risk

**Location**: `api-v2/src/modules/app/customers/customer.service.ts:148-149`

**Current code**:
```typescript
.where(`sale.status = 'COMPLETE' and items.status = 'Complete' and sale.customer_id = :custid
 and sale.bill_date between :startDate and :endDate`, { custid, startDate, endDate })
```

**Risk Level**: LOW (parameters are properly bound)

While the use of template literals looks suspicious, the actual parameters are properly bound using `:custid`, `:startDate`, and `:endDate`. However, the hardcoded strings `'COMPLETE'` and `'Complete'` should be constants.

**Recommended improvement**:
```typescript
const SaleStatus = {
  COMPLETE: 'COMPLETE',
  PENDING: 'PENDING'
} as const;

.where('sale.status = :saleStatus and items.status = :itemStatus and sale.customer_id = :custid and sale.bill_date between :startDate and :endDate', {
  saleStatus: SaleStatus.COMPLETE,
  itemStatus: 'Complete',
  custid,
  startDate,
  endDate
})
```

---

## Recommended Fixes Priority

### 1. **IMMEDIATE** - Fix ORDER BY syntax error
This breaks the functionality completely.

```typescript
// customer.service.ts:150
.orderBy('sale.bill_date', 'DESC')  // Changed from backticks to quotes
```

### 2. **HIGH** - Simplify date calculation
Remove manual date logic and use JavaScript's Date object.

```typescript
async findCustomerSaleByPeriod(custid, year, month) {
  // Use JavaScript's built-in date handling
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);  // Last day of month

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  return await this.saleRepository.createQueryBuilder("sale")
    .innerJoinAndSelect("sale.customer", "customer")
    .leftJoinAndSelect("sale.items", "items")
    .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
    .leftJoinAndSelect("purchaseitem.product", "product")
    .select(['sale','customer','items','purchaseitem','product'])
    .where('sale.status = :saleStatus and items.status = :itemStatus and sale.customer_id = :custid and sale.bill_date between :startDate and :endDate', {
      saleStatus: 'COMPLETE',
      itemStatus: 'Complete',
      custid,
      startDate: startDateStr,
      endDate: endDateStr
    })
    .orderBy('sale.bill_date', 'DESC')
    .getMany();
}
```

### 3. **MEDIUM** - Improve mobile search route
Make the API more RESTful and clear.

```typescript
// customer.controller.ts
@Get('search/mobile/:mobile')
async findByMobile(@Param('mobile') mobile: string) {
  return this.customerService.findByMobile(mobile);
}
```

---

## Testing Recommendations

After fixes, test these scenarios:

1. **Search customer by phone number**
   ```
   GET /customers/search/mobile/9876543210
   ```

2. **Get customer sale periods**
   ```
   GET /customers/123/periods
   ```

3. **Get sales for February 2024** (leap year)
   ```
   GET /customers/123/2024/2/orders
   ```

4. **Get sales for February 1900** (not a leap year despite divisible by 4)
   ```
   GET /customers/123/1900/2/orders
   ```

5. **Verify ORDER BY works correctly**
   - Check that sales are sorted by date in descending order

---

## Root Cause Analysis

The issues stem from:
1. **Template literal misuse** - Using backticks where strings are expected
2. **Route design** - Non-standard API patterns
3. **Manual date calculation** - Reinventing built-in functionality

## Impact Assessment

- **Issue 1 (ORDER BY)**: BREAKS customer history viewing completely
- **Issue 2 (Route)**: Causes API confusion but functional
- **Issue 3 (Leap year)**: Edge case bug, rarely manifests

## Related Files

- `api-v2/src/modules/app/customers/customer.service.ts` (main issues)
- `api-v2/src/modules/app/customers/customer.controller.ts` (route issue)
- `api-v2/src/entities/sale.entity.ts` (column name reference)
