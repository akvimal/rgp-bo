import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

export interface VarianceAlert {
  type: 'LARGE_ADJUSTMENT' | 'MULTIPLE_ADJUSTMENTS' | 'AFTER_HOURS' | 'NEGATIVE_STOCK';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  productId: number;
  productTitle?: string;
  userId?: number;
  userName?: string;
  quantity?: number;
  timestamp: Date;
  details: string;
}

export interface DailyVarianceSummary {
  date: Date;
  totalAdjustments: number;
  largeAdjustments: number;
  afterHoursMovements: number;
  usersWithHighActivity: number;
  totalValueAtRisk: number;
  alerts: VarianceAlert[];
}

@Injectable()
export class StockVarianceDetectionService {
  private readonly logger = new Logger(StockVarianceDetectionService.name);

  // Configuration thresholds
  private readonly LARGE_ADJUSTMENT_THRESHOLD = 100; // units
  private readonly HIGH_ACTIVITY_THRESHOLD = 5; // adjustments per hour per user
  private readonly BUSINESS_START_HOUR = 9; // 9 AM
  private readonly BUSINESS_END_HOUR = 21; // 9 PM

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Daily variance monitoring job
   * Runs every day at 7:00 AM to analyze previous day's activity
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyVarianceCheck() {
    this.logger.log('🔍 Starting daily stock variance check...');

    try {
      const summary = await this.generateDailyVarianceSummary();

      // Log summary
      this.logger.log(`📊 Daily Variance Summary for ${summary.date.toISOString().split('T')[0]}:`);
      this.logger.log(`   Total adjustments: ${summary.totalAdjustments}`);
      this.logger.log(`   Large adjustments (>${this.LARGE_ADJUSTMENT_THRESHOLD} units): ${summary.largeAdjustments}`);
      this.logger.log(`   After-hours movements: ${summary.afterHoursMovements}`);
      this.logger.log(`   Users with high activity: ${summary.usersWithHighActivity}`);
      this.logger.log(`   Alerts generated: ${summary.alerts.length}`);

      // Log critical alerts
      const criticalAlerts = summary.alerts.filter(a => a.severity === 'CRITICAL');
      if (criticalAlerts.length > 0) {
        this.logger.warn(`⚠️ CRITICAL: ${criticalAlerts.length} critical variance alerts detected!`);
        criticalAlerts.forEach(alert => {
          this.logger.warn(
            `   - ${alert.type}: ${alert.details} (Product: ${alert.productTitle || alert.productId})`
          );
        });
      }

      // Save summary to database
      await this.saveVarianceSummary(summary);

      this.logger.log('✅ Daily stock variance check completed');
    } catch (error) {
      this.logger.error(`Failed to run daily variance check: ${error.message}`, error.stack);
    }
  }

