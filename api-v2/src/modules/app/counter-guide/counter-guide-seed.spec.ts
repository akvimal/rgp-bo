import { STARTER_CARDS } from './counter-guide-seed';
import { validateCard } from './counter-guide-rules';

describe('the starter cards', () => {
  it('are twelve, each fit to save', () => {
    expect(STARTER_CARDS).toHaveLength(12);
    for (const c of STARTER_CARDS) {
      const r: any = validateCard(c);
      expect({ key: c.key, errors: r.ok ? [] : r.errors }).toEqual({ key: c.key, errors: [] });
    }
  });
  it('each have a picture, and so does every warning sign', () => {
    for (const c of STARTER_CARDS) { expect(c.icon).toBeTruthy(); for (const w of c.warnings) expect(w.icon).toBeTruthy(); }
  });
  it('have different keys', () => {
    expect(new Set(STARTER_CARDS.map((c) => c.key)).size).toBe(12);
  });
  it('never put a dose in the guidance', () => {
    for (const c of STARTER_CARDS) for (const o of c.options) expect(String(o.guidance || '')).not.toMatch(/\b\d+\s*(mg|ml|tablets?|times)\b.*\b(daily|a day|hourly|every)\b/i);
  });
});
