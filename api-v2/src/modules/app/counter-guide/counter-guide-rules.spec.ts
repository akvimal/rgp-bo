import { advise, GuideCard, validateCard } from './counter-guide-rules';

const card: GuideCard = {
  id: 1, key: 'headache', name: 'Headache', asksDuration: true, durationLimitDays: 3, referralText: 'See a doctor.',
  warnings: [{ id: 10, text: 'Sudden severe headache' }, { id: 11, text: 'Stiff neck with fever' }],
  options: [
    { id: 1, composition: 'Paracetamol 500 mg', compositionKey: 'paracetamol500mg', form: 'tablet', audiences: ['adult', 'over60'], excludes: ['kidney_liver'], sortOrder: 1 },
    { id: 2, composition: 'Ibuprofen 400 mg', compositionKey: 'ibuprofen400mg', form: 'tablet', audiences: ['adult'], excludes: ['allergy_painkiller', 'ulcer_acidity', 'kidney_liver', 'asthma', 'blood_thinner', 'high_bp'], sortOrder: 2 },
    { id: 3, composition: 'Paracetamol 250 mg', compositionKey: 'paracetamol250mg', form: 'tablet', audiences: ['child'], excludes: [], sortOrder: 3 },
  ],
};
const ask = (o: any) => advise(card, { who: 'adult', duration: 'lt2', warnings: [], issues: [], ...o });

describe('who it is for', () => {
  it('always refers a child under 2 and a pregnant or breastfeeding woman, with no options', () => {
    for (const who of ['under2', 'pregnant']) {
      const r: any = ask({ who });
      expect(r.refer).toBe(true);
      expect(r.reasons[0].kind).toBe('WHO');
      expect(r.options).toBeUndefined();
    }
  });
});

describe('warning signs and how long', () => {
  it('refers on any warning sign, naming it, and shows no medicines', () => {
    const r: any = ask({ warnings: [11] });
    expect(r).toMatchObject({ refer: true, text: 'See a doctor.' });
    expect(r.reasons).toEqual([{ kind: 'WARNING', text: 'Stiff neck with fever' }]);
  });
  it('ignores a warning id that is not on the card', () => {
    expect(ask({ warnings: [999] }).refer).toBe(false);
  });
  it('refers when the problem has lasted as long as the limit', () => {
    expect(ask({ duration: 'd2_3' }).refer).toBe(false);          // limit 3: 2 to 3 days is still under it
    expect((ask({ duration: 'd4_7' }) as any).reasons[0].kind).toBe('DURATION');
    expect(ask({ duration: 'gt7' }).refer).toBe(true);
  });
  it('needs the duration when the card asks for it, and not when it does not', () => {
    expect(() => ask({ duration: undefined })).toThrow(/how long/);
    expect(advise({ ...card, asksDuration: false }, { who: 'adult', warnings: [], issues: [] }).refer).toBe(false);
  });
});

describe('options', () => {
  it('gives the card\'s options for the person, in the card order', () => {
    expect((ask({}) as any).options.map((o: any) => o.id)).toEqual([1, 2]);
    expect((ask({ who: 'child' }) as any).options.map((o: any) => o.id)).toEqual([3]);
    expect((ask({ who: 'over60' }) as any).options.map((o: any) => o.id)).toEqual([1]);       // ibuprofen is adults only
  });
  it('removes an option the ticks rule out and says why', () => {
    const r: any = ask({ issues: ['ulcer_acidity'] });
    expect(r.options.map((o: any) => o.id)).toEqual([1]);
    expect(r.dropped.find((d: any) => d.option.id === 2).because).toEqual(['Stomach ulcer or frequent acidity']);
  });
  it('refers when nothing is left', () => {
    const r: any = ask({ issues: ['kidney_liver'] });
    expect(r.options).toBeUndefined();                                                      // both adult options exclude it: a referral carries no medicines
    expect(r.refer).toBe(true);
    expect(r.reasons[0].kind).toBe('NO_OPTION');
  });
  it('asks the pharmacist to check when other medicines are taken, and removes nothing for it', () => {
    const r: any = ask({ issues: ['other_medicines'] });
    expect(r.caution).toBe(true);
    expect(r.options).toHaveLength(2);
  });
});

describe('a card fit to save', () => {
  const good = {
    key: 'Headache', name: 'Headache', durationLimitDays: 3, referralText: 'See a doctor today.',
    warnings: [{ text: 'Sudden severe headache' }, { text: 'Stiff neck with fever' }],
    options: [{ composition: 'Paracetamol 500mg', form: 'tablet', audiences: ['adult', 'over60'], excludes: ['kidney_liver'] }],
  };
  it('accepts a complete card and tidies it', () => {
    const r: any = validateCard(good);
    expect(r.ok).toBe(true);
    expect(r.card.key).toBe('headache');
  });
  it('wants two warning signs, a strength in each composition, a known form and tick, and a limit', () => {
    const bad: any = validateCard({ ...good, durationLimitDays: 0, warnings: [{ text: 'Only one sign' }], options: [{ composition: 'Paracetamol', form: 'pill', audiences: ['teen'], excludes: ['moon'] }] });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(' | ')).toMatch(/after how many days/);
    expect(bad.errors.join(' | ')).toMatch(/at least two warning signs/);
    expect(bad.errors.join(' | ')).toMatch(/with its strength/);
    expect(bad.errors.join(' | ')).toMatch(/not a dosage form/);
    expect(bad.errors.join(' | ')).toMatch(/who it is for/);
    expect(bad.errors.join(' | ')).toMatch(/unknown "do not give with"/);
  });
  it('keeps a picture as an emoji only: no spaces, at most a few characters', () => {
    const r: any = validateCard({ ...good, icon: '  🤕 x\n', warnings: [{ text: 'Sign one', icon: '🌡️' }, { text: 'Sign two' }] });
    expect(r.ok).toBe(true);
    expect(r.card.icon).toBe('🤕x');
    expect(r.card.warnings.map((w: any) => w.icon)).toEqual(['🌡️', null]);
  });
  it('wants at least one option', () => {
    expect((validateCard({ ...good, options: [] }) as any).errors.join(' ')).toMatch(/at least one option/);
  });
});
