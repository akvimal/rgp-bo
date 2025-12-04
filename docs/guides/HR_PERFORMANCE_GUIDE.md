# HR Features - Performance & Tracking Implementation Guide

**Date:** 2025-11-30
**Focus:** High-Performance Implementation with Comprehensive Tracking
**Status:** Implementation Ready

---

## Overview

This guide focuses on implementing HR features with:
- ⚡ **Optimal Performance** - Fast queries, efficient storage, caching strategies
- 📊 **Comprehensive Tracking** - Analytics, monitoring, audit trails
- 🔍 **Observability** - Metrics, logs, tracing for debugging and optimization

---

## 1. Performance-Optimized Database Design

### 1.1 Schema with Performance Indexes

#### Shift Table - Optimized
```sql
CREATE TABLE public.shift (
    id SERIAL4 PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INT DEFAULT 0,
    grace_period_minutes INT DEFAULT 15,
    store_id INT4 REFERENCES stores(id),
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id),
    CONSTRAINT shift_un UNIQUE (name, store_id)
);

-- Performance Indexes
CREATE INDEX idx_shift_active ON shift(active, archive)
    WHERE active = true AND archive = false;
CREATE INDEX idx_shift_store ON shift(store_id)
    WHERE active = true;
```

#### User Shift - With Range Indexes
```sql
CREATE TABLE public.user_shift (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL REFERENCES app_user(id),
    shift_id INT4 NOT NULL REFERENCES shift(id),
    effective_from DATE NOT NULL,
    effective_to DATE,
    days_of_week JSONB NOT NULL,  -- Changed to JSONB for better performance
    is_default BOOL DEFAULT false,
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id)
);

-- High-performance indexes
CREATE INDEX idx_user_shift_user_dates ON user_shift(user_id, effective_from, effective_to)
    WHERE active = true AND archive = false;
CREATE INDEX idx_user_shift_current ON user_shift(user_id)
    WHERE active = true AND archive = false AND effective_to IS NULL;
CREATE INDEX idx_user_shift_days ON user_shift USING GIN(days_of_week)
    WHERE active = true;

-- Prevent overlapping shifts
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE INDEX idx_user_shift_no_overlap ON user_shift USING GIST (
    user_id,
    daterange(effective_from, COALESCE(effective_to, '2099-12-31'::date), '[]')
);
```

#### Attendance - Partitioned by Date
```sql
CREATE TABLE public.attendance (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL REFERENCES app_user(id),
    attendance_date DATE NOT NULL,
    shift_id INT4 REFERENCES shift(id),

    clock_in_time TIMESTAMPTZ,
    clock_out_time TIMESTAMPTZ,
    clock_in_photo_path VARCHAR(500),
    clock_out_photo_path VARCHAR(500),
    clock_in_ip VARCHAR(45),
    clock_out_ip VARCHAR(45),
    clock_in_device VARCHAR(200),
    clock_out_device VARCHAR(200),

    total_hours DECIMAL(5,2),
    is_late BOOL DEFAULT false,
    late_minutes INT DEFAULT 0,
    is_early_departure BOOL DEFAULT false,
    early_departure_minutes INT DEFAULT 0,

    status VARCHAR(20) DEFAULT 'PENDING',
    remarks TEXT,
    is_manual_entry BOOL DEFAULT false,

    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id),

    CONSTRAINT attendance_un UNIQUE (user_id, attendance_date)
) PARTITION BY RANGE (attendance_date);

-- Create partitions for current and future months
CREATE TABLE attendance_2025_11 PARTITION OF attendance
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE attendance_2025_12 PARTITION OF attendance
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE attendance_2026_01 PARTITION OF attendance
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Indexes on each partition automatically
CREATE INDEX idx_attendance_user_date ON attendance(user_id, attendance_date DESC);
CREATE INDEX idx_attendance_date ON attendance(attendance_date DESC);
CREATE INDEX idx_attendance_status ON attendance(status, attendance_date);
CREATE INDEX idx_attendance_user_status ON attendance(user_id, status)
    WHERE status IN ('PENDING', 'PRESENT');
```

