/**
 * Why a shift did not match at close. Pure: no framework, no database.
 *
 * When the counted cash differs from the expected cash, or a digital provider's terminal total differs from what the system recorded, the person
 * closing says why, for the cash and for each provider separately. A difference of nothing needs no reason.
 */

export const REASON_MIN = 3;
export const REASON_MAX = 300;

/** a difference of a paisa or more (money is held to two places) */
export const hasVariance = (v: number): boolean => Math.abs(Math.round(v * 100)) >= 1;

const clean = (v: any): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, REASON_MAX);

export interface DigitalLine { provider: string; system: number; counted: number; variance: number; reason?: string | null }

/**
 * The reasons for a close. `digital` carries each provider's figures; `given` maps provider to the reason typed. Returns the cash reason (null
 * when there is no cash variance), the digital lines with their reasons, and a problem message for the first missing reason, if any.
 */
export function varianceReasons(
  cashVariance: number,
  cashReason: any,
  digital: DigitalLine[] | null,
  given: Record<string, any>,
): { cashReason: string | null; digital: DigitalLine[] | null; problem: string | null } {
  let problem: string | null = null;
  const cr = clean(cashReason);
  if (hasVariance(cashVariance) && cr.length < REASON_MIN) {
    problem = `The drawer is ${cashVariance < 0 ? 'short' : 'over'} by Rs ${Math.abs(Math.round(cashVariance * 100) / 100)}. Say why.`;
  }
  const lines = digital
    ? digital.map((d) => {
        const r = clean(given[d.provider]);
        if (hasVariance(d.variance)) {
          if (r.length < REASON_MIN && !problem) problem = `The ${d.provider} total differs by Rs ${Math.abs(d.variance)}. Say why.`;
          return { ...d, reason: r || null };
        }
        return { ...d, reason: null };
      })
    : null;
  return { cashReason: hasVariance(cashVariance) ? cr || null : null, digital: lines, problem };
}
