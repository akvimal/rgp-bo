/**
 * Which shift template fits "now". A template's times are a plan: people open and close when the shop actually does, so the one offered is the template
 * whose window is closest to the current time, and a window counts as matching when now is inside it or within the tolerance of it (default 2 hours).
 * Always offers one when the store has any (the nearest), and says whether it is within the tolerance. Pure: times are "HH:MM" and minutes since midnight.
 */
export const DEFAULT_TOLERANCE_MINUTES = 120;

export interface TemplateWindow { id: number; name: string; starttime: string; endtime: string }
export interface TemplatePick<T extends TemplateWindow> { template: T; within: boolean; distance: number }

/** "09:30" -> 570; null for anything that is not a time */
export function minutesOf(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? '').trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

/** minutes from `now` to the window (0 inside it); a window that ends after midnight (22:00-06:00) counts the day before and the day after as well */
export function distanceToWindow(now: number, start: number, end: number): number {
  const e = end <= start ? end + 1440 : end;
  let best = Infinity;
  for (const shift of [-1440, 0, 1440]) {
    const ws = start + shift, we = e + shift;
    best = Math.min(best, now < ws ? ws - now : now > we ? now - we : 0);
  }
  return best;
}

export function suggestTemplate<T extends TemplateWindow>(templates: T[], nowMinutes: number, tolerance = DEFAULT_TOLERANCE_MINUTES): TemplatePick<T> | null {
  const scored = templates
    .map((t) => ({ t, s: minutesOf(t.starttime), e: minutesOf(t.endtime) }))
    .filter((x) => x.s !== null && x.e !== null)
    .map((x) => ({ template: x.t, start: x.s as number, distance: distanceToWindow(nowMinutes, x.s as number, x.e as number) }));
  if (!scored.length) return null;
  scored.sort((a, b) => a.distance - b.distance || a.start - b.start);
  const top = scored[0];
  return { template: top.template, within: top.distance <= tolerance, distance: top.distance };
}