#### Leave Request - Optimized
```sql
CREATE TABLE public.leave_request (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL REFERENCES app_user(id),
    leave_type_id INT4 NOT NULL REFERENCES leave_type(id),

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(3,1) NOT NULL,
    reason TEXT NOT NULL,
    document_path VARCHAR(500),

    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    applied_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_by INT4 REFERENCES app_user(id),
    approved_on TIMESTAMPTZ,
    rejection_reason TEXT,

    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id)
);

-- Optimized indexes
CREATE INDEX idx_leave_request_user_status ON leave_request(user_id, status, applied_on DESC);
CREATE INDEX idx_leave_request_pending ON leave_request(status, applied_on)
    WHERE status = 'PENDING';
CREATE INDEX idx_leave_request_dates ON leave_request(start_date, end_date)
    WHERE status = 'APPROVED';
CREATE INDEX idx_leave_request_user_year ON leave_request(user_id, EXTRACT(YEAR FROM start_date))
    WHERE status = 'APPROVED';

-- Prevent overlapping leave requests
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE leave_request
ADD CONSTRAINT leave_request_no_overlap
EXCLUDE USING gist (
    user_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
) WHERE (status = 'APPROVED');
```

#### User Score - With Materialized View
```sql
CREATE TABLE public.user_score (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL REFERENCES app_user(id),
    score_date DATE NOT NULL,
    score_period VARCHAR(20) DEFAULT 'MONTHLY',

    attendance_score DECIMAL(5,2) DEFAULT 0,
    punctuality_score DECIMAL(5,2) DEFAULT 0,
    working_hours_score DECIMAL(5,2) DEFAULT 0,
    reliability_score DECIMAL(5,2) DEFAULT 0,

    total_score DECIMAL(5,2) DEFAULT 0,
    grade VARCHAR(2),

    total_working_days INT DEFAULT 0,
    present_days INT DEFAULT 0,
    absent_days INT DEFAULT 0,
    late_arrivals INT DEFAULT 0,
    early_departures INT DEFAULT 0,
    total_hours_worked DECIMAL(6,2) DEFAULT 0,

    calculated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT user_score_un UNIQUE (user_id, score_date, score_period)
);

-- Performance indexes
CREATE INDEX idx_user_score_user_period ON user_score(user_id, score_period, score_date DESC);
CREATE INDEX idx_user_score_leaderboard ON user_score(score_period, score_date, total_score DESC);
CREATE INDEX idx_user_score_grade ON user_score(grade, score_date DESC)
    WHERE score_period = 'MONTHLY';

-- Materialized view for current month leaderboard (fast access)
CREATE MATERIALIZED VIEW mv_current_month_leaderboard AS
SELECT
    us.user_id,
    u.full_name,
    us.total_score,
    us.grade,
    us.present_days,
    us.late_arrivals,
    us.total_hours_worked,
    ROW_NUMBER() OVER (ORDER BY us.total_score DESC) as rank
FROM user_score us
JOIN app_user u ON us.user_id = u.id
WHERE us.score_period = 'MONTHLY'
  AND us.score_date = DATE_TRUNC('month', CURRENT_DATE)::DATE
ORDER BY us.total_score DESC;

CREATE UNIQUE INDEX idx_mv_leaderboard_user ON mv_current_month_leaderboard(user_id);

-- Refresh materialized view daily
-- (Can be triggered by cron job)
```

### 1.2 Performance Tracking Tables

#### System Performance Metrics
```sql
CREATE TABLE system_performance_log (
    id SERIAL8 PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_unit VARCHAR(20),
    endpoint VARCHAR(200),
    execution_time_ms INT,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_perf_log_metric ON system_performance_log(metric_name, recorded_at DESC);
CREATE INDEX idx_perf_log_endpoint ON system_performance_log(endpoint, recorded_at DESC);

-- Partition by month for better performance
```

#### API Usage Analytics
```sql
CREATE TABLE api_usage_log (
    id SERIAL8 PRIMARY KEY,
    user_id INT4 REFERENCES app_user(id),
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT,
    response_time_ms INT,
    request_size_bytes INT,
    response_size_bytes INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
);

CREATE INDEX idx_api_usage_user ON api_usage_log(user_id, timestamp DESC);
CREATE INDEX idx_api_usage_endpoint ON api_usage_log(endpoint, timestamp DESC);
CREATE INDEX idx_api_usage_errors ON api_usage_log(status_code, timestamp DESC)
    WHERE status_code >= 400;
```

