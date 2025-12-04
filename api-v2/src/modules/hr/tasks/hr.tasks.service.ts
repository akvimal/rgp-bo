import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScoringService } from '../scoring/scoring.service';
import { DataSource } from 'typeorm';

@Injectable()
export class HrTasksService {
  private readonly logger = new Logger(HrTasksService.name);

  constructor(
    private scoringService: ScoringService,
    private dataSource: DataSource,
  ) {}

  /**
   * Calculate monthly scores for all users
   * Runs on the 1st day of every month at 2:00 AM
   */
  @Cron('0 2 1 * *')
  async calculateMonthlyScores() {
    this.logger.log('Starting monthly score calculation...');

    try {
      const now = new Date();
      // Calculate for the previous month
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const month = now.getMonth() === 0 ? 12 : now.getMonth();

      await this.scoringService.batchCalculateMonthlyScores(year, month);

      this.logger.log(
        `Successfully calculated monthly scores for ${year}-${month}`,
      );
    } catch (error) {
      this.logger.error('Failed to calculate monthly scores', error);
    }
  }

  /**
   * Refresh materialized views for leaderboards
   * Runs every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async refreshMaterializedViews() {
    this.logger.debug('Refreshing materialized views...');

    try {
      await this.dataSource.query('SELECT refresh_hr_materialized_views()');
      this.logger.debug('Materialized views refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh materialized views', error);
    }
  }

  /**
   * Create new attendance partitions
   * Runs on the 1st day of every month at 1:00 AM
   */
  @Cron('0 1 1 * *')
  async createAttendancePartitions() {
    this.logger.log('Creating new attendance partitions...');

    try {
      const now = new Date();
      // Create partition for 3 months ahead
      const targetDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const monthStr = month.toString().padStart(2, '0');

      const partitionName = `attendance_${year}_${monthStr}`;
      const startDate = `${year}-${monthStr}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

      // Check if partition already exists
      const exists = await this.dataSource.query(
        `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
        [partitionName],
      );

      if (exists.length === 0) {
        await this.dataSource.query(`
          CREATE TABLE ${partitionName} PARTITION OF attendance
          FOR VALUES FROM ('${startDate}') TO ('${endDate}')
        `);

        this.logger.log(`Created partition: ${partitionName}`);
      } else {
        this.logger.debug(`Partition ${partitionName} already exists`);
      }
    } catch (error) {
      this.logger.error('Failed to create attendance partitions', error);
    }
  }

  /**
   * Clean up old performance logs
   * Runs every Sunday at 3:00 AM
   */
  @Cron('0 3 * * 0')
  async cleanupOldLogs() {
    this.logger.log('Cleaning up old performance logs...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days

      const tables = [
        'system_performance_log',
        'api_usage_log',
        'query_performance_log',
        'hr_audit_log',
      ];

      for (const table of tables) {
        const result = await this.dataSource.query(
          `DELETE FROM ${table} WHERE timestamp < $1`,
          [cutoffDate],
        );

        this.logger.log(
          `Deleted ${result[1]} old records from ${table}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old logs', error);
    }
  }
}
