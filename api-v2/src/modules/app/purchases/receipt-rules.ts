/** An invoice or challan number as stored: trimmed, and null when blank (never an empty string). */
export function cleanRef(v: any): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

/**
 * Goods received on a delivery challan before the vendor's invoice: the receipt has a challan number but no invoice number.
 * It is stock and a cost already, but it is not payable and not in GST until the invoice number is entered.
 */
export function awaitingInvoice(row: { invoiceno?: any; invoice_no?: any }): boolean {
  return cleanRef(row.invoiceno ?? row.invoice_no) === null;
}

/** The month a purchase belongs to for GST (YYYY-MM): only once the invoice number exists, else none. */
export function gstPeriodFor(invoiceno: any, invoicedate: any): string | null {
  if (cleanRef(invoiceno) === null || !invoicedate) return null;
  return String(invoicedate).slice(0, 7);
}