#### Database Query Analytics
```sql
CREATE TABLE query_performance_log (
    id SERIAL8 PRIMARY KEY,
    query_name VARCHAR(100) NOT NULL,
    query_hash VARCHAR(64),
    execution_time_ms INT NOT NULL,
    rows_returned INT,
    rows_affected INT,
    service_name VARCHAR(100),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query_perf_name ON query_performance_log(query_name, timestamp DESC);
CREATE INDEX idx_query_perf_slow ON query_performance_log(execution_time_ms DESC, timestamp DESC)
    WHERE execution_time_ms > 1000; -- Slow queries (>1s)
```

---

## 2. Performance Optimization Strategies

### 2.1 Caching Strategy

#### Redis Cache Configuration
```typescript
// api-v2/src/config/cache.config.ts
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

export const cacheConfig = {
  store: redisStore,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  ttl: 300, // 5 minutes default
  max: 1000, // Maximum number of items in cache
};

// Cache keys strategy
export const CacheKeys = {
  USER_SHIFT: (userId: number, date: string) => `user_shift:${userId}:${date}`,
  ATTENDANCE_TODAY: (userId: number) => `attendance:${userId}:${new Date().toISOString().split('T')[0]}`,
  LEAVE_BALANCE: (userId: number, year: number) => `leave_balance:${userId}:${year}`,
  LEADERBOARD: (period: string, date: string) => `leaderboard:${period}:${date}`,
  USER_SCORE: (userId: number, period: string, date: string) => `score:${userId}:${period}:${date}`,
};
```

#### Cache Implementation in Services
```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    // ... other dependencies
  ) {}

  async getUserShiftForDate(userId: number, date: Date): Promise<Shift> {
    const cacheKey = CacheKeys.USER_SHIFT(userId, date.toISOString().split('T')[0]);

    // Try cache first
    const cached = await this.cacheManager.get<Shift>(cacheKey);
    if (cached) {
      this.performanceService.recordCacheHit('user_shift');
      return cached;
    }

    // Cache miss - query database
    this.performanceService.recordCacheMiss('user_shift');
    const shift = await this.userShiftRepo
      .createQueryBuilder('us')
      .leftJoinAndSelect('us.shift', 's')
      .where('us.user_id = :userId', { userId })
      .andWhere('us.effective_from <= :date', { date })
      .andWhere('(us.effective_to IS NULL OR us.effective_to >= :date)', { date })
      .andWhere('us.active = true')
      .getOne();

    // Store in cache (TTL: 1 hour)
    if (shift) {
      await this.cacheManager.set(cacheKey, shift.shift, 3600);
    }

    return shift?.shift;
  }

  async getTodayAttendance(userId: number, date: Date): Promise<Attendance> {
    const cacheKey = CacheKeys.ATTENDANCE_TODAY(userId);

    const cached = await this.cacheManager.get<Attendance>(cacheKey);
    if (cached) return cached;

    const attendance = await this.attendanceRepo.findOne({
      where: { userId, attendanceDate: date },
      relations: ['shift']
    });

    // Cache for 5 minutes (frequent updates expected)
    if (attendance) {
      await this.cacheManager.set(cacheKey, attendance, 300);
    }

    return attendance;
  }

  async invalidateAttendanceCache(userId: number) {
    const cacheKey = CacheKeys.ATTENDANCE_TODAY(userId);
    await this.cacheManager.del(cacheKey);
  }
}
```

### 2.2 Query Optimization

#### Use Query Builder for Complex Queries
```typescript
@Injectable()
export class HrReportService {

  // BAD: Multiple database calls
  async getUserAttendanceSummary_Slow(userId: number, month: Date) {
    const attendances = await this.attendanceRepo.find({
      where: { userId, attendanceDate: Between(startDate, endDate) }
    });

    const leaves = await this.leaveRepo.find({
      where: { userId, startDate: Between(startDate, endDate) }
    });

    const shift = await this.userShiftRepo.findOne({
      where: { userId }
    });

    // Process data...
  }

  // GOOD: Single optimized query
  async getUserAttendanceSummary_Fast(userId: number, month: Date) {
    const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
    const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const result = await this.attendanceRepo
      .createQueryBuilder('a')
      .select([
        'COUNT(*) as total_days',
        'COUNT(CASE WHEN a.status = \'PRESENT\' THEN 1 END) as present_days',
        'COUNT(CASE WHEN a.is_late = true THEN 1 END) as late_days',
        'SUM(a.total_hours) as total_hours',
        'AVG(a.late_minutes) as avg_late_minutes'
      ])
      .where('a.user_id = :userId', { userId })
      .andWhere('a.attendance_date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    return result;
  }
}
```

