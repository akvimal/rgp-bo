import { cleanReason, countReason, COUNT_WINDOW_DAYS } from './vault-count-due';

describe('the reason a vault count needs', () => {
  it('needs none when the count matches the books', () => {
    expect(countReason(0, '')).toEqual({ reason: null, problem: null });
    expect(countReason(0, 'ignored')).toEqual({ reason: null, problem: null });
  });

  it('asks for a reason, in plain words, for a shortage or a surplus', () => {
    expect(countReason(-250, '').problem).toBe('The vault count is Rs 250 short of the books. Say why.');
    expect(countReason(40.5, ' ').problem).toBe('The vault count is Rs 40.5 over the books. Say why.');
    expect(countReason(-1, 'ab').problem).toBeTruthy();                // too short to be a reason
  });

  it('a difference of a paisa still needs a reason, as at a shift close', () => {
    expect(countReason(0.01, '').problem).toBeTruthy();
    expect(countReason(0.004, '').problem).toBeNull();
  });

  it('keeps the reason, tidied and not longer than the limit', () => {
    expect(countReason(-10, '  note   short \n because ').reason).toBe('note short because');
    expect(cleanReason('x'.repeat(500)).length).toBe(300);
  });

  it('looks back only a couple of days', () => {
    expect(COUNT_WINDOW_DAYS).toBe(2);
  });
});