  /**
   * Real-time variance detection on stock adjustment
   * Call this method whenever a stock adjustment is made
   */
  async checkStockAdjustment(
    productId: number,
    quantity: number,
    userId: number,
    reason: string
  ): Promise<VarianceAlert[]> {
    const alerts: VarianceAlert[] = [];

    try {
      // Get product details
      const product = await this.dataSource.query(
        `SELECT id, title FROM product WHERE id = $1`,
        [productId]
      );

      const productTitle = product[0]?.title || 'Unknown';

      // Check 1: Large negative adjustment
      if (quantity < 0 && Math.abs(quantity) > this.LARGE_ADJUSTMENT_THRESHOLD) {
        alerts.push({
          type: 'LARGE_ADJUSTMENT',
          severity: Math.abs(quantity) > 500 ? 'CRITICAL' : 'HIGH',
          productId,
          productTitle,
          userId,
          quantity,
          timestamp: new Date(),
          details: `Large negative adjustment detected: ${quantity} units. Reason: ${reason}`
        });

        this.logger.warn(
          `🚨 Large negative adjustment: Product ${productTitle} (${productId}), ` +
          `Quantity: ${quantity}, User: ${userId}, Reason: ${reason}`
        );
      }

      // Check 2: After-hours movement
      const currentHour = new Date().getHours();
      if (currentHour < this.BUSINESS_START_HOUR || currentHour >= this.BUSINESS_END_HOUR) {
        alerts.push({
          type: 'AFTER_HOURS',
          severity: 'MEDIUM',
          productId,
          productTitle,
          userId,
          quantity,
          timestamp: new Date(),
          details: `Stock adjustment made outside business hours (${currentHour}:00). Reason: ${reason}`
        });

        this.logger.warn(
          `⏰ After-hours adjustment: Product ${productTitle} (${productId}), ` +
          `Time: ${currentHour}:00, User: ${userId}`
        );
      }

      // Check 3: Multiple adjustments by same user in last hour
      const userActivityCheck = await this.dataSource.query(
        `SELECT COUNT(*) as adjustment_count
         FROM product_qtychange
         WHERE created_by = $1
           AND created_on >= NOW() - INTERVAL '1 hour'`,
        [userId]
      );

      const userAdjustmentCount = parseInt(userActivityCheck[0]?.adjustment_count || 0);
      if (userAdjustmentCount >= this.HIGH_ACTIVITY_THRESHOLD) {
        // Get user name
        const user = await this.dataSource.query(
          `SELECT full_name FROM app_user WHERE id = $1`,
          [userId]
        );

        alerts.push({
          type: 'MULTIPLE_ADJUSTMENTS',
          severity: userAdjustmentCount > 10 ? 'HIGH' : 'MEDIUM',
          productId,
          productTitle,
          userId,
          userName: user[0]?.full_name,
          quantity,
          timestamp: new Date(),
          details: `User has made ${userAdjustmentCount} adjustments in the last hour`
        });

        this.logger.warn(
          `👤 High user activity: ${user[0]?.full_name || userId} made ${userAdjustmentCount} adjustments in last hour`
        );
      }

      // Check 4: Negative stock warning
      const stockCheck = await this.dataSource.query(
        `SELECT COALESCE(SUM(quantity_remaining), 0) as total_stock
         FROM product_batch
         WHERE product_id = $1 AND status = 'ACTIVE'`,
        [productId]
      );

      const currentStock = parseFloat(stockCheck[0]?.total_stock || 0);
      if (currentStock < 0) {
        alerts.push({
          type: 'NEGATIVE_STOCK',
          severity: 'CRITICAL',
          productId,
          productTitle,
          quantity,
          timestamp: new Date(),
          details: `Product has negative stock: ${currentStock} units`
        });

        this.logger.error(
          `❌ CRITICAL: Negative stock detected for product ${productTitle} (${productId}): ${currentStock} units`
        );
      }

    } catch (error) {
      this.logger.error(`Error checking stock adjustment: ${error.message}`, error.stack);
    }

    return alerts;
  }

  /**
   * Generate daily variance summary for previous day
   */
  private async generateDailyVarianceSummary(): Promise<DailyVarianceSummary> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all adjustments from yesterday
    const adjustments = await this.dataSource.query(
      `SELECT
        pqc.id,
        pqc.item_id,
        pqc.qty,
        pqc.reason,
        pqc.created_on,
        pqc.created_by,
        p.id as product_id,
        p.title as product_title,
        au.full_name as user_name
       FROM product_qtychange pqc
       LEFT JOIN purchase_invoice_item pii ON pqc.item_id = pii.id
       LEFT JOIN product p ON pii.product_id = p.id
       LEFT JOIN app_user au ON pqc.created_by = au.id
       WHERE pqc.created_on >= $1
         AND pqc.created_on < $2
         AND pqc.active = true
       ORDER BY pqc.created_on DESC`,
      [yesterday, today]
    );

    const alerts: VarianceAlert[] = [];
    let largeAdjustments = 0;
    let afterHoursMovements = 0;
    const userActivityMap = new Map<number, number>();

