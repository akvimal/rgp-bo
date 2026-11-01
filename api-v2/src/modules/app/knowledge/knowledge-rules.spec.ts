import { PASS_PCT, QUESTIONS_PER_CHECK, bankFor, passed, pickQuestions, roleKindOf, shuffleOptions, streakOf, weakTopics, weekStart } from './knowledge-rules';
import { QUESTIONS, TOPIC_LABELS } from './question-bank';

/** a repeatable stand-in for Math.random */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

describe('the question bank', () => {
  it('has unique ids, four options each, a valid right answer, an explanation and a place to read more', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    // every problem is collected with its question id, so a failure names the question
    const problems: string[] = [];
    for (const q of QUESTIONS) {
      if (q.options.length !== 4) problems.push(`${q.id}: needs four options`);
      if (new Set(q.options).size !== 4) problems.push(`${q.id}: the options differ`);
      if (!(q.answer >= 0 && q.answer < 4)) problems.push(`${q.id}: the right answer is not one of the options`);
      if (q.explain.length <= 20) problems.push(`${q.id}: needs an explanation`);
      if (!/^\/secure\/(pharmacy-guide|app-guide)\?/.test(q.guide)) problems.push(`${q.id}: needs a place to read more`);
      if (!Object.keys(TOPIC_LABELS).includes(q.topic)) problems.push(`${q.id}: unknown topic`);
    }
    expect(problems).toEqual([]);
  });

  it('gives each kind of role enough questions, from enough topics', () => {
    for (const kind of ['counter', 'manager'] as const) {
      const bank = bankFor(kind);
      expect(bank.length).toBeGreaterThanOrEqual(20);
      expect(new Set(bank.map((q) => q.topic)).size).toBeGreaterThanOrEqual(5);
    }
    expect(bankFor('counter').some((q) => q.who === 'manager')).toBe(false);
    expect(bankFor('manager').some((q) => q.who === 'counter')).toBe(false);
  });
});

describe('the weekly knowledge check', () => {
  it('knows who is a counter login', () => {
    expect(roleKindOf('Counter')).toBe('counter');
    expect(roleKindOf('Sales Staff')).toBe('counter');
    expect(roleKindOf('Store Head')).toBe('manager');
    expect(roleKindOf('Business Head')).toBe('manager');
  });

  it('counts a week from Monday, in India time', () => {
    expect(weekStart(new Date('2026-11-01T10:00:00Z'))).toBe('2026-10-26');     // a Sunday afternoon
    expect(weekStart(new Date('2026-11-02T00:00:00Z'))).toBe('2026-11-02');     // Monday morning in India
    expect(weekStart(new Date('2026-11-01T19:00:00Z'))).toBe('2026-11-02');     // 00:30 on Monday in India, still Sunday in UTC
    expect(weekStart(new Date('2026-11-04T05:00:00Z'))).toBe('2026-11-02');
  });

  it('picks five different questions spread over the topics and avoids the recent ones', () => {
    const bank = bankFor('counter');
    const first = pickQuestions(bank, [], QUESTIONS_PER_CHECK, seeded(1));
    expect(first).toHaveLength(QUESTIONS_PER_CHECK);
    expect(new Set(first.map((q) => q.id)).size).toBe(QUESTIONS_PER_CHECK);
    expect(new Set(first.map((q) => q.topic)).size).toBe(QUESTIONS_PER_CHECK);            // one from each of five topics
    const next = pickQuestions(bank, first.map((q) => q.id), QUESTIONS_PER_CHECK, seeded(2));
    expect(next.some((q) => first.map((f) => f.id).includes(q.id))).toBe(false);
    // when too few are left unseen, the whole bank is used again
    const again = pickQuestions(bank, bank.map((q) => q.id), QUESTIONS_PER_CHECK, seeded(3));
    expect(again).toHaveLength(QUESTIONS_PER_CHECK);
  });

  it('shuffles the options and keeps track of the right one', () => {
    for (let s = 1; s < 20; s++) {
      const q = QUESTIONS[s % QUESTIONS.length];
      const sh = shuffleOptions(q, seeded(s));
      expect(sh.options.slice().sort()).toEqual(q.options.slice().sort());
      expect(sh.options[sh.answer]).toBe(q.options[q.answer]);
    }
  });

  it('passes at 80 percent', () => {
    expect(PASS_PCT).toBe(80);
    expect(passed(4, 5)).toBe(true);
    expect(passed(3, 5)).toBe(false);
    expect(passed(5, 5)).toBe(true);
    expect(passed(0, 0)).toBe(false);
  });

  it('names the topics a person is weak in, only with enough answers', () => {
    const a = (topic: string, correct: boolean) => ({ topic, correct });
    const answers = [a('stock', false), a('stock', false), a('stock', true), a('billing', true), a('billing', true), a('billing', false), a('rx', false), a('rx', false)];
    const weak = weakTopics(answers);
    expect(weak.map((w) => w.topic)).toEqual(['stock', 'billing']);                    // rx has too few answers to say
    expect(weak[0]).toEqual({ topic: 'stock', answered: 3, missed: 2 });
    expect(weakTopics([a('stock', true), a('stock', true), a('stock', true)])).toEqual([]);
  });

  it('counts the weeks in a row, ending this week or last', () => {
    expect(streakOf(['2026-10-12', '2026-10-19', '2026-10-26'], '2026-10-26')).toBe(3);
    expect(streakOf(['2026-10-12', '2026-10-19'], '2026-10-26')).toBe(2);                // this week not done yet: last week still counts
    expect(streakOf(['2026-10-12', '2026-10-26'], '2026-10-26')).toBe(1);                // a gap breaks it
    expect(streakOf(['2026-10-05'], '2026-10-26')).toBe(0);
    expect(streakOf([], '2026-10-26')).toBe(0);
  });
});
