import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { BatchAllocationService } from 'src/modules/app/stock/batch-allocation.service';

/**
 * Expiry Monitoring Service
 * Automated monitoring and alerts for product batch expiry dates
 * Issue #127 - Batch/Expiry Tracking with FEFO Enforcement
 *
 * Cron Jobs:
 * - Daily at 8:00 AM: Check near-expiry products (30/60/90 days)
 * - Daily at midnight: Mark expired batches as EXPIRED
 */
@Injectable()
export class ExpiryMonitoringService {
  private readonly logger = new Logger(ExpiryMonitoringService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly batchAllocationService: BatchAllocationService
  ) {
    this.logger.log('Expiry Monitoring Service initialized');
  }

  /**
   * Daily Near-Expiry Check (8:00 AM)
   * Checks for products expiring in 30, 60, and 90 days
   * Logs warnings and generates alerts
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkNearExpiryProducts() {
    this.logger.log('Starting daily near-expiry check...');

    try {
      // Check 30-day threshold (CRITICAL)
      const batches30 = await this.batchAllocationService.getNearExpiryProducts(30);

      // Check 60-day threshold (WARNING)
      const batches60 = await this.batchAllocationService.getNearExpiryProducts(60);

      // Check 90-day threshold (CAUTION)
      const batches90 = await this.batchAllocationService.getNearExpiryProducts(90);

      // Calculate total value at risk
      const valueAtRisk30 = batches30.reduce((sum, b) => sum + parseFloat(b.value_at_risk || 0), 0);
      const valueAtRisk60 = batches60.reduce((sum, b) => sum + parseFloat(b.value_at_risk || 0), 0);
      const valueAtRisk90 = batches90.reduce((sum, b) => sum + parseFloat(b.value_at_risk || 0), 0);

      // Log summary
      this.logger.log(
        `Near-Expiry Summary:\n` +
        `  - 30 days: ${batches30.length} batches, Value at Risk: ₹${valueAtRisk30.toFixed(2)}\n` +
        `  - 60 days: ${batches60.length} batches, Value at Risk: ₹${valueAtRisk60.toFixed(2)}\n` +
        `  - 90 days: ${batches90.length} batches, Value at Risk: ₹${valueAtRisk90.toFixed(2)}`
      );

      // CRITICAL: Log 30-day batches
      if (batches30.length > 0) {
        this.logger.warn(
          `🚨 CRITICAL: ${batches30.length} batches expiring within 30 days!`
        );

        batches30.forEach(batch => {
          this.logger.warn(
            `  - ${batch.title} | Batch: ${batch.batch_number} | ` +
            `Expiry: ${batch.expiry_date} | Qty: ${batch.quantity_remaining} | ` +
            `Value: ₹${batch.value_at_risk}`
          );
        });

        // TODO: Send email notification
        // await this.sendExpiryAlert('CRITICAL', batches30, valueAtRisk30);
      }

      // WARNING: Log 60-day batches
      if (batches60.length > 0) {
        this.logger.warn(
          `⚠️  WARNING: ${batches60.length} batches expiring within 60 days`
        );
      }

      // CAUTION: Log 90-day batches
      if (batches90.length > 0) {
        this.logger.log(
          `ℹ️  CAUTION: ${batches90.length} batches expiring within 90 days`
        );
      }

      // Store audit record
      await this.logExpiryCheck({
        batches_30_days: batches30.length,
        batches_60_days: batches60.length,
        batches_90_days: batches90.length,
        value_at_risk_30: valueAtRisk30,
        value_at_risk_60: valueAtRisk60,
        value_at_risk_90: valueAtRisk90,
        checked_on: new Date()
      });

      this.logger.log('Daily near-expiry check completed successfully');
    } catch (error) {
      this.logger.error('Error during near-expiry check:', error.stack);
      throw error;
    }
  }

  /**
   * Daily Expiry Status Update (Midnight)
   * Automatically marks expired batches as EXPIRED
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markExpiredBatches() {
    this.logger.log('Starting automatic expiry status update...');

    try {
      // Get batches that expired today or earlier
      const expiredBatches = await this.dataSource.query(
        `SELECT id, batch_number, expiry_date, quantity_remaining, product_id
         FROM product_batch
         WHERE expiry_date <= CURRENT_DATE
           AND status = 'ACTIVE'
           AND active = true`
      );

      if (expiredBatches.length === 0) {
        this.logger.log('No batches to mark as expired');
        return;
      }

      this.logger.warn(
        `Found ${expiredBatches.length} expired batches. Updating status...`
      );

      // Update batch status to EXPIRED
      const result = await this.dataSource.query(
        `UPDATE product_batch
         SET status = 'EXPIRED',
             updated_on = CURRENT_TIMESTAMP
         WHERE expiry_date <= CURRENT_DATE
           AND status = 'ACTIVE'
           AND active = true
         RETURNING id, batch_number, expiry_date, quantity_remaining`
      );

      // Log each expired batch
      result.forEach(batch => {
        this.logger.warn(
          `Marked as EXPIRED: Batch ${batch.batch_number} | ` +
          `Expired: ${batch.expiry_date} | Remaining Qty: ${batch.quantity_remaining}`
        );

        // TODO: Log EXPIRED movement
        // await this.batchAllocationService.logBatchMovement(
        //   batch.id, 'EXPIRED', batch.quantity_remaining,
        //   'AUTO_EXPIRY_CHECK', batch.id, 0, 'Automatically expired by cron job'
        // );
      });

      this.logger.log(
        `Successfully marked ${result.length} batches as EXPIRED`
      );

      // Store audit record
      await this.logExpiryStatusUpdate({
        batches_expired: result.length,
        total_quantity_expired: result.reduce((sum, b) => sum + parseInt(b.quantity_remaining || 0), 0),
        updated_on: new Date()
      });

    } catch (error) {
      this.logger.error('Error during expiry status update:', error.stack);
      throw error;
    }
  }

  /**
   * Manual trigger for near-expiry check (for testing or on-demand)
   */
  async manualExpiryCheck(): Promise<any> {
    this.logger.log('Manual expiry check triggered');
    await this.checkNearExpiryProducts();

    const summary = await this.dataSource.query(`
      SELECT
        COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
              AND status = 'ACTIVE' THEN 1 END) AS critical_30_days,
        COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
              AND status = 'ACTIVE' THEN 1 END) AS warning_60_days,
        COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
              AND status = 'ACTIVE' THEN 1 END) AS caution_90_days,
        COUNT(CASE WHEN expiry_date <= CURRENT_DATE AND status = 'ACTIVE' THEN 1 END) AS already_expired
      FROM product_batch
      WHERE active = true
    `);

    return summary[0];
  }

