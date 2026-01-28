/**
 * Enums for HR Policy and Benefits Management
 * Created: 2026-01-13
 */

// =====================================================
// HR POLICY ENUMS
// =====================================================

export enum PolicyCategory {
  EMPLOYMENT = 'EMPLOYMENT',
  COMPENSATION = 'COMPENSATION',
  ATTENDANCE = 'ATTENDANCE',
  CONDUCT = 'CONDUCT',
  BENEFITS = 'BENEFITS',
  LEAVE = 'LEAVE',
  PERFORMANCE = 'PERFORMANCE',
  SAFETY = 'SAFETY',
  OTHER = 'OTHER',
}

export enum PolicyAcknowledgmentMethod {
  DIGITAL_SIGNATURE = 'DIGITAL_SIGNATURE',
  EMAIL = 'EMAIL',
  PHYSICAL = 'PHYSICAL',
}

// =====================================================
// BENEFIT ENUMS
// =====================================================

export enum BenefitCategory {
  INSURANCE = 'INSURANCE',
  STATUTORY = 'STATUTORY',
  ALLOWANCE = 'ALLOWANCE',
  WELLNESS = 'WELLNESS',
  EDUCATION = 'EDUCATION',
  LEAVE = 'LEAVE',
  RETIREMENT = 'RETIREMENT',
  OTHER = 'OTHER',
}

export enum CalculationBasis {
  FIXED = 'FIXED',
  CTC_PERCENTAGE = 'CTC_PERCENTAGE',
  BASIC_PERCENTAGE = 'BASIC_PERCENTAGE',
  GROSS_PERCENTAGE = 'GROSS_PERCENTAGE',
  FORMULA = 'FORMULA',
}

// =====================================================
// ELIGIBILITY ENUMS
// =====================================================

export enum EntityType {
  HR_POLICY = 'HR_POLICY',
  BENEFIT_POLICY = 'BENEFIT_POLICY',
}

// =====================================================
// ENROLLMENT ENUMS
// =====================================================

export enum EnrollmentType {
  AUTO = 'AUTO',
  VOLUNTARY = 'VOLUNTARY',
  MANDATORY = 'MANDATORY',
}

export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

// =====================================================
// CLAIM ENUMS
// =====================================================

export enum ClaimType {
  REIMBURSEMENT = 'REIMBURSEMENT',
  DIRECT_SETTLEMENT = 'DIRECT_SETTLEMENT',
  CASHLESS = 'CASHLESS',
}

export enum ClaimStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

export enum PaymentMode {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  CHEQUE = 'CHEQUE',
  PAYROLL = 'PAYROLL',
}
