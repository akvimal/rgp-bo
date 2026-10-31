import { DISMISS_REASONS, FIX_REASONS, checkPack, checkReason, packCandidates, packImpact } from './pack-check-rules';

describe('pack check reasons', () => {
  it('needs one of the listed reasons', () => {
    expect(checkReason({}, DISMISS_REASONS).ok).toBe(false);
    expect(checkReason({ reason: 'NOPE' }, DISMISS_REASONS).ok).toBe(false);
    expect(checkReason({ reason: 'ONE_OFF' }, DISMISS_REASONS).ok).toBe(true);
    expect(checkReason({ reason: 'PACK_WRONG' }, DISMISS_REASONS).ok).toBe(false);
    expect(checkReason({ reason: 'PACK_WRONG' }, FIX_REASONS).ok).toBe(true);
  });

  it('asks "Other" to say what, and keeps a note short', () => {
    expect(checkReason({ reason: 'OTHER' }, FIX_REASONS).ok).toBe(false);
    expect(checkReason({ reason: 'OTHER', note: ' ab ' }, FIX_REASONS).ok).toBe(false);
    const r = checkReason({ reason: 'OTHER', note: '  Sold   by the strip ' }, FIX_REASONS);
    expect(r.ok && r.value.note).toBe('Sold by the strip');
    const long = checkReason({ reason: 'ONE_OFF', note: 'x'.repeat(500) }, DISMISS_REASONS);
    expect(long.ok && long.value.note!.length).toBe(200);
  });
});

describe('pack size input', () => {
  it('is a whole number from 1', () => {
    expect(checkPack('10')).toBe(10);
    expect(checkPack(1)).toBe(1);
    for (const bad of [0, -5, 2.5, 'abc', null, undefined, '', 1e9]) expect(checkPack(bad)).toBeNull();
  });
});

describe('packs that would explain an MRP change', () => {
  it('offers a pack ten times bigger, and a tenth when it divides', () => {
    // newest first: MRP 1200 per pack now, 120 per pack before
    expect(packCandidates(10, [1200, 120])).toEqual({ ratio: 10, packs: [100, 1] });
    expect(packCandidates(15, [1200, 120])).toEqual({ ratio: 10, packs: [150] });
  });

  it('works for a fall in MRP as well', () => {
    expect(packCandidates(10, [120, 1200])).toEqual({ ratio: 0.1, packs: [100, 1] });
  });

  it('uses the newest big change and ignores small ones', () => {
    expect(packCandidates(10, [101, 100, 1000])).toEqual({ ratio: 0.1, packs: [100, 1] });
    expect(packCandidates(10, [120, 100, 95])).toBeNull();
  });

  it('offers nothing when the change is not a whole multiple', () => {
    expect(packCandidates(10, [250, 100])).toEqual({ ratio: 2.5, packs: [] });
    // a small rise on top of a whole multiple still counts
    expect(packCandidates(10, [1030, 100])).toEqual({ ratio: 10.3, packs: [100, 1] });
  });

  it('has nothing to say with one purchase', () => {
    expect(packCandidates(10, [100])).toBeNull();
    expect(packCandidates(10, [])).toBeNull();
  });
});

describe('what a new pack does to stock', () => {
  const batches = [
    { id: 1, purchaseQty: 5, soldAndAdjusted: 20, ptr: 100 },   // 5 packs of 10: 50 units, 20 gone
    { id: 2, purchaseQty: 2, soldAndAdjusted: 0, ptr: 100 },
  ];

  it('restates units and value for every batch', () => {
    const i = packImpact(batches, 10, 20);
    expect(i.unitsBefore).toBe(30 + 20);
    expect(i.unitsAfter).toBe(80 + 40);
    expect(i.valueBefore).toBe(500);          // 50 units at 100/10
    expect(i.valueAfter).toBe(600);           // 120 units at 100/20
    expect(i.belowZero).toBe(0);
    expect(i.batches).toBe(2);
  });

  it('counts batches that would go below zero', () => {
    const i = packImpact(batches, 10, 2);     // batch 1 would be 10 units, 20 already gone
    expect(i.belowZero).toBe(1);
    expect(i.unitsAfter).toBe(4);
  });

  it('is the same stock when the pack does not change', () => {
    const i = packImpact(batches, 10, 10);
    expect([i.unitsBefore, i.unitsAfter, i.valueBefore, i.valueAfter]).toEqual([50, 50, 500, 500]);
  });
});
