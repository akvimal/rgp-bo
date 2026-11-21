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
  it('give every option a dose and the days, and never the vague "as directed" line', () => {
    for (const c of STARTER_CARDS) for (const o of c.options) {
      expect({ card: c.key, option: o.composition, dose: !!o.dose, days: !!o.days }).toEqual({ card: c.key, option: o.composition, dose: true, days: true });
      expect(String(o.guidance || '')).not.toMatch(/as directed|pack or by the pharmacist/i);
    }
  });
  it('write morning - noon - night doses in the form the counter reads', () => {
    const slotted = STARTER_CARDS.flatMap((c) => c.options).filter((o) => /\d\s*(\([^)]*\))?\s*-\s*\d/.test(String(o.dose)));
    expect(slotted.length).toBeGreaterThan(5);
  });
});