  /**
   * Manual trigger for expiry status update (for testing or on-demand)
   */
  async manualExpiryStatusUpdate(): Promise<any> {
    this.logger.log('Manual expiry status update triggered');
    await this.markExpiredBatches();

    const summary = await this.dataSource.query(`
      SELECT COUNT(*) as expired_count
      FROM product_batch
      WHERE status = 'EXPIRED' AND active = true
    `);

    return summary[0];
  }

  /**
   * Log expiry check audit record
   */
  private async logExpiryCheck(data: any): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO expiry_check_log
         (batches_30_days, batches_60_days, batches_90_days,
          value_at_risk_30, value_at_risk_60, value_at_risk_90, checked_on)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          data.batches_30_days,
          data.batches_60_days,
          data.batches_90_days,
          data.value_at_risk_30,
          data.value_at_risk_60,
          data.value_at_risk_90,
          data.checked_on
        ]
      );
    } catch (error) {
      // Table may not exist yet - log warning but don't fail
      this.logger.warn('Could not log expiry check (table may not exist yet)');
    }
  }

  /**
   * Log expiry status update audit record
   */
  private async logExpiryStatusUpdate(data: any): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO expiry_status_update_log
         (batches_expired, total_quantity_expired, updated_on)
         VALUES ($1, $2, $3)`,
        [data.batches_expired, data.total_quantity_expired, data.updated_on]
      );
    } catch (error) {
      // Table may not exist yet - log warning but don't fail
      this.logger.warn('Could not log expiry status update (table may not exist yet)');
    }
  }

  /**
   * Get expiry monitoring statistics
   */
  async getExpiryStatistics(): Promise<any> {
    const stats = await this.dataSource.query(`
      SELECT
        -- Current status
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active_batches,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) AS expired_batches,

        -- Near expiry counts
        COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
              AND status = 'ACTIVE' THEN 1 END) AS expiring_30_days,
        COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE + INTERVAL '31 days' AND CURRENT_DATE + INTERVAL '60 days'
              AND status = 'ACTIVE' THEN 1 END) AS expiring_31_60_days,
        COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE + INTERVAL '61 days' AND CURRENT_DATE + INTERVAL '90 days'
              AND status = 'ACTIVE' THEN 1 END) AS expiring_61_90_days,

        -- Value calculations
        COALESCE(SUM(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
              AND status = 'ACTIVE' THEN quantity_remaining * ptr_cost END), 0) AS value_at_risk_30,
        COALESCE(SUM(CASE WHEN status = 'EXPIRED' THEN quantity_remaining * ptr_cost END), 0) AS value_expired,

        -- Overall metrics
        COALESCE(SUM(quantity_remaining), 0) AS total_quantity,
        COALESCE(SUM(quantity_remaining * ptr_cost), 0) AS total_value
      FROM product_batch
      WHERE active = true
    `);

    return stats[0];
  }

  /**
   * Get products requiring urgent action (expiring within 7 days)
   */
  async getUrgentExpiryProducts(): Promise<any[]> {
    return await this.dataSource.query(`
      SELECT
        pb.id AS batch_id,
        pb.batch_number,
        pb.expiry_date,
        pb.quantity_remaining,
        (pb.expiry_date - CURRENT_DATE) AS days_to_expiry,
        p.id AS product_id,
        p.title AS product_title,
        p.category,
        v.name AS vendor_name,
        pb.ptr_cost,
        (pb.quantity_remaining * pb.ptr_cost) AS value_at_risk
      FROM product_batch pb
      INNER JOIN product p ON pb.product_id = p.id
      LEFT JOIN vendor v ON pb.vendor_id = v.id
      WHERE pb.status = 'ACTIVE'
        AND pb.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND pb.quantity_remaining > 0
        AND pb.active = true
      ORDER BY pb.expiry_date ASC, pb.quantity_remaining DESC
    `);
  }
}