#### Batch Operations
```typescript
// BAD: N+1 queries
async calculateAllUserScores_Slow(month: Date) {
  const users = await this.userRepo.find();

  for (const user of users) {
    await this.calculateUserScore(user.id, month); // N database calls
  }
}

// GOOD: Batch processing
async calculateAllUserScores_Fast(month: Date) {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  // Single query to get all attendance data
  const attendanceData = await this.attendanceRepo
    .createQueryBuilder('a')
    .select([
      'a.user_id',
      'COUNT(*) as total_days',
      'COUNT(CASE WHEN a.status = \'PRESENT\' THEN 1 END) as present_days',
      'COUNT(CASE WHEN a.is_late = true THEN 1 END) as late_arrivals',
      'SUM(a.total_hours) as total_hours'
    ])
    .where('a.attendance_date BETWEEN :startDate AND :endDate', { startDate, endDate })
    .groupBy('a.user_id')
    .getRawMany();

  // Batch insert scores
  const scores = attendanceData.map(data => this.buildUserScore(data, month));
  await this.userScoreRepo.save(scores); // Single insert
}
```

### 2.3 Database Connection Pooling

```typescript
// api-v2/src/database/typeorm-config.service.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export class TypeOrmConfigService {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: false, // Always false in production
      logging: process.env.LOG_SQL === 'true',

      // Connection pooling for performance
      extra: {
        max: 20,              // Maximum pool size
        min: 5,               // Minimum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,

        // Statement timeout (prevent long-running queries)
        statement_timeout: 30000, // 30 seconds

        // Connection retry
        maxReconnectAttempts: 3,
        reconnectionDelay: 1000,
      },

      // Query result caching (in-memory)
      cache: {
        type: 'redis',
        options: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
        },
        duration: 60000, // 1 minute
      },
    };
  }
}
```

---

## 3. Comprehensive Tracking & Analytics

### 3.1 Performance Monitoring Service

```typescript
// api-v2/src/modules/app/hr/monitoring/performance.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class PerformanceMonitoringService {
  constructor(
    @InjectRepository(SystemPerformanceLog)
    private perfLogRepo: Repository<SystemPerformanceLog>,
    @InjectRepository(ApiUsageLog)
    private apiLogRepo: Repository<ApiUsageLog>,
    @InjectRepository(QueryPerformanceLog)
    private queryLogRepo: Repository<QueryPerformanceLog>,
  ) {}

  // Track API performance
  async logApiCall(data: {
    userId: number;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    requestSize: number;
    responseSize: number;
    ip: string;
    userAgent: string;
    errorMessage?: string;
  }) {
    await this.apiLogRepo.save({
      ...data,
      timestamp: new Date()
    });
  }

  // Track database query performance
  async logQueryPerformance(data: {
    queryName: string;
    executionTimeMs: number;
    rowsReturned: number;
    serviceName: string;
  }) {
    await this.queryLogRepo.save({
      ...data,
      timestamp: new Date()
    });
  }

  // Record cache hit/miss
  async recordCacheHit(cacheName: string) {
    await this.perfLogRepo.save({
      metricName: 'cache_hit',
      metricValue: 1,
      metadata: { cacheName },
      recordedAt: new Date()
    });
  }

  async recordCacheMiss(cacheName: string) {
    await this.perfLogRepo.save({
      metricName: 'cache_miss',
      metricValue: 1,
      metadata: { cacheName },
      recordedAt: new Date()
    });
  }

  // Get performance metrics
  async getApiPerformanceMetrics(startDate: Date, endDate: Date) {
    return await this.apiLogRepo
      .createQueryBuilder('api')
      .select([
        'api.endpoint',
        'COUNT(*) as request_count',
        'AVG(api.response_time_ms) as avg_response_time',
        'MAX(api.response_time_ms) as max_response_time',
        'MIN(api.response_time_ms) as min_response_time',
        'COUNT(CASE WHEN api.status_code >= 400 THEN 1 END) as error_count'
      ])
      .where('api.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('api.endpoint')
      .orderBy('request_count', 'DESC')
      .getRawMany();
  }

  // Get slow queries
  async getSlowQueries(thresholdMs: number = 1000) {
    return await this.queryLogRepo.find({
      where: {
        executionTimeMs: MoreThan(thresholdMs)
      },
      order: {
        executionTimeMs: 'DESC'
      },
      take: 50
    });
  }

  // Get cache hit rate
  async getCacheHitRate(startDate: Date, endDate: Date) {
    const stats = await this.perfLogRepo
      .createQueryBuilder('perf')
      .select([
        'metadata->>\'cacheName\' as cache_name',
        'SUM(CASE WHEN metric_name = \'cache_hit\' THEN 1 ELSE 0 END) as hits',
        'SUM(CASE WHEN metric_name = \'cache_miss\' THEN 1 ELSE 0 END) as misses'
      ])
      .where('perf.recorded_at BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('perf.metric_name IN (:...metrics)', { metrics: ['cache_hit', 'cache_miss'] })
      .groupBy('cache_name')
      .getRawMany();

    return stats.map(s => ({
      cacheName: s.cache_name,
      hits: parseInt(s.hits),
      misses: parseInt(s.misses),
      hitRate: (parseInt(s.hits) / (parseInt(s.hits) + parseInt(s.misses)) * 100).toFixed(2)
    }));
  }
}
```

