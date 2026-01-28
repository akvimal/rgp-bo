import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

@Component({
  selector: 'app-password-strength-indicator',
  templateUrl: './password-strength-indicator.component.html',
  styleUrls: ['./password-strength-indicator.component.scss']
})
export class PasswordStrengthIndicatorComponent implements OnChanges {
  @Input() password: string = '';
  @Input() showRequirements: boolean = true;

  validation: PasswordValidationResult = {
    isValid: false,
    errors: [],
    strength: 'weak',
    checks: {
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecialChar: false
    }
  };

  // Password policy configuration (matches backend)
  private readonly minLength = 8;
  private readonly specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['password']) {
      this.validatePassword();
    }
  }

  private validatePassword(): void {
    if (!this.password) {
      this.validation = {
        isValid: false,
        errors: [],
        strength: 'weak',
        checks: {
          minLength: false,
          hasUppercase: false,
          hasLowercase: false,
          hasNumber: false,
          hasSpecialChar: false
        }
      };
      return;
    }

    const errors: string[] = [];
    const checks = {
      minLength: this.password.length >= this.minLength,
      hasUppercase: /[A-Z]/.test(this.password),
      hasLowercase: /[a-z]/.test(this.password),
      hasNumber: /[0-9]/.test(this.password),
      hasSpecialChar: new RegExp(`[${this.escapeRegex(this.specialChars)}]`).test(this.password)
    };

    // Build error messages
    if (!checks.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }
    if (!checks.hasUppercase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!checks.hasLowercase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!checks.hasNumber) {
      errors.push('Password must contain at least one number');
    }
    if (!checks.hasSpecialChar) {
      errors.push(`Password must contain at least one special character (${this.specialChars})`);
    }

    const isValid = errors.length === 0;
    const strength = this.calculateStrength();

    this.validation = {
      isValid,
      errors,
      strength,
      checks
    };
  }

  private calculateStrength(): 'weak' | 'medium' | 'strong' {
    let score = 0;

    // Length score
    if (this.password.length >= 8) score += 20;
    if (this.password.length >= 12) score += 10;
    if (this.password.length >= 16) score += 10;

    // Complexity score
    if (/[a-z]/.test(this.password)) score += 10;
    if (/[A-Z]/.test(this.password)) score += 10;
    if (/[0-9]/.test(this.password)) score += 10;
    if (/[^a-zA-Z0-9]/.test(this.password)) score += 15;

    // Variety score
    const hasLower = /[a-z]/.test(this.password);
    const hasUpper = /[A-Z]/.test(this.password);
    const hasNumber = /[0-9]/.test(this.password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(this.password);
    const variety = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    score += variety * 5;

    if (score < 40) return 'weak';
    if (score < 70) return 'medium';
    return 'strong';
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getStrengthClass(): string {
    switch (this.validation.strength) {
      case 'weak': return 'strength-weak';
      case 'medium': return 'strength-medium';
      case 'strong': return 'strength-strong';
      default: return '';
    }
  }

  getStrengthPercentage(): number {
    switch (this.validation.strength) {
      case 'weak': return 33;
      case 'medium': return 66;
      case 'strong': return 100;
      default: return 0;
    }
  }

  getStrengthText(): string {
    if (!this.password) return '';
    switch (this.validation.strength) {
      case 'weak': return 'Weak';
      case 'medium': return 'Medium';
      case 'strong': return 'Strong';
      default: return '';
    }
  }
}
