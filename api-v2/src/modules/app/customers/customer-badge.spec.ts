import { badgeOf } from './customer-badge';

describe('badgeOf', () => {
  it('names the tier and the segment, and tones by value', () => {
    const b = badgeOf({ tier: 'Gold', segment: 'Champions', dueBack: false });
    expect(b.label).toBe('Gold · Champion');
    expect(b.tone).toBe('gold');
    expect(b.cue).toMatch(/best customers/);
    expect(badgeOf({ tier: 'Silver', segment: 'Loyal', dueBack: false }).tone).toBe('silver');
    expect(badgeOf({ tier: 'Bronze', segment: 'Regular', dueBack: false }).label).toBe('Bronze · Regular');
  });

  it('shows a customer slipping away in a quiet amber, with the tier they were', () => {
    const b = badgeOf({ tier: 'Gold', segment: 'At risk', dueBack: false });
    expect(b.label).toBe('Gold · At risk');
    expect(b.tone).toBe('watch');
    expect(b.cue).toMatch(/ask how they have been/i);
  });

  it('a new customer has no tier and is welcomed', () => {
    const b = badgeOf({ tier: null, segment: 'New', dueBack: false });
    expect(b.label).toBe('New');
    expect(b.tone).toBe('new');
  });

  it('adds the refill cue when one is due, and never mentions money', () => {
    const b = badgeOf({ tier: 'Silver', segment: 'Loyal', dueBack: true });
    expect(b.cue).toMatch(/refill may be due/);
    expect(JSON.stringify(b)).not.toMatch(/₹|spend|rs /i);
  });

  it('a customer with no bills yet', () => {
    expect(badgeOf({ tier: null, segment: 'No purchases', dueBack: false }).label).toBe('No purchases yet');
  });
});
