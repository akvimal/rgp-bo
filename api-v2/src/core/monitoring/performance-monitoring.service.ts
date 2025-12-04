import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemPerformanceLog } from '../../entities/system-performance-log.entity';
import { ApiUsageLog } from '../../entities/api-usage-log.entity';
import { QueryPerformanceLog } from '../../entities/query-performance-log.entity';
import { HrAuditLog } from '../../entities/hr-audit-log.entity';

@Injectable()
export class PerformanceMonitoringService {
  constructor(
    @InjectRepository(SystemPerformanceLog)
    private systemPerfRepo: Repository<SystemPerformanceLog>,
    @InjectRepository(ApiUsageLog)
    private apiUsageRepo: Repository<ApiUsageLog>,
    @InjectRepository(QueryPerformanceLog)
    private queryPerfRepo: Repository<QueryPerformanceLog>,
    @InjectRepository(HrAuditLog)
    private auditLogRepo: Repository<HrAuditLog>,
  ) {}

  /**
   * Log system performance metric
   */
  async logSystemMetric(
    metricName: string,
    metricValue: number,
    endpoint?: string,
    additionalData?: any,
  ): Promise<void> {
    try {
      const log = this.systemPerfRepo.create({
        metricname: metricName,
        metricvalue: metricValue,
        endpoint,
        additionaldata: additionalData,
      });
      await this.systemPerfRepo.save(log);
    } catch (error) {
      console.error('Failed to log system metric:', error);
    }
  }

  /**
   * Log API usage
   */
  async logApiUsage(data: {
    userId?: number;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    ipAddress?: string;
    userAgent?: string;
    requestBody?: any;
    responseBody?: any;
  }): Promise<void> {
    try {
      const log = this.apiUsageRepo.create({
        userid: data.userId,
        endpoint: data.endpoint,
        method: data.method,
        statuscode: data.statusCode,
        responsetimems: data.responseTimeMs,
        ipaddress: data.ipAddress,
        useragent: data.userAgent,
        requestbody: data.requestBody,
        responsebody: data.responseBody,
      });
      await this.apiUsageRepo.save(log);
    } catch (error) {
      console.error('Failed to log API usage:', error);
    }
  }

  /**
   * Log query performance
   */
  async logQueryPerformance(
    queryName: string,
    executionTimeMs: number,
    querySql?: string,
    rowsAffected?: number,
    queryParams?: any,
  ): Promise<void> {
    try {
      const log = this.queryPerfRepo.create({
        queryname: queryName,
        executiontimems: executionTimeMs,
        querysql: querySql,
        rowsaffected: rowsAffected,
        queryparams: queryParams,
      });
      await this.queryPerfRepo.save(log);
    } catch (error) {
      console.error('Failed to log query performance:', error);
    }
  }

  /**
   * Log HR audit trail
   */
  async logAudit(data: {
    userId?: number;
    action: string;
    resourceType: string;
    resourceId?: number;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const log = this.auditLogRepo.create({
        userid: data.userId,
        action: data.action,
        resourcetype: data.resourceType,
        resourceid: data.resourceId,
        oldvalues: data.oldValues,
        newvalues: data.newValues,
        ipaddress: data.ipAddress,
      });
      await this.auditLogRepo.save(log);
    } catch (error) {
      console.error('Failed to log audit trail:', error);
    }
  }

  /**
   * Get performance metrics for a time period
   */
  async getSystemMetrics(
    startDate: Date,
    endDate: Date,
    metricName?: string,
  ): Promise<SystemPerformanceLog[]> {
    const query = this.systemPerfRepo
      .createQueryBuilder('log')
      .where('log.recordedat BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });

    if (metricName) {
      query.andWhere('log.metricname = :metricName', { metricName });
    }

    return query.orderBy('log.recordedat', 'DESC').getMany();
  }

  /**
   * Get slow API calls (> 1000ms)
   */
  async getSlowApiCalls(limit: number = 100): Promise<ApiUsageLog[]> {
    return this.apiUsageRepo
      .createQueryBuilder('log')
      .where('log.responsetimems > :threshold', { threshold: 1000 })
      .orderBy('log.responsetimems', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Get API error rate
   */
  async getApiErrorRate(
    startDate: Date,
    endDate: Date,
  ): Promise<{ total: number; errors: number; errorRate: number }> {
    const total = await this.apiUsageRepo
      .createQueryBuilder('log')
      .where('log.timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getCount();

    const errors = await this.apiUsageRepo
      .createQueryBuilder('log')
      .where('log.timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('log.statuscode >= :errorCode', { errorCode: 400 })
      .getCount();

    return {
      total,
      errors,
      errorRate: total > 0 ? (errors / total) * 100 : 0,
    };
  }

  /**
   * Get audit trail for a specific resource
   */
  async getAuditTrail(
    resourceType: string,
    resourceId: number,
    limit: number = 50,
  ): Promise<HrAuditLog[]> {
    return this.auditLogRepo
      .createQueryBuilder('log')
      .where('log.resourcetype = :resourceType', { resourceType })
      .andWhere('log.resourceid = :resourceId', { resourceId })
      .orderBy('log.timestamp', 'DESC')
      .limit(limit)
      .getMany();
  }
}
