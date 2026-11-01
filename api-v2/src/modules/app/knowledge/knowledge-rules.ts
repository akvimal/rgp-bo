/**
 * The rules of the weekly knowledge check. Pure: no framework and no database, relative imports only, so they are unit tested.
 * One scored attempt a week (Monday to Sunday, India time), unlimited practice; five questions spread over topics and not the ones seen lately;
 * passing is 80%. The result is kept for coaching and is not part of any KPI.
 */
import { QUESTIONS, Question } from './question-bank';

export const QUESTIONS_PER_CHECK = 5;
export const PASS_PCT = 80;
/** a topic is "weak" when at least this many of its questions were answered in the last 90 days and a third or more were missed */
export const WEAK_MIN_ANSWERED = 3;
export const WEAK_MISS_RATE = 1 / 3;

export type RoleKind = 'counter' | 'manager';
const COUNTER_ROLES = ['Sales Staff', 'Counter'];
export const roleKindOf = (roleName: string | null | undefined): RoleKind => (COUNTER_ROLES.includes(String(roleName ?? '')) ? 'counter' : 'manager');

/** the questions a kind of role is asked: the shared ones and its own */
export const bankFor = (kind: RoleKind, all: Question[] = QUESTIONS): Question[] => all.filter((q) => q.who === 'all' || q.who === kind);

const IST_MS = 5.5 * 3600000;
/** the Monday of the week of an instant, in India time, as YYYY-MM-DD */
export function weekStart(at: Date = new Date()): string {
  const d = new Date(at.getTime() + IST_MS);
  const dow = (d.getUTCDay() + 6) % 7;                          // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/**
 * Picks the questions: not the ones asked in recent attempts when there are enough others, and spread over the topics (one from each topic in turn).
 * `rand` returns a number in [0, 1), so a test can fix the choice.
 */
export function pickQuestions(bank: Question[], recentIds: string[], n: number = QUESTIONS_PER_CHECK, rand: () => number = Math.random): Question[] {
  const recent = new Set(recentIds);
  const fresh = bank.filter((q) => !recent.has(q.id));
  const pool = fresh.length >= n ? fresh : bank;
  const shuffle = <T>(a: T[]): T[] => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const byTopic = new Map<string, Question[]>();
  for (const q of shuffle(pool)) { if (!byTopic.has(q.topic)) byTopic.set(q.topic, []); byTopic.get(q.topic)!.push(q); }
  const topics = shuffle(Array.from(byTopic.keys()));
  const out: Question[] = [];
  while (out.length < Math.min(n, pool.length)) {
    let moved = false;
    for (const t of topics) {
      const list = byTopic.get(t)!;
      if (list.length && out.length < n) { out.push(list.shift() as Question); moved = true; }
    }
    if (!moved) break;
  }
  return out;
}

/** the options in a shuffled order for one attempt, with the index of the right one in that order */
export function shuffleOptions(q: Question, rand: () => number = Math.random): { options: string[]; answer: number } {
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { options: idx.map((i) => q.options[i]), answer: idx.indexOf(q.answer) };
}

export const passed = (score: number, total: number): boolean => total > 0 && (score / total) * 100 >= PASS_PCT;

/** the topics a person is weak in, from their answers: [{ topic, answered, missed }], the weakest first */
export function weakTopics(answers: { topic: string; correct: boolean }[]): { topic: string; answered: number; missed: number }[] {
  const by = new Map<string, { answered: number; missed: number }>();
  for (const a of answers) {
    const t = by.get(a.topic) || { answered: 0, missed: 0 };
    t.answered += 1; if (!a.correct) t.missed += 1;
    by.set(a.topic, t);
  }
  return Array.from(by.entries()).map(([topic, v]) => ({ topic, ...v }))
    .filter((t) => t.answered >= WEAK_MIN_ANSWERED && t.missed / t.answered >= WEAK_MISS_RATE)
    .sort((a, b) => b.missed / b.answered - a.missed / a.answered || b.missed - a.missed);
}

/** consecutive weeks, ending this week or last, in which a scored check was finished; `weeks` are Monday dates */
export function streakOf(weeks: string[], thisWeek: string): number {
  const have = new Set(weeks);
  const back = (w: string) => new Date(Date.parse(w + 'T00:00:00Z') - 7 * 86400000).toISOString().slice(0, 10);
  let cur = have.has(thisWeek) ? thisWeek : back(thisWeek);
  let n = 0;
  while (have.has(cur)) { n++; cur = back(cur); }
  return n;
}
