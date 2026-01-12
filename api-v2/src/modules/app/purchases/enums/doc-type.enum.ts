/**
 * Document Type Enum
 * Defines whether a document is an Invoice or Delivery Challan
 */
export enum DocType {
  INVOICE = 'INVOICE',
  DELIVERY_CHALLAN = 'DELIVERY_CHALLAN',
}

/**
 * Human-readable labels for doc types
 */
export const DocTypeLabels: Record<DocType, string> = {
  [DocType.INVOICE]: 'Invoice',
  [DocType.DELIVERY_CHALLAN]: 'Delivery Challan',
};
