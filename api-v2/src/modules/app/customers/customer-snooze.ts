/** Why a customer is taken off today's "Contact today" list, in the words the screen shows. */
export const SNOOZE_REASONS: Record<string, string> = {
  CALL_LATER: 'Asked to be called later',
  AWAY: 'Away or travelling',
  UNWELL: 'Unwell',
  BUSY: 'Too busy to call today',
  WAITING_STOCK: 'Waiting for stock or medicine',
  OTHER: 'Other',
};

export interface SnoozeInput { reason: string; note: string | null; }

/**
 * A postponement needs one of the listed reasons. "Other" has to say what, in a few words. Returns the cleaned input, or the message to show.
 */
export function checkSnooze(body: { reason?: unknown; note?: unknown } | null | undefined): { ok: true; value: SnoozeInput } | { ok: false; message: string } {
  const reason = String(body?.reason ?? '');
  if (!SNOOZE_REASONS[reason]) return { ok: false, message: 'Choose why this is being postponed.' };
  const note = String(body?.note ?? '').trim().replace(/\s+/g, ' ').slice(0, 200);
  if (reason === 'OTHER' && note.length < 3) return { ok: false, message: 'Say in a few words why it is being postponed.' };
  return { ok: true, value: { reason, note: note || null } };
}
