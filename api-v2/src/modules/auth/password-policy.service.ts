import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppUser } from 'src/entities/appuser.entity';
import { PasswordResetToken } from 'src/entities/password-reset-token.entity';
import * as crypto from 'crypto';
import { AuditService } from 'src/core/audit/audit.service';

export interface PasswordPolicyConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialChars: string;
  maxPasswordAge: number; // days
  passwordHistory: number; // number of previous passwords to check
  maxLoginAttempts: number;
  lockoutDuration: number; // minutes
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

@Injectable()
export class PasswordPolicyService {
  @InjectRepository(AppUser)
  private readonly userRepository: Repository<AppUser>;

  @InjectRepository(PasswordResetToken)
  private readonly resetTokenRepository: Repository<PasswordResetToken>;

  constructor(private readonly auditService: AuditService) {}

  // Default password policy configuration
  private readonly config: PasswordPolicyConfig = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    maxPasswordAge: 90, // days
    passwordHistory: 5, // can't reuse last 5 passwords
    maxLoginAttempts: 5,
    lockoutDuration: 30, // minutes
  };

  /**
   * Validate password against policy requirements
   */
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < this.config.minLength) {
      errors.push(`Password must be at least ${this.config.minLength} characters long`);
    }

    // Check uppercase requirement
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check lowercase requirement
    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check number requirement
    if (this.config.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check special character requirement
    if (this.config.requireSpecialChars) {
      const specialCharsRegex = new RegExp(`[${this.escapeRegex(this.config.specialChars)}]`);
      if (!specialCharsRegex.test(password)) {
        errors.push(`Password must contain at least one special character (${this.config.specialChars})`);
      }
    }

    // Calculate password strength
    const strength = this.calculatePasswordStrength(password);

    return {
      isValid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Check if password has expired
   */
  async checkPasswordExpiry(user: AppUser): Promise<boolean> {
    if (!user.passwordChangedOn) {
      return false; // No expiry if passwordChangedOn not set
    }

    const passwordAgeMs = Date.now() - user.passwordChangedOn.getTime();
    const passwordAgeDays = passwordAgeMs / (1000 * 60 * 60 * 24);

    return passwordAgeDays >= this.config.maxPasswordAge;
  }

  /**
   * Get days until password expires
   */
  async getDaysUntilExpiry(user: AppUser): Promise<number> {
    if (!user.passwordChangedOn) {
      return this.config.maxPasswordAge; // Full time if not set
    }

    const passwordAgeMs = Date.now() - user.passwordChangedOn.getTime();
    const passwordAgeDays = passwordAgeMs / (1000 * 60 * 60 * 24);
    const daysRemaining = this.config.maxPasswordAge - passwordAgeDays;

    return Math.max(0, Math.floor(daysRemaining));
  }

  /**
   * Check if password was used before (password history)
   */
  async checkPasswordHistory(user: AppUser, newPassword: string): Promise<boolean> {
    if (!user.passwordHistory || user.passwordHistory.length === 0) {
      return false; // No history, password is new
    }

    // Check if new password matches any in history
    for (const oldPasswordHash of user.passwordHistory) {
      if (bcrypt.compareSync(newPassword, oldPasswordHash)) {
        return true; // Password was used before
      }
    }

    return false; // Password is new
  }

  /**
   * Update password history
   */
  async updatePasswordHistory(user: AppUser, newPasswordHash: string): Promise<string[]> {
    const history = user.passwordHistory || [];

    // Add current password to history
    const updatedHistory = [newPasswordHash, ...history];

    // Keep only last N passwords
    return updatedHistory.slice(0, this.config.passwordHistory);
  }

  /**
   * Hash password with bcrypt
   */
  hashPassword(password: string): string {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(user: AppUser): Promise<boolean> {
    if (!user.lockedUntil) {
      return false; // Not locked
    }

    const now = new Date();
    if (user.lockedUntil > now) {
      return true; // Still locked
    }

    // Lock expired, auto-unlock
    await this.unlockAccount(user.id);
    return false;
  }

  /**
   * Increment failed login attempts and lock account if threshold reached
   */
  async incrementFailedAttempts(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return;
    }

    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const updates: any = {
      failedLoginAttempts: failedAttempts,
      lastLoginAttempt: new Date(),
    };

    // Lock account if max attempts reached
    if (failedAttempts >= this.config.maxLoginAttempts) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + this.config.lockoutDuration);
      updates.lockedUntil = lockUntil;
    }

    await this.userRepository.update(userId, updates);
  }

  /**
   * Reset failed login attempts on successful login
   */
  async resetFailedAttempts(userId: number): Promise<void> {
    await this.userRepository.update(userId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAttempt: new Date(),
    });
  }

  /**
   * Unlock account (admin action)
   */
  async unlockAccount(userId: number, adminId?: number, ipAddress?: string): Promise<void> {
    await this.userRepository.update(userId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    // Log audit if this was an admin action
    if (adminId) {
      await this.auditService.logAccountLockUnlock({
        userId: adminId,
        targetUserId: userId,
        action: 'ACCOUNT_UNLOCK',
        reason: 'Manual unlock by administrator',
        ipAddress: ipAddress,
      });
    }
  }

  /**
   * Create password reset token
   */
  async createResetToken(userId: number, ipAddress?: string): Promise<PasswordResetToken> {
    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const resetToken = this.resetTokenRepository.create({
      userId,
      token,
      expiresAt,
      ipAddress,
    });

    return await this.resetTokenRepository.save(resetToken);
  }

  /**
   * Verify and use reset token
   */
  async verifyResetToken(token: string): Promise<PasswordResetToken | null> {
    const resetToken = await this.resetTokenRepository.findOne({
      where: { token, used: false },
      relations: ['user'],
    });

    if (!resetToken) {
      return null; // Token not found or already used
    }

    // Check if expired
    if (resetToken.expiresAt < new Date()) {
      return null; // Token expired
    }

    return resetToken;
  }

  /**
   * Mark reset token as used
   */
  async markTokenAsUsed(tokenId: number): Promise<void> {
    await this.resetTokenRepository.update(tokenId, {
      used: true,
      usedAt: new Date(),
    });
  }

  /**
   * Get users with expired passwords
   */
  async getUsersWithExpiredPasswords(): Promise<AppUser[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - this.config.maxPasswordAge);

    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.password_changed_on <= :expiryDate', { expiryDate })
      .andWhere('user.active = true')
      .getMany();
  }

  /**
   * Get locked accounts
   */
  async getLockedAccounts(): Promise<AppUser[]> {
    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.locked_until IS NOT NULL')
      .andWhere('user.locked_until > :now', { now: new Date() })
      .getMany();
  }

  /**
   * Get inactive users (not logged in for N days)
   */
  async getInactiveUsers(days: number = 90): Promise<AppUser[]> {
    const inactiveDate = new Date();
    inactiveDate.setDate(inactiveDate.getDate() - days);

    return await this.userRepository
      .createQueryBuilder('user')
      .where('(user.last_login IS NULL OR user.last_login <= :inactiveDate)', { inactiveDate })
      .andWhere('user.active = true')
      .getMany();
  }

  /**
   * Calculate password strength (0-100)
   */
  private calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    let score = 0;

    // Length score
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;

    // Complexity score
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[^a-zA-Z0-9]/.test(password)) score += 15;

    // Variety score (multiple character types)
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    const variety = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    score += variety * 5;

    // Return strength rating
    if (score < 40) return 'weak';
    if (score < 70) return 'medium';
    return 'strong';
  }

  /**
   * Escape special characters for regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get password policy configuration (for frontend)
   */
  getPasswordPolicy(): PasswordPolicyConfig {
    return { ...this.config };
  }
}
