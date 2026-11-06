/**
 * When a completed bill may be changed between a counter sale and a delivery after it was rung. The money does not change (it was paid or
 * left to pay when the bill was made), so this is only about who may and when: the person who rang it, while its shift is still open, or a
 * Store Head / Business Head at any time with a reason. A delivery to another state is refused here because it changes the tax on the bill.
 */
export interface DeliveryModeFacts {
  status: string;
  /** what the bill is now: 'Counter' or 'Delivery' */
  currentType: string | null;
  target: string;
  shiftId: number | null;
  shiftStatus: string | null;
  /** the status of its delivery record, when there is one */
  deliveryStatus: string | null;
  isOwn: boolean;
  isManager: boolean;
  outsideState?: boolean;
  reason?: string | null;
}

export const MIN_MODE_REASON = 5;

/** whether the change needs a reason: anything but the biller changing their own bill while its shift is open */
export function needsReason(f: Pick<DeliveryModeFacts, 'shiftId' | 'shiftStatus' | 'isOwn'>): boolean {
  return !(f.isOwn && !!f.shiftId && `${f.shiftStatus}`.toUpperCase() === 'OPEN');
}

/** the first thing that stops the change, in plain words; null when it may go ahead */
export function deliveryModeProblem(f: DeliveryModeFacts): string | null {
  const status = `${f.status}`.toUpperCase();
  if (status === 'VOID') return 'This bill is voided.';
  if (status !== 'COMPLETE') return 'Only a completed bill can be changed this way. Change a held bill on its own screen.';
  if (!['Counter', 'Delivery'].includes(f.target)) return 'Choose a counter sale or a delivery.';
  if ((f.currentType || 'Counter') === f.target) return f.target === 'Delivery' ? 'This bill is already a delivery.' : 'This bill is already a counter sale.';
  if (f.target === 'Delivery' && f.outsideState) {
    return 'A delivery to another state changes the tax on the bill (IGST instead of CGST and SGST), so it cannot be changed from here. Ask your accountant how to correct the bill.';
  }
  if (f.target === 'Counter' && `${f.deliveryStatus ?? ''}`.toLowerCase() === 'delivered') {
    return 'This delivery is already marked as delivered, so it cannot go back to a counter sale.';
  }
  if (!f.isManager) {
    if (!f.isOwn) return 'You can change only the bills you rang up. Ask a Store Head or Business Head.';
    if (!f.shiftId || `${f.shiftStatus}`.toUpperCase() !== 'OPEN') return 'Its shift is closed. Ask a Store Head or Business Head to change it.';
  }
  if (needsReason(f) && `${f.reason ?? ''}`.trim().length < MIN_MODE_REASON) return `Say why (at least ${MIN_MODE_REASON} characters).`;
  return null;
}
