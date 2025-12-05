/**
 * Tax Status Enum
 * Tracks the GST tax credit reconciliation status
 */
export enum TaxStatus {
  /** Tax reconciliation pending */
  PENDING = 'PENDING',

  /** Vendor has filed GSTR-1 */
  FILED = 'FILED',

  /** Tax credit reflected in our GSTR-2A */
  CREDITED = 'CREDITED',

  /** Tax credit claimed and reconciled */
  RECONCILED = 'RECONCILED',
}

/**
 * Human-readable labels for tax statuses
 */
export const TaxStatusLabels: Record<TaxStatus, string> = {
  [TaxStatus.PENDING]: 'Pending',
  [TaxStatus.FILED]: 'Filed by Vendor',
  [TaxStatus.CREDITED]: 'Credited in 2A',
  [TaxStatus.RECONCILED]: 'Reconciled',
};

/**
 * Tax Filing Status Enum
 * More detailed filing status for tax credit records
 */
export enum TaxFilingStatus {
  /** Waiting for vendor to file */
  PENDING = 'PENDING',

  /** Vendor has filed GSTR-1 */
  FILED_BY_VENDOR = 'FILED_BY_VENDOR',

  /** Reflected in our GSTR-2A */
  REFLECTED_IN_2A = 'REFLECTED_IN_2A',

  /** Claimed in our GSTR-3B */
  CLAIMED = 'CLAIMED',
}
