/**
 * Desktop notifications for the alerts, kept pure (no Angular, no browser) so the rules are tested without a browser.
 * The bell already fetches the person's open alerts each minute; these rules decide which of them are worth a desktop notification.
 */
export type NotifyLevel = 'critical' | 'warning';

export interface NotifiableAlert { id: number; title?: string | null; severity?: string | null; read?: boolean | null; link?: string | null }

const RANK: Record<string, number> = { info: 0, warning: 1, critical: 2 };
const MIN_RANK: Record<NotifyLevel, number> = { warning: 1, critical: 2 };

export const isLevel = (v: any): v is NotifyLevel => v === 'critical' || v === 'warning';

/**
 * The alerts that arrived since the last look and are worth a notification: unread, not seen before, at or above the person's level.
 * An alert is only ever notified once (the caller keeps `seen`).
 */
export function freshAlerts(items: NotifiableAlert[], seen: Set<number>, level: NotifyLevel): NotifiableAlert[] {
  return items.filter((a) => !seen.has(a.id) && !a.read && (RANK[String(a.severity)] ?? 0) >= MIN_RANK[level]);
}

/** a desktop notification shows only when the person is not already looking at the app; the bell is enough then */
export const worthInterrupting = (tabVisible: boolean, windowFocused: boolean): boolean => !(tabVisible && windowFocused);

export interface Notice { title: string; body: string; link: string | null; ids: number[]; tag: string }

/**
 * What to show for the new alerts: the headline only (never the details, which can name a customer or an amount; those stay behind the click).
 * Several together become one notification, so a busy minute is one tap and not a stack.
 */
export function describe(picked: NotifiableAlert[]): Notice | null {
  if (!picked.length) return null;
  const head = (a: NotifiableAlert) => String(a.title || 'Something needs your attention').trim();
  if (picked.length === 1) return { title: head(picked[0]), body: 'Open the app to see it.', link: picked[0].link || null, ids: [picked[0].id], tag: 'rgp-alerts' };
  const rest = picked.length - 1;
  return { title: `${picked.length} alerts need your attention`, body: `${head(picked[0])} and ${rest} more.`, link: '/secure/notifications', ids: picked.map((a) => a.id), tag: 'rgp-alerts' };
}