### 3.2 Performance Tracking Interceptor

```typescript
// api-v2/src/core/interceptors/performance.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PerformanceMonitoringService } from '../modules/app/hr/monitoring/performance.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private performanceService: PerformanceMonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async (data) => {
          const responseTime = Date.now() - startTime;

          await this.performanceService.logApiCall({
            userId: request.user?.id,
            endpoint: request.url,
            method: request.method,
            statusCode: response.statusCode,
            responseTimeMs: responseTime,
            requestSize: JSON.stringify(request.body || {}).length,
            responseSize: JSON.stringify(data || {}).length,
            ip: request.ip,
            userAgent: request.headers['user-agent']
          });

          // Warn if slow
          if (responseTime > 1000) {
            console.warn(`[PERFORMANCE] Slow request: ${request.method} ${request.url} took ${responseTime}ms`);
          }
        },
        error: async (error) => {
          const responseTime = Date.now() - startTime;

          await this.performanceService.logApiCall({
            userId: request.user?.id,
            endpoint: request.url,
            method: request.method,
            statusCode: error.status || 500,
            responseTimeMs: responseTime,
            requestSize: JSON.stringify(request.body || {}).length,
            responseSize: 0,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            errorMessage: error.message
          });
        }
      })
    );
  }
}

// Apply globally in main.ts
app.useGlobalInterceptors(new PerformanceInterceptor(performanceService));
```

### 3.3 Business Analytics Tracking

