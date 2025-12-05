/**
 * OCR Processing Status Enum
 * Tracks the OCR processing status of uploaded documents
 */
export enum OcrStatus {
  /** OCR processing not started */
  PENDING = 'PENDING',

  /** OCR processing in progress */
  PROCESSING = 'PROCESSING',

  /** OCR processing completed successfully */
  COMPLETED = 'COMPLETED',

  /** OCR processing failed */
  FAILED = 'FAILED',
}

/**
 * Auto-populate Status Enum
 * Tracks the status of auto-populating invoice from OCR data
 */
export enum AutoPopulateStatus {
  /** Auto-populate not attempted */
  NOT_ATTEMPTED = 'NOT_ATTEMPTED',

  /** Partial fields populated */
  PARTIAL = 'PARTIAL',

  /** All fields populated successfully */
  COMPLETE = 'COMPLETE',

  /** Auto-populate failed */
  FAILED = 'FAILED',
}

/**
 * Document Type for Invoice Documents
 */
export enum InvoiceDocumentType {
  /** Scanned invoice document */
  INVOICE_SCAN = 'INVOICE_SCAN',

  /** Scanned delivery challan */
  DELIVERY_CHALLAN_SCAN = 'DELIVERY_CHALLAN_SCAN',

  /** Payment proof document */
  PAYMENT_PROOF = 'PAYMENT_PROOF',

  /** Vendor's GSTR-1 document */
  GSTR1 = 'GSTR1',

  /** Our GSTR-2A screenshot */
  GSTR2A = 'GSTR2A',

  /** Other supporting documents */
  OTHER = 'OTHER',
}
