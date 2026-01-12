/**
 * Disposition Status Enum
 * Tracks the disposition status of purchased items
 */
export enum DispositionStatus {
  /** Item is active and available for sale */
  ACTIVE = 'ACTIVE',

  /** All items sold out */
  SOLD_OUT = 'SOLD_OUT',

  /** Item has expired */
  EXPIRED = 'EXPIRED',

  /** Item cleared (returned/disposed) */
  CLEARED = 'CLEARED',
}

/**
 * Human-readable labels for disposition statuses
 */
export const DispositionStatusLabels: Record<DispositionStatus, string> = {
  [DispositionStatus.ACTIVE]: 'Active',
  [DispositionStatus.SOLD_OUT]: 'Sold Out',
  [DispositionStatus.EXPIRED]: 'Expired',
  [DispositionStatus.CLEARED]: 'Cleared',
};
