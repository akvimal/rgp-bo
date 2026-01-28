import { Component, OnInit } from '@angular/core';
import { SecurityDashboardService } from '../security-dashboard.service';

export interface UserWithExpiredPassword {
  id: number;
  email: string;
  fullName: string;
  passwordChangedOn: Date;
  passwordAgeDays: number;
}

export interface LockedAccount {
  id: number;
  email: string;
  fullName: string;
  lockedUntil: Date;
  failedLoginAttempts: number;
}

export interface InactiveUser {
  id: number;
  email: string;
  fullName: string;
  lastLogin: Date;
  daysSinceLogin: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialChars: string;
  maxPasswordAge: number;
  passwordHistory: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
}

@Component({
  selector: 'app-security-dashboard',
  templateUrl: './security-dashboard.component.html',
  styleUrls: ['./security-dashboard.component.scss']
})
export class SecurityDashboardComponent implements OnInit {

  loading: boolean = false;
  error: string = '';
  success: string = '';

  expiredPasswords: UserWithExpiredPassword[] = [];
  lockedAccounts: LockedAccount[] = [];
  inactiveUsers: InactiveUser[] = [];
  passwordPolicy: PasswordPolicy | null = null;

  inactivityThresholdDays: number = 90;

  constructor(private securityService: SecurityDashboardService) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.loading = true;
    this.error = '';

    // Load all dashboard data
    Promise.all([
      this.loadExpiredPasswords(),
      this.loadLockedAccounts(),
      this.loadInactiveUsers(),
      this.loadPasswordPolicy()
    ]).then(() => {
      this.loading = false;
    }).catch((err) => {
      this.loading = false;
      this.error = 'Failed to load dashboard data: ' + (err.message || 'Unknown error');
    });
  }

  private loadExpiredPasswords(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.securityService.getUsersWithExpiredPasswords().subscribe({
        next: (data) => {
          this.expiredPasswords = data;
          resolve();
        },
        error: (err) => {
          console.error('Failed to load expired passwords:', err);
          reject(err);
        }
      });
    });
  }

  private loadLockedAccounts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.securityService.getLockedAccounts().subscribe({
        next: (data) => {
          this.lockedAccounts = data;
          resolve();
        },
        error: (err) => {
          console.error('Failed to load locked accounts:', err);
          reject(err);
        }
      });
    });
  }

  private loadInactiveUsers(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.securityService.getInactiveUsers(this.inactivityThresholdDays).subscribe({
        next: (data) => {
          this.inactiveUsers = data;
          resolve();
        },
        error: (err) => {
          console.error('Failed to load inactive users:', err);
          reject(err);
        }
      });
    });
  }

  private loadPasswordPolicy(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.securityService.getPasswordPolicy().subscribe({
        next: (data) => {
          this.passwordPolicy = data;
          resolve();
        },
        error: (err) => {
          console.error('Failed to load password policy:', err);
          reject(err);
        }
      });
    });
  }

  unlockAccount(userId: number, email: string) {
    if (!confirm(`Are you sure you want to unlock the account for ${email}?`)) {
      return;
    }

    this.securityService.unlockAccount(userId).subscribe({
      next: () => {
        this.success = `Account for ${email} has been unlocked successfully`;
        // Refresh locked accounts list
        this.loadLockedAccounts();
        // Clear success message after 3 seconds
        setTimeout(() => this.success = '', 3000);
      },
      error: (err) => {
        this.error = 'Failed to unlock account: ' + (err.error?.message || err.message);
      }
    });
  }

  forcePasswordChange(userId: number, email: string) {
    if (!confirm(`Are you sure you want to force password change for ${email}?`)) {
      return;
    }

    this.securityService.forcePasswordChange(userId).subscribe({
      next: () => {
        this.success = `Password change has been forced for ${email}`;
        // Refresh expired passwords list
        this.loadExpiredPasswords();
        // Clear success message after 3 seconds
        setTimeout(() => this.success = '', 3000);
      },
      error: (err) => {
        this.error = 'Failed to force password change: ' + (err.error?.message || err.message);
      }
    });
  }

  refreshDashboard() {
    this.loadDashboardData();
  }

  getMinutesUntilUnlock(lockedUntil: Date): number {
    const now = new Date().getTime();
    const lockExpiry = new Date(lockedUntil).getTime();
    const diffMs = lockExpiry - now;
    return Math.max(0, Math.ceil(diffMs / (1000 * 60)));
  }
}
