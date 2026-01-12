/**
 * Payment Status Enum
 * Tracks the payment status of an invoice
 */
export enum PaymentStatus {
  /** No payment made yet */
  UNPAID = 'UNPAID',

  /** Partial payment made */
  PARTIAL = 'PARTIAL',

  /** Full payment completed */
  PAID = 'PAID',
}

/**
 * Human-readable labels for payment statuses
 */
export const PaymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.UNPAID]: 'Unpaid',
  [PaymentStatus.PARTIAL]: 'Partially Paid',
  [PaymentStatus.PAID]: 'Fully Paid',
};

/**
 * Payment Type Enum
 * Defines the type of payment being made
 */
export enum PaymentType {
  /** Advance payment before delivery */
  ADVANCE = 'ADVANCE',

  /** Partial payment */
  PARTIAL = 'PARTIAL',

  /** Full payment */
  FULL = 'FULL',
}

/**
 * Payment Against Enum
 * Defines what the payment is being made against
 */
export enum PaymentAgainst {
  /** Payment against invoice */
  INVOICE = 'INVOICE',

  /** Payment against delivery challan */
  DELIVERY_CHALLAN = 'DELIVERY_CHALLAN',
}

/**
 * Individual Payment Status
 * Status of a single payment transaction
 */
export enum SinglePaymentStatus {
  /** Payment is pending */
  PENDING = 'PENDING',

  /** Payment completed successfully */
  COMPLETED = 'COMPLETED',

  /** Payment failed */
  FAILED = 'FAILED',
}
