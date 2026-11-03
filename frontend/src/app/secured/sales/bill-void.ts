import { JwtHelperService } from "@auth0/angular-jwt";

/** the signed-in person's id, from the token (null when it cannot be read: the server decides in any case) */
export function signedInUserId(): number | null {
  try {
    const token = sessionStorage.getItem('token');
    const id = token ? new JwtHelperService().decodeToken(token)?.id : null;
    return id ? +id : null;
  } catch { return null; }
}

/**
 * Whether the Void button is offered: a completed bill of the shift that is open now, rung by this person (or by anyone for a manager).
 * It only decides what is shown; the server checks the same rules again.
 */
export function canVoidBill(sale: any, openShiftId: number | null | undefined, canVoidAny: boolean, userId: number | null): boolean {
  if (!sale || `${sale.status}`.toUpperCase() !== 'COMPLETE') return false;
  if (!openShiftId || !sale.shiftid || +sale.shiftid !== +openShiftId) return false;
  if (canVoidAny || userId === null) return true;
  return [sale.createdby ?? sale.created?.id, sale.actinguserid ?? sale.actinguser?.id].some((u: any) => u && +u === userId);
}