    // Analyze each adjustment
    for (const adj of adjustments) {
      const adjustmentHour = new Date(adj.created_on).getHours();

      // Check for large adjustments
      if (adj.qty < 0 && Math.abs(adj.qty) > this.LARGE_ADJUSTMENT_THRESHOLD) {
        largeAdjustments++;
        alerts.push({
          type: 'LARGE_ADJUSTMENT',
          severity: Math.abs(adj.qty) > 500 ? 'CRITICAL' : 'HIGH',
          productId: adj.product_id,
          productTitle: adj.product_title,
          userId: adj.created_by,
          userName: adj.user_name,
          quantity: adj.qty,
          timestamp: new Date(adj.created_on),
          details: `Large negative adjustment: ${adj.qty} units. Reason: ${adj.reason || 'Not specified'}`
        });
      }

      // Check for after-hours movements
      if (adjustmentHour < this.BUSINESS_START_HOUR || adjustmentHour >= this.BUSINESS_END_HOUR) {
        afterHoursMovements++;
        alerts.push({
          type: 'AFTER_HOURS',
          severity: 'MEDIUM',
          productId: adj.product_id,
          productTitle: adj.product_title,
          userId: adj.created_by,
          userName: adj.user_name,
          quantity: adj.qty,
          timestamp: new Date(adj.created_on),
          details: `After-hours adjustment at ${adjustmentHour}:00. Reason: ${adj.reason || 'Not specified'}`
        });
      }

      // Track user activity
      const count = userActivityMap.get(adj.created_by) || 0;
      userActivityMap.set(adj.created_by, count + 1);
    }

    // Check for users with high activity
    const usersWithHighActivity = Array.from(userActivityMap.entries()).filter(
      ([userId, count]) => count >= this.HIGH_ACTIVITY_THRESHOLD
    ).length;

    // Calculate total value at risk (large negative adjustments)
    const valueAtRisk = await this.dataSource.query(
      `SELECT COALESCE(SUM(ABS(pqc.qty) * COALESCE(pii.ptr_value, 0)), 0) as total_value
       FROM product_qtychange pqc
       LEFT JOIN purchase_invoice_item pii ON pqc.item_id = pii.id
       WHERE pqc.created_on >= $1
         AND pqc.created_on < $2
         AND pqc.qty < -$3
         AND pqc.active = true`,
      [yesterday, today, this.LARGE_ADJUSTMENT_THRESHOLD]
    );

    return {
      date: yesterday,
      totalAdjustments: adjustments.length,
      largeAdjustments,
      afterHoursMovements,
      usersWithHighActivity,
      totalValueAtRisk: parseFloat(valueAtRisk[0]?.total_value || 0),
      alerts
    };
  }

  /**
   * Save variance summary to database for historical tracking
   */
  private async saveVarianceSummary(summary: DailyVarianceSummary): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO stock_variance_log
          (check_date, total_adjustments, large_adjustments, after_hours_movements,
           users_with_high_activity, total_value_at_risk, alerts_generated, checked_on)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [
          summary.date,
          summary.totalAdjustments,
          summary.largeAdjustments,
          summary.afterHoursMovements,
          summary.usersWithHighActivity,
          summary.totalValueAtRisk,
          summary.alerts.length
        ]
      );

      this.logger.log(`Variance summary saved to database for ${summary.date.toISOString().split('T')[0]}`);
    } catch (error) {
      this.logger.error(`Failed to save variance summary: ${error.message}`, error.stack);
    }
  }

  /**
   * Get variance statistics for a date range
   */
  async getVarianceStatistics(startDate: Date, endDate: Date): Promise<any> {
    const result = await this.dataSource.query(
      `SELECT
        check_date,
        total_adjustments,
        large_adjustments,
        after_hours_movements,
        users_with_high_activity,
        total_value_at_risk,
        alerts_generated
       FROM stock_variance_log
       WHERE check_date BETWEEN $1 AND $2
       ORDER BY check_date DESC`,
      [startDate, endDate]
    );

    return result;
  }

  /**
   * Get recent variance alerts
   */
  async getRecentAlerts(days: number = 7): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.dataSource.query(
      `SELECT
        check_date,
        alerts_generated,
        large_adjustments,
        total_value_at_risk
       FROM stock_variance_log
       WHERE check_date >= $1
         AND alerts_generated > 0
       ORDER BY check_date DESC`,
      [startDate]
    );

    return result;
  }
}
