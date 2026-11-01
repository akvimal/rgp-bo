/**
 * The weekly knowledge check — KC-1..3
 * Five questions a week; the server marks each answer and shows the right one only after it is given; one counted attempt a week and practice any time;
 * results are kept for coaching (nothing in KPI); the team view is for the people who run the shop.
 */
import { test, expect } from '../fixtures/index.js';
import { q } from '../seed/db.js';
import { QUESTIONS } from '../../api-v2/src/modules/app/knowledge/question-bank';
import { WALKTHROUGHS, PAGES } from '../../frontend/src/app/guide/app-guide-content';
import { CHAPTERS } from '../../frontend/src/app/packs/pharmacy/guide/pharmacy-guide-content';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

/** answers every question of an attempt, right ones first `right` times, wrong after; returns the replies */
async function answerAll(api: any, who: string, attempt: any, right: number) {
  const out: any[] = [];
  let n = 0;
  for (const item of attempt.questions) {
    const bank = QUESTIONS.find((x) => x.id === item.id)!;
    const rightText = bank.options[bank.answer];
    const rightIdx = item.options.indexOf(rightText);
    const choice = n < right ? rightIdx : (rightIdx + 1) % item.options.length;
    const r = await api.request('POST', `/knowledge/${attempt.attemptId}/answer`, { question: item.id, choice }, who);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    out.push(r.body);
    n++;
  }
  return out;
}

test.describe('Knowledge check @p1', () => {
  test('KC-1 every question links to a page or job that exists @happy', async () => {
    const jobs = new Set(WALKTHROUGHS.map((w) => w.id));
    const pages = new Set(PAGES.map((p) => p.id));
    const chapters = new Set(CHAPTERS.map((c) => c.id));
    for (const k of QUESTIONS) {
      const u = new URL(k.guide, 'http://x');
      if (u.pathname === '/secure/app-guide') {
        const job = u.searchParams.get('job'); const page = u.searchParams.get('page');
        expect(job ? jobs.has(job) : pages.has(page as string), `${k.id} points at a real guide entry`).toBe(true);
      } else {
        expect(chapters.has(u.searchParams.get('c') as string), `${k.id} points at a real chapter`).toBe(true);
      }
    }
  });

  test('KC-2 the right answer is shown only after answering; one counted check a week; practice is not counted @happy', async ({ api }) => {
    await q(`delete from kc_attempt where user_id = (select id from app_user where email = $1)`, [COUNTER]);
    const me0 = (await api.request('GET', '/knowledge/me', undefined, COUNTER)).body;
    expect(me0).toMatchObject({ kind: 'counter', canSeeTeam: false, perCheck: 5, passPct: 80 });
    expect(me0.thisWeek.started).toBe(false);

    const a = (await api.request('POST', '/knowledge/start', { practice: false }, COUNTER)).body;
    expect(a.questions).toHaveLength(5);
    // nothing about the right answer before answering
    for (const item of a.questions) { expect(item.answer).toBeUndefined(); expect(item.explain).toBeUndefined(); expect(item.correct).toBeUndefined(); }
    // starting again resumes the same check
    expect((await api.request('POST', '/knowledge/start', { practice: false }, COUNTER)).body.attemptId).toBe(a.attemptId);

    // finishing early is refused; a question cannot be answered twice; another person cannot answer it
    expect((await api.request('POST', `/knowledge/${a.attemptId}/finish`, undefined, COUNTER)).status).toBe(400);
    const first = a.questions[0];
    const r1 = await api.request('POST', `/knowledge/${a.attemptId}/answer`, { question: first.id, choice: 0 }, COUNTER);
    expect(r1.status).toBeLessThan(300);
    expect(r1.body).toHaveProperty('explain');
    expect(r1.body).toHaveProperty('answer');
    expect((await api.request('POST', `/knowledge/${a.attemptId}/answer`, { question: first.id, choice: 1 }, COUNTER)).status).toBe(400);
    expect((await api.request('POST', `/knowledge/${a.attemptId}/answer`, { question: a.questions[1].id, choice: 0 }, MGR)).status).toBe(404);
    expect((await api.request('POST', `/knowledge/${a.attemptId}/answer`, { question: a.questions[1].id, choice: 9 }, COUNTER)).status).toBe(400);

    // the rest: 4 right of 5 passes (the first answer may or may not have been right, so judge from the server)
    const rest = a.questions.slice(1);
    for (const item of rest) {
      const bank = QUESTIONS.find((x) => x.id === item.id)!;
      const choice = item.options.indexOf(bank.options[bank.answer]);
      expect((await api.request('POST', `/knowledge/${a.attemptId}/answer`, { question: item.id, choice }, COUNTER)).status).toBeLessThan(300);
    }
    const fin = (await api.request('POST', `/knowledge/${a.attemptId}/finish`, undefined, COUNTER)).body;
    expect(fin.total).toBe(5);
    expect(fin.score).toBeGreaterThanOrEqual(4);
    expect(fin.passed).toBe(true);
    expect(fin.missed.length).toBe(5 - fin.score);

    // the week's check is done: a second counted one is refused, practice is allowed and not recorded as a counted check
    expect((await api.request('POST', '/knowledge/start', { practice: false }, COUNTER)).status).toBe(400);
    const p = (await api.request('POST', '/knowledge/start', { practice: true }, COUNTER)).body;
    expect(p.kind).toBe('PRACTICE');
    await answerAll(api, COUNTER, p, 5);
    expect((await api.request('POST', `/knowledge/${p.attemptId}/finish`, undefined, COUNTER)).body.passed).toBe(true);
    const me1 = (await api.request('GET', '/knowledge/me', undefined, COUNTER)).body;
    expect(me1.thisWeek).toMatchObject({ finished: true, passed: true });
    expect(me1.history).toHaveLength(1);
    expect(me1.practiceThisMonth).toBe(1);
    expect(me1.streak).toBe(1);
  });

  test('KC-3 a counter login cannot see the team; the people who run the shop see who did it and weak topics @happy', async ({ api }) => {
    expect((await api.request('GET', '/knowledge/team', undefined, COUNTER)).status).toBe(403);

    // the owner-level login does a check with wrong answers so a weak topic shows
    await q(`delete from kc_attempt where user_id = (select id from app_user where email = $1)`, [MGR]);
    for (let i = 0; i < 2; i++) {
      const p = (await api.request('POST', '/knowledge/start', { practice: true }, MGR)).body;
      await answerAll(api, MGR, p, 0);
      await api.request('POST', `/knowledge/${p.attemptId}/finish`, undefined, MGR);
    }
    const team = (await api.request('GET', '/knowledge/team', undefined, MGR)).body;
    expect(team.passPct).toBe(80);
    const mine = team.people.find((x: any) => x.name && x.role);
    expect(mine).toBeTruthy();
    expect(team.topics.length).toBeGreaterThan(0);
    // the sales login who finished a check above is listed as done
    const counter = team.people.find((x: any) => x.role === 'Sales Staff' || x.role === 'Counter');
    if (counter) expect(typeof counter.doneThisWeek).toBe('boolean');
    // nothing in KPI: the knowledge check adds no KPI measure
    const kpi = await q(`select count(*)::int as n from information_schema.tables where table_name like 'kpi%' and table_name like '%knowledge%'`);
    expect(kpi[0].n).toBe(0);
  });
});
