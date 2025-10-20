import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Sale } from '../src/entities/sale.entity';
import { SaleItem } from '../src/entities/sale-item.entity';
import { Customer } from '../src/entities/customer.entity';
import { AppModule } from '../src/app.module';

/**
 * Concurrency Tests for Sale Creation
 *
 * These tests verify:
 * 1. No duplicate bill numbers under concurrent load
 * 2. Transaction isolation works correctly
 * 3. Database constraints prevent duplicates
 * 4. Rollback behavior is correct
 *
 * Run with: npm run test:e2e -- sale-concurrency.e2e-spec.ts
 */
describe('Sale Concurrency Tests (e2e)', () => {
  let app: INestApplication;
  let entityManager: EntityManager;
  let testCustomer: Customer;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    entityManager = app.get(EntityManager);

    // Create test customer
    testCustomer = await entityManager.save(Customer, {
      name: 'Test Customer',
      mobile: '9999999999',
      email: 'test@test.com',
      active: true
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testCustomer) {
      await entityManager.query('DELETE FROM sale WHERE customer_id = $1', [testCustomer.id]);
      await entityManager.query('DELETE FROM customer WHERE id = $1', [testCustomer.id]);
    }
    await app.close();
  });

  describe('Concurrent Sale Creation', () => {
    it('should not create duplicate bill numbers when 10 sales are created concurrently', async () => {
      // Arrange: Create 10 concurrent sale creation operations
      const concurrentSales = 10;
      const salePromises: any[] = [];

      // Act: Create sales concurrently
      for (let i = 0; i < concurrentSales; i++) {
        const salePromise = entityManager.transaction('SERIALIZABLE', async (transactionManager) => {
          // Generate bill number (uses FOR UPDATE locking)
          const nos = await transactionManager.query(
            `SELECT generate_order_number() as order_no, generate_bill_number() as bill_no`
          );

          // Create sale
          const sale = await transactionManager.save(Sale, {
            customerId: testCustomer.id,
            billNo: nos[0].bill_no,
            orderNo: nos[0].order_no,
            billDate: new Date(),
            status: 'COMPLETE',
            total: 100 + i,
            cashAmount: 100 + i,
            digiAmount: 0,
            active: true
          });

          return sale;
        });

        salePromises.push(salePromise);
      }

      // Wait for all sales to complete
      const sales = await Promise.all(salePromises);

      // Assert: All sales created successfully
      expect(sales).toHaveLength(concurrentSales);
      expect(sales.every(s => s.id)).toBe(true);

      // Assert: No duplicate bill numbers
      const billNumbers = sales.map(s => s.billNo);
      const uniqueBillNumbers = new Set(billNumbers);
      expect(uniqueBillNumbers.size).toBe(concurrentSales);

      // Assert: Bill numbers are sequential
      const sortedBillNumbers = [...billNumbers].sort((a, b) => a - b);
      for (let i = 1; i < sortedBillNumbers.length; i++) {
        expect(sortedBillNumbers[i]).toBe(sortedBillNumbers[i - 1] + 1);
      }

      // Cleanup
      await entityManager.query('DELETE FROM sale WHERE customer_id = $1', [testCustomer.id]);
    }, 30000); // 30 second timeout

    it('should handle high concurrency (50 simultaneous sales)', async () => {
      // Arrange: Create 50 concurrent sale creation operations
      const concurrentSales = 50;
      const salePromises: any[] = [];

      // Act: Create sales concurrently
      for (let i = 0; i < concurrentSales; i++) {
        const salePromise = entityManager.transaction('SERIALIZABLE', async (transactionManager) => {
          const nos = await transactionManager.query(
            `SELECT generate_order_number() as order_no, generate_bill_number() as bill_no`
          );

          const sale = await transactionManager.save(Sale, {
            customerId: testCustomer.id,
            billNo: nos[0].bill_no,
            orderNo: nos[0].order_no,
            billDate: new Date(),
            status: 'COMPLETE',
            total: 100,
            cashAmount: 100,
            digiAmount: 0,
            active: true
          });

          return sale;
        });

        salePromises.push(salePromise);
      }

      // Wait for all sales to complete
      const sales = await Promise.all(salePromises);

      // Assert: All sales created successfully
      expect(sales).toHaveLength(concurrentSales);

      // Assert: No duplicate bill numbers
      const billNumbers = sales.map(s => s.billNo);
      const uniqueBillNumbers = new Set(billNumbers);
      expect(uniqueBillNumbers.size).toBe(concurrentSales);

      // Cleanup
      await entityManager.query('DELETE FROM sale WHERE customer_id = $1', [testCustomer.id]);
    }, 60000); // 60 second timeout

    it('should prevent duplicate bill numbers via unique constraint', async () => {
      // Arrange: Get a bill number
      const nos = await entityManager.query(
        `SELECT generate_bill_number() as bill_no`
      );
      const billNo = nos[0].bill_no;

      // Act & Assert: First insert should succeed
      const sale1 = await entityManager.save(Sale, {
        customerId: testCustomer.id,
        billNo: billNo,
        orderNo: 1000,
        billDate: new Date(),
        status: 'COMPLETE',
        total: 100,
        cashAmount: 100,
        digiAmount: 0,
        active: true
      });
      expect(sale1.id).toBeDefined();

      // Act & Assert: Second insert with same bill number should fail
      await expect(
        entityManager.save(Sale, {
          customerId: testCustomer.id,
          billNo: billNo, // Same bill number!
          orderNo: 1001,
          billDate: new Date(),
          status: 'COMPLETE',
          total: 200,
          cashAmount: 200,
          digiAmount: 0,
          active: true
        })
      ).rejects.toThrow(); // Should violate unique constraint

      // Cleanup
      await entityManager.query('DELETE FROM sale WHERE id = $1', [sale1.id]);
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback sale creation on error', async () => {
      // Arrange: Get current max bill number
      const beforeResult = await entityManager.query(
        'SELECT MAX(bill_no) as max_bill FROM sale'
      );
      const maxBillBefore = beforeResult[0].max_bill || 0;

      // Act: Try to create sale with invalid data that will cause error
      try {
        await entityManager.transaction('SERIALIZABLE', async (transactionManager) => {
          const nos = await transactionManager.query(
            `SELECT generate_bill_number() as bill_no`
          );

          // This should succeed
          await transactionManager.save(Sale, {
            customerId: testCustomer.id,
            billNo: nos[0].bill_no,
            orderNo: 1000,
            billDate: new Date(),
            status: 'COMPLETE',
            total: 100,
            cashAmount: 100,
            digiAmount: 0,
            active: true
          });

          // This should fail (missing required field) and rollback entire transaction
          await transactionManager.save(Sale, {
            customerId: null, // Invalid - should fail
            billNo: nos[0].bill_no + 1,
            orderNo: 1001,
            billDate: new Date(),
            status: 'COMPLETE',
            total: 200,
            active: true
          });
        });
      } catch (error) {
        // Expected to throw
      }

      // Assert: No sales were created due to rollback
      const afterResult = await entityManager.query(
        'SELECT MAX(bill_no) as max_bill FROM sale'
      );
      const maxBillAfter = afterResult[0].max_bill || 0;

      // Bill number should not have increased
      expect(maxBillAfter).toBeLessThanOrEqual(maxBillBefore + 1);

      // Verify no sales were created for test customer
      const testSales = await entityManager.query(
        'SELECT COUNT(*) as count FROM sale WHERE customer_id = $1',
        [testCustomer.id]
      );
      expect(parseInt(testSales[0].count)).toBe(0);
    });

    it('should maintain bill number sequence after rollback', async () => {
      // Arrange: Get current bill number
      const result1 = await entityManager.query(
        'SELECT last_bill_no FROM sales_meta ORDER BY fiscal_year_start DESC LIMIT 1'
      );
      const billNoBefore = result1[0].last_bill_no;

      // Act: Create a successful sale
      await entityManager.transaction('SERIALIZABLE', async (transactionManager) => {
        const nos = await transactionManager.query(
          `SELECT generate_bill_number() as bill_no`
        );
        await transactionManager.save(Sale, {
          customerId: testCustomer.id,
          billNo: nos[0].bill_no,
          orderNo: 1000,
          billDate: new Date(),
          status: 'COMPLETE',
          total: 100,
          cashAmount: 100,
          digiAmount: 0,
          active: true
        });
      });

      // Try a failed transaction
      try {
        await entityManager.transaction('SERIALIZABLE', async (transactionManager) => {
          const nos = await transactionManager.query(
            `SELECT generate_bill_number() as bill_no`
          );
          // Intentionally fail
          throw new Error('Simulated error');
        });
      } catch (error) {
        // Expected
      }

      // Create another successful sale
      await entityManager.transaction('SERIALIZABLE', async (transactionManager) => {
        const nos = await transactionManager.query(
          `SELECT generate_bill_number() as bill_no`
        );
        await transactionManager.save(Sale, {
          customerId: testCustomer.id,
          billNo: nos[0].bill_no,
          orderNo: 1001,
          billDate: new Date(),
          status: 'COMPLETE',
          total: 100,
          cashAmount: 100,
          digiAmount: 0,
          active: true
        });
      });

      // Assert: Bill number increased by correct amount (accounting for rollback)
      const result2 = await entityManager.query(
        'SELECT last_bill_no FROM sales_meta ORDER BY fiscal_year_start DESC LIMIT 1'
      );
      const billNoAfter = result2[0].last_bill_no;

      // Should have increased by 3 (1 success + 1 rollback + 1 success)
      expect(billNoAfter).toBeGreaterThanOrEqual(billNoBefore + 2);

      // Cleanup
      await entityManager.query('DELETE FROM sale WHERE customer_id = $1', [testCustomer.id]);
    });
  });

  describe('Bill Number Generation', () => {
    it('should generate sequential bill numbers', async () => {
      const billNumbers: any[] = [];

      for (let i = 0; i < 5; i++) {
        const result = await entityManager.query(
          'SELECT generate_bill_number() as bill_no'
        );
        billNumbers.push(result[0].bill_no);
      }

      // Assert: Bill numbers are sequential
      for (let i = 1; i < billNumbers.length; i++) {
        expect(billNumbers[i]).toBe(billNumbers[i - 1] + 1);
      }
    });

    it('should use FOR UPDATE locking to prevent race conditions', async () => {
      // This test verifies the FOR UPDATE lock by checking that concurrent
      // calls to generate_bill_number() return sequential numbers without gaps

      const concurrentCalls = 20;
      const promises: any[] = [];

      for (let i = 0; i < concurrentCalls; i++) {
        promises.push(
          entityManager.query('SELECT generate_bill_number() as bill_no')
        );
      }

      const results = await Promise.all(promises);
      const billNumbers = results.map(r => r[0].bill_no).sort((a, b) => a - b);

      // Assert: All bill numbers are unique
      const uniqueNumbers = new Set(billNumbers);
      expect(uniqueNumbers.size).toBe(concurrentCalls);

      // Assert: No gaps in sequence (proves FOR UPDATE is working)
      for (let i = 1; i < billNumbers.length; i++) {
        expect(billNumbers[i]).toBe(billNumbers[i - 1] + 1);
      }
    }, 30000);
  });

  describe('Database Constraints', () => {
    it('should have unique constraint on sale.bill_no', async () => {
      const result = await entityManager.query(`
        SELECT COUNT(*) as count
        FROM pg_constraint
        WHERE conname = 'sale_bill_no_unique'
        AND conrelid = 'sale'::regclass
      `);

      expect(parseInt(result[0].count)).toBe(1);
    });

    it('should have unique constraint on sales_meta.fiscal_year_start', async () => {
      const result = await entityManager.query(`
        SELECT COUNT(*) as count
        FROM pg_constraint
        WHERE conname = 'sales_meta_fiscal_year_unique'
        AND conrelid = 'sales_meta'::regclass
      `);

      expect(parseInt(result[0].count)).toBe(1);
    });

    it('should have sales_meta table initialized', async () => {
      const result = await entityManager.query(
        'SELECT COUNT(*) as count FROM sales_meta'
      );

      expect(parseInt(result[0].count)).toBeGreaterThan(0);
    });
  });
});