```typescript
// api-v2/src/modules/app/hr/analytics/analytics.service.ts
@Injectable()
export class HrAnalyticsService {

  // Track attendance patterns
  async getAttendanceTrends(startDate: Date, endDate: Date) {
    return await this.attendanceRepo
      .createQueryBuilder('a')
      .select([
        'DATE(a.attendance_date) as date',
        'COUNT(*) as total_checkins',
        'COUNT(CASE WHEN a.is_late = true THEN 1 END) as late_count',
        'AVG(a.total_hours) as avg_hours',
        'COUNT(CASE WHEN a.status = \'PRESENT\' THEN 1 END) as present_count',
        'COUNT(CASE WHEN a.status = \'ABSENT\' THEN 1 END) as absent_count'
      ])
      .where('a.attendance_date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('DATE(a.attendance_date)')
      .orderBy('date', 'ASC')
      .getRawMany();
  }

  // Peak attendance hours
  async getPeakAttendanceHours() {
    return await this.attendanceRepo
      .createQueryBuilder('a')
      .select([
        'EXTRACT(HOUR FROM a.clock_in_time) as hour',
        'COUNT(*) as checkin_count'
      ])
      .where('a.clock_in_time IS NOT NULL')
      .groupBy('hour')
      .orderBy('checkin_count', 'DESC')
      .getRawMany();
  }

  // Leave patterns analysis
  async getLeavePatterns(year: number) {
    return await this.leaveRepo
      .createQueryBuilder('lr')
      .leftJoin('lr.leaveType', 'lt')
      .select([
        'lt.name as leave_type',
        'COUNT(*) as request_count',
        'SUM(lr.total_days) as total_days',
        'AVG(lr.total_days) as avg_days_per_request',
        'EXTRACT(MONTH FROM lr.start_date) as month'
      ])
      .where('EXTRACT(YEAR FROM lr.start_date) = :year', { year })
      .andWhere('lr.status = :status', { status: 'APPROVED' })
      .groupBy('lt.name, month')
      .orderBy('month', 'ASC')
      .getRawMany();
  }

  // User performance distribution
  async getScoreDistribution(period: string, date: Date) {
    return await this.userScoreRepo
      .createQueryBuilder('us')
      .select([
        'us.grade',
        'COUNT(*) as user_count',
        'AVG(us.total_score) as avg_score',
        'MIN(us.total_score) as min_score',
        'MAX(us.total_score) as max_score'
      ])
      .where('us.score_period = :period', { period })
      .andWhere('us.score_date = :date', { date })
      .groupBy('us.grade')
      .orderBy('us.grade', 'ASC')
      .getRawMany();
  }

  // Department-wise analytics
  async getDepartmentAnalytics(storeId: number, month: Date) {
    const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
    const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    return await this.attendanceRepo
      .createQueryBuilder('a')
      .leftJoin('a.user', 'u')
      .leftJoin('u.shift', 'us')
      .leftJoin('us.shift', 's')
      .select([
        's.store_id',
        'COUNT(DISTINCT a.user_id) as employee_count',
        'COUNT(*) as total_attendance',
        'AVG(a.total_hours) as avg_hours',
        'COUNT(CASE WHEN a.is_late THEN 1 END) as total_late'
      ])
      .where('a.attendance_date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('s.store_id = :storeId', { storeId })
      .groupBy('s.store_id')
      .getRawOne();
  }

  // Real-time dashboard data
  async getRealTimeDashboard() {
    const today = new Date();

    const [
      todayAttendance,
      pendingLeaves,
      lateToday,
      currentlyWorking
    ] = await Promise.all([
      this.attendanceRepo.count({
        where: { attendanceDate: today, status: 'PRESENT' }
      }),
      this.leaveRepo.count({
        where: { status: 'PENDING' }
      }),
      this.attendanceRepo.count({
        where: { attendanceDate: today, isLate: true }
      }),
      this.attendanceRepo.count({
        where: {
          attendanceDate: today,
          clockInTime: Not(IsNull()),
          clockOutTime: IsNull()
        }
      })
    ]);

    return {
      todayAttendance,
      pendingLeaves,
      lateToday,
      currentlyWorking,
      timestamp: new Date()
    };
  }
}
```

### 3.4 Audit Trail Service

```typescript
// api-v2/src/modules/app/hr/audit/audit.service.ts
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    userId: number;
    action: string;
    resourceType: string;
    resourceId: number;
    changes?: any;
    metadata?: any;
  }) {
    await this.auditLogRepo.save({
      ...data,
      timestamp: new Date(),
      ip: this.getRequestIp(),
      userAgent: this.getRequestUserAgent()
    });
  }

  // Track specific actions
  async logAttendanceChange(userId: number, attendanceId: number, oldData: any, newData: any) {
    await this.log({
      userId,
      action: 'ATTENDANCE_UPDATE',
      resourceType: 'attendance',
      resourceId: attendanceId,
      changes: {
        before: oldData,
        after: newData
      }
    });
  }

  async logLeaveApproval(approverId: number, leaveId: number, decision: string) {
    await this.log({
      userId: approverId,
      action: `LEAVE_${decision}`,
      resourceType: 'leave_request',
      resourceId: leaveId,
      metadata: { decision }
    });
  }

  // Get audit trail
  async getAuditTrail(resourceType: string, resourceId: number) {
    return await this.auditLogRepo.find({
      where: { resourceType, resourceId },
      order: { timestamp: 'DESC' },
      take: 100
    });
  }
}
```

---

## 4. Photo Storage Optimization

### 4.1 Efficient Photo Handling

