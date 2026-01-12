/**
 * Lifecycle Status Enum
 * Tracks the overall lifecycle of an invoice
 */
export enum LifecycleStatus {
  /** Invoice is open and active */
  OPEN = 'OPEN',

  /** Invoice is closed (payment done, tax reconciled) */
  CLOSED = 'CLOSED',
}

/**
 * Human-readable labels for lifecycle statuses
 */
export const LifecycleStatusLabels: Record<LifecycleStatus, string> = {
  [LifecycleStatus.OPEN]: 'Open',
  [LifecycleStatus.CLOSED]: 'Closed',
};

/**
 * Invoice Processing Status Enum
 * Tracks the invoice processing workflow
 */
export enum InvoiceStatus {
  /** Invoice created, items being added */
  NEW = 'NEW',

  /** All items verified */
  VERIFIED = 'VERIFIED',

  /** Invoice processing complete, stock updated */
  COMPLETE = 'COMPLETE',
}

/**
 * Invoice Item Status Enum
 * Tracks individual item verification status
 */
export enum InvoiceItemStatus {
  /** Item not yet verified */
  NEW = 'NEW',

  /** Item physically verified */
  VERIFIED = 'VERIFIED',
}
