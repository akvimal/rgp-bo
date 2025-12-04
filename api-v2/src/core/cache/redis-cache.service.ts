import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key: string;
}

@Injectable()
export class RedisCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.cacheManager.get<T>(key);
      return result !== undefined ? result : null;
    } catch (error) {
      console.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl || 300);
    } catch (error) {
      console.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      console.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      // Note: Pattern deletion not directly supported in newer cache-manager
      // This is a placeholder - implement using Redis client directly if needed
      console.warn(`Pattern deletion not implemented for pattern: ${pattern}`);
    } catch (error) {
      console.error(`Cache DEL PATTERN error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Reset entire cache
   */
  async reset(): Promise<void> {
    try {
      // Note: reset() not available in newer cache-manager
      // Would need to implement using Redis client directly
      console.warn('Cache reset not implemented');
    } catch (error) {
      console.error('Cache RESET error:', error);
    }
  }

  /**
   * Get or set cached value using a factory function
   * @param key Cache key
   * @param factory Function to generate value if not cached
   * @param ttl Time to live in seconds (default: 300)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = 300,
  ): Promise<T> {
    try {
      // Try to get from cache
      const cached = await this.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }

      // Not in cache, generate value
      const value = await factory();

      // Store in cache
      await this.set(key, value, ttl);

      return value;
    } catch (error) {
      console.error(`Cache GET_OR_SET error for key ${key}:`, error);
      // On error, just return the factory result without caching
      return await factory();
    }
  }

  /**
   * Generate cache key for HR module queries
   */
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `hr:${prefix}:${parts.join(':')}`;
  }

  /**
   * Cache keys constants for HR module
   */
  readonly CACHE_KEYS = {
    // Attendance
    ATTENDANCE_BY_USER_DATE: (userId: number, date: string) =>
      this.generateKey('attendance', 'user', userId, date),
    ATTENDANCE_MONTHLY: (userId: number, year: number, month: number) =>
      this.generateKey('attendance', 'monthly', userId, year, month),

    // Leave
    LEAVE_BALANCE: (userId: number, year: number) =>
      this.generateKey('leave', 'balance', userId, year),
    LEAVE_TYPES: () => this.generateKey('leave', 'types'),
    PENDING_LEAVES: (userId: number) =>
      this.generateKey('leave', 'pending', userId),

    // Shift
    USER_CURRENT_SHIFT: (userId: number) =>
      this.generateKey('shift', 'current', userId),
    SHIFT_BY_ID: (shiftId: number) =>
      this.generateKey('shift', 'id', shiftId),
    STORE_SHIFTS: (storeId: number) =>
      this.generateKey('shift', 'store', storeId),

    // Scoring
    USER_SCORE_MONTHLY: (userId: number, year: number, month: number) =>
      this.generateKey('score', 'monthly', userId, year, month),
    LEADERBOARD_CURRENT_MONTH: () =>
      this.generateKey('score', 'leaderboard', 'current'),

    // Reports
    ATTENDANCE_REPORT: (storeId: number, year: number, month: number) =>
      this.generateKey('report', 'attendance', storeId, year, month),
  };

  /**
   * TTL constants (in seconds)
   */
  readonly TTL = {
    VERY_SHORT: 60, // 1 minute - for frequently changing data
    SHORT: 300, // 5 minutes - for moderately changing data
    MEDIUM: 1800, // 30 minutes - for relatively stable data
    LONG: 3600, // 1 hour - for stable data
    VERY_LONG: 86400, // 24 hours - for rarely changing data
  };
}