```typescript
// api-v2/src/modules/app/hr/attendance/photo-storage.service.ts
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class PhotoStorageService {
  private readonly uploadDir = process.env.PHOTO_UPLOAD_DIR || 'uploads/attendance';

  async savePhoto(userId: number, base64Photo: string, type: 'clock-in' | 'clock-out'): Promise<string> {
    const startTime = Date.now();

    // Decode base64
    const buffer = Buffer.from(base64Photo.split(',')[1], 'base64');

    // Optimize image
    const optimized = await sharp(buffer)
      .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .toBuffer();

    // Generate filename with date-based folder structure
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const folderPath = path.join(this.uploadDir, String(year), month, day);
    await fs.mkdir(folderPath, { recursive: true });

    const filename = `${userId}_${type}_${Date.now()}.jpg`;
    const filepath = path.join(folderPath, filename);

    // Save file
    await fs.writeFile(filepath, optimized);

    // Log performance
    const duration = Date.now() - startTime;
    console.log(`[PHOTO] Saved ${filename} in ${duration}ms (${(optimized.length / 1024).toFixed(2)}KB)`);

    return filepath;
  }

  async deletePhoto(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath);
    } catch (error) {
      console.error(`Failed to delete photo: ${filepath}`, error);
    }
  }

  // Cleanup old photos (run as cron job)
  async cleanupOldPhotos(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;

    // Find photos older than cutoff
    const oldPhotos = await this.findPhotosOlderThan(cutoffDate);

    for (const photo of oldPhotos) {
      await this.deletePhoto(photo.path);
      deletedCount++;
    }

    console.log(`[CLEANUP] Deleted ${deletedCount} photos older than ${daysToKeep} days`);
    return deletedCount;
  }
}
```

---

## 5. Performance Dashboard API

```typescript
// api-v2/src/modules/app/hr/dashboard/dashboard.controller.ts
@ApiTags('HR Dashboard')
@Controller('hr/dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class HrDashboardController {
  constructor(
    private analyticsService: HrAnalyticsService,
    private performanceService: PerformanceMonitoringService,
  ) {}

  @Get('real-time')
  async getRealTimeMetrics() {
    return this.analyticsService.getRealTimeDashboard();
  }

  @Get('performance-metrics')
  async getPerformanceMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.performanceService.getApiPerformanceMetrics(
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('cache-stats')
  async getCacheStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.performanceService.getCacheHitRate(
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('slow-queries')
  async getSlowQueries(@Query('threshold') threshold: number = 1000) {
    return this.performanceService.getSlowQueries(threshold);
  }

  @Get('attendance-trends')
  async getAttendanceTrends(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.analyticsService.getAttendanceTrends(
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('score-distribution')
  async getScoreDistribution(
    @Query('period') period: string,
    @Query('date') date: string
  ) {
    return this.analyticsService.getScoreDistribution(period, new Date(date));
  }
}
```

---

## 6. Implementation Checklist

### Phase 1A: Performance-Optimized Foundation (Week 1-3)

- [ ] **Database Setup**
  - [ ] Create partitioned attendance table
  - [ ] Add all performance indexes
  - [ ] Set up connection pooling
  - [ ] Create performance tracking tables

- [ ] **Caching Layer**
  - [ ] Install Redis
  - [ ] Configure cache module
  - [ ] Implement cache service
  - [ ] Add cache invalidation

- [ ] **Monitoring Infrastructure**
  - [ ] Performance monitoring service
  - [ ] API usage logging
  - [ ] Query performance tracking
  - [ ] Audit trail service

- [ ] **Core Services**
  - [ ] Shift service with caching
  - [ ] Attendance service (optimized queries)
  - [ ] Leave service (batch operations)

### Phase 1B: Analytics & Tracking (Week 4-5)

- [ ] **Analytics Service**
  - [ ] Attendance trends
  - [ ] Leave patterns
  - [ ] Performance distribution
  - [ ] Real-time dashboard

- [ ] **Performance Dashboard**
  - [ ] API performance metrics
  - [ ] Cache hit rates
  - [ ] Slow query detection
  - [ ] System health monitoring

### Phase 2: Optimization & Tuning (Week 6-7)

- [ ] **Query Optimization**
  - [ ] Analyze slow queries
  - [ ] Add missing indexes
  - [ ] Optimize batch operations
  - [ ] Implement materialized views

- [ ] **Load Testing**
  - [ ] 100 concurrent clock-ins
  - [ ] 1000 attendance records query
  - [ ] Leaderboard generation
  - [ ] Score calculation performance

---

## 7. Performance Targets

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Clock-in API response | < 200ms | < 500ms | > 500ms |
| Attendance query (month) | < 100ms | < 300ms | > 300ms |
| Score calculation | < 2s | < 5s | > 5s |
| Leaderboard generation | < 500ms | < 1s | > 1s |
| Cache hit rate | > 80% | > 60% | < 60% |
| Database connection usage | < 50% | < 70% | > 70% |
| Photo upload | < 1s | < 2s | > 2s |
| API error rate | < 0.1% | < 1% | > 1% |

---

**Prepared By:** Claude Code
**Date:** 2025-11-30
**Focus:** Performance & Tracking
**Status:** Ready for Implementation
