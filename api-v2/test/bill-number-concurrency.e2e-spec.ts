import { Client } from 'pg';

/**
 * Simple Concurrency Test for Bill Number Generation
 *
 * This test uses direct PostgreSQL connections to test concurrency
 * without requiring the full NestJS application context.
 *
 * Run with: npm run test:e2e -- bill-number-concurrency.e2e-spec.ts
 */
describe('Bill Number Concurrency Test (Direct SQL)', () => {
  let client: Client;

  beforeAll(async () => {
    // Create a direct PostgreSQL connection
    client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rgpdb',
      user: process.env.DB_USER || 'rgpapp',
      password: process.env.DB_PASS || 'r9pAdmin7',
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  describe('Database Constraints', () => {
    it('should have unique constraint on sale.bill_no', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM pg_constraint
        WHERE conname = 'sale_bill_no_unique'
        AND conrelid = 'sale'::regclass
      `);

      expect(parseInt(result.rows[0].count)).toBe(1);
    });

    it('should have unique constraint on sales_meta.fiscal_year_start', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM pg_constraint
        WHERE conname = 'sales_meta_fiscal_year_unique'
        AND conrelid = 'sales_meta'::regclass
      `);

      expect(parseInt(result.rows[0].count)).toBe(1);
    });

    it('should have sales_meta table initialized', async () => {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM sales_meta'
      );

      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
    });
  });

  describe('Bill Number Generation', () => {
    it('should generate sequential bill numbers', async () => {
      const billNumbers: number[] = [];

      for (let i = 0; i < 5; i++) {
        const result = await client.query('SELECT generate_bill_number() as bill_no');
        billNumbers.push(result.rows[0].bill_no);
      }

      // Assert: Bill numbers are sequential
      for (let i = 1; i < billNumbers.length; i++) {
        expect(billNumbers[i]).toBe(billNumbers[i - 1] + 1);
      }
    });

    it('should use FOR UPDATE locking to prevent race conditions', async () => {
      // Test concurrent bill number generation
      const concurrentCalls = 20;
      const promises: Promise<any>[] = [];

      // Create multiple concurrent connections
      for (let i = 0; i < concurrentCalls; i++) {
        const promise = (async () => {
          const conn = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'rgpdb',
            user: process.env.DB_USER || 'rgpapp',
            password: process.env.DB_PASS || 'r9pAdmin7',
          });
          await conn.connect();

          try {
            const result = await conn.query('SELECT generate_bill_number() as bill_no');
            return result.rows[0].bill_no;
          } finally {
            await conn.end();
          }
        })();

        promises.push(promise);
      }

      const billNumbers = await Promise.all(promises);

      // Assert: All bill numbers are unique
      const uniqueNumbers = new Set(billNumbers);
      expect(uniqueNumbers.size).toBe(concurrentCalls);

      // Assert: Bill numbers are sequential (no gaps, proving FOR UPDATE works)
      const sortedBillNumbers = [...billNumbers].sort((a, b) => a - b);
      for (let i = 1; i < sortedBillNumbers.length; i++) {
        expect(sortedBillNumbers[i]).toBe(sortedBillNumbers[i - 1] + 1);
      }
    }, 30000);
  });

  describe('Duplicate Prevention', () => {
    it('should not allow duplicate bill numbers via unique constraint', async () => {
      // Get a bill number
      const result = await client.query('SELECT generate_bill_number() as bill_no');
      const billNo = result.rows[0].bill_no;

      // Try to insert a sale with this bill number
      await client.query(`
        INSERT INTO sale (bill_no, order_no, bill_date, status, total, cash_amount, digi_amount, active)
        VALUES ($1, 1000, CURRENT_DATE, 'COMPLETE', 100, 100, 0, true)
      `, [billNo]);

      // Try to insert another sale with the same bill number (should fail)
      await expect(
        client.query(`
          INSERT INTO sale (bill_no, order_no, bill_date, status, total, cash_amount, digi_amount, active)
          VALUES ($1, 1001, CURRENT_DATE, 'COMPLETE', 200, 200, 0, true)
        `, [billNo])
      ).rejects.toThrow();

      // Cleanup
      await client.query('DELETE FROM sale WHERE bill_no = $1', [billNo]);
    });

    it('should have no existing duplicate bill numbers in database', async () => {
      const result = await client.query(`
        SELECT bill_no, COUNT(*) as count
        FROM sale
        WHERE bill_no IS NOT NULL
        GROUP BY bill_no
        HAVING COUNT(*) > 1
      `);

      expect(result.rows.length).toBe(0);
    });
  });

  describe('Transaction Behavior', () => {
    it('should rollback bill number generation on transaction failure', async () => {
      // Get current max bill number
      const beforeResult = await client.query(
        'SELECT last_bill_no FROM sales_meta ORDER BY fiscal_year_start DESC LIMIT 1'
      );
      const billNoBefore = beforeResult.rows[0].last_bill_no;

      // Try a transaction that will fail
      try {
        await client.query('BEGIN');
        const nos = await client.query('SELECT generate_bill_number() as bill_no');
        const billNo = nos.rows[0].bill_no;

        // This will fail (missing required fields)
        await client.query(`
          INSERT INTO sale (bill_no, order_no)
          VALUES ($1, 1000)
        `, [billNo]);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        // Expected to fail
      }

      // Check that bill number did NOT move forward (transaction rolled back successfully)
      // This is correct behavior - the function update is part of the transaction
      const afterResult = await client.query(
        'SELECT last_bill_no FROM sales_meta ORDER BY fiscal_year_start DESC LIMIT 1'
      );
      const billNoAfter = afterResult.rows[0].last_bill_no;

      // Bill number should NOT have changed (transaction rolled back)
      expect(billNoAfter).toBe(billNoBefore);
    });
  });

  describe('Stress Test', () => {
    it('should handle 50 concurrent bill number generations', async () => {
      const concurrentCalls = 50;
      const promises: Promise<number>[] = [];

      // Create many concurrent connections
      for (let i = 0; i < concurrentCalls; i++) {
        const promise = (async () => {
          const conn = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'rgpdb',
            user: process.env.DB_USER || 'rgpapp',
            password: process.env.DB_PASS || 'r9pAdmin7',
          });
          await conn.connect();

          try {
            const result = await conn.query('SELECT generate_bill_number() as bill_no');
            return result.rows[0].bill_no;
          } finally {
            await conn.end();
          }
        })();

        promises.push(promise);
      }

      const billNumbers = await Promise.all(promises);

      // Assert: All bill numbers are unique
      const uniqueNumbers = new Set(billNumbers);
      expect(uniqueNumbers.size).toBe(concurrentCalls);

      // Assert: No gaps in sequence
      const sortedBillNumbers = [...billNumbers].sort((a, b) => a - b);
      for (let i = 1; i < sortedBillNumbers.length; i++) {
        expect(sortedBillNumbers[i]).toBe(sortedBillNumbers[i - 1] + 1);
      }
    }, 60000);
  });
});
