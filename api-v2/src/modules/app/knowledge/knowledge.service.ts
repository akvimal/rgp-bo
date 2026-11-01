import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { BANK_META, QUESTIONS, Question, TOPIC_LABELS } from './question-bank';
import { PASS_PCT, QUESTIONS_PER_CHECK, RoleKind, bankFor, passed, pickQuestions, roleKindOf, shuffleOptions, streakOf, weakTopics, weekStart } from './knowledge-rules';

const byId = new Map<string, Question>(QUESTIONS.map((q) => [q.id, q]));

/**
 * The weekly knowledge check: five questions, one scored attempt a week (Monday to Sunday) and practice any time. Each answer is marked at once on the
 * server, which sends the right answer and why only after an answer is given. The results are for coaching: a person sees their own, and the people who run
 * the store see who has done it and which topics are weak. They are not part of any KPI.
 */
@Injectable()
export class KnowledgeService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  private async who(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const [b] = await this.manager.query(`select ${BUSINESS_OF_USER_SQL} as business_id from app_user u where u.id = $1`, [user.id]);
    const [s] = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive order by is_primary desc, id limit 1`, [user.id]);
    const role = r?.name || '';
    return { id: user.id as number, role, kind: roleKindOf(role) as RoleKind, manager: isManagerRole(role), owner: isOwnerRole(role), businessId: (b?.business_id ?? null) as number | null, storeId: (s?.store_id ?? null) as number | null };
  }

  private label = (t: string) => TOPIC_LABELS[t] || t;

  // ------------------------------------------------------------------ the person's own page
  async me(user: any) {
    const w = await this.who(user);
    const week = weekStart();
    const attempts = await this.manager.query(
      `select id, kind, week_start::text as week_start, to_char(finished_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day, score, total, passed
         from kc_attempt where user_id = $1 and finished_on is not null and kind = 'SCORED' order by finished_on desc limit 12`, [user.id]);
    const [current] = await this.manager.query(
      `select id, finished_on is not null as finished, score, total, passed from kc_attempt where user_id = $1 and kind = 'SCORED' and week_start = $2`, [user.id, week]);
    const answers = await this.manager.query(
      `select a.topic, a.correct from kc_answer a join kc_attempt t on t.id = a.attempt_id where t.user_id = $1 and a.answered_on > now() - interval '90 days'`, [user.id]);
    const [practice] = await this.manager.query(`select count(*)::int as n from kc_attempt where user_id = $1 and kind = 'PRACTICE' and finished_on > now() - interval '30 days'`, [user.id]);
    const weeks = await this.manager.query(`select week_start::text as w from kc_attempt where user_id = $1 and kind = 'SCORED' and finished_on is not null`, [user.id]);
    return {
      kind: w.kind, role: w.role, canSeeTeam: w.manager, passPct: PASS_PCT, perCheck: QUESTIONS_PER_CHECK, bank: { version: BANK_META.version, reviewedBy: BANK_META.reviewedBy, size: bankFor(w.kind).length },
      week, thisWeek: current ? { started: true, finished: !!current.finished, attemptId: current.id, score: current.score, total: current.total, passed: current.passed } : { started: false, finished: false },
      streak: streakOf(weeks.map((x: any) => x.w), week), practiceThisMonth: practice.n,
      history: attempts.map((a: any) => ({ id: a.id, week: a.week_start, day: a.day, score: a.score, total: a.total, passed: a.passed })),
      weak: weakTopics(answers).map((t) => ({ topic: t.topic, label: this.label(t.topic), answered: t.answered, missed: t.missed })),
    };
  }

  /** the questions of an attempt as the person sees them: no right answers, the options in this attempt's order, and what is already answered */
  private async present(attemptId: number, userId: number) {
    const [a] = await this.manager.query(`select * from kc_attempt where id = $1 and user_id = $2`, [attemptId, userId]);
    if (!a) throw new NotFoundException('That check was not found.');
    const answered = await this.manager.query(`select question_id, chosen, correct from kc_answer where attempt_id = $1`, [attemptId]);
    const done = new Map<string, { chosen: number; correct: boolean }>(answered.map((r: any) => [r.question_id, { chosen: r.chosen, correct: r.correct }]));
    const orders: Record<string, number[]> = a.option_orders || {};
    const questions = (a.question_ids as string[]).map((id) => {
      const q = byId.get(id) as Question;
      const order = orders[id] || q.options.map((_, i) => i);
      const mine = done.get(id);
      return {
        id, topic: q.topic, topicLabel: this.label(q.topic), text: q.text, options: order.map((i) => q.options[i]),
        answered: !!mine, chosen: mine ? mine.chosen : null,
        // once answered, what was right and why (never before)
        ...(mine ? { correct: mine.correct, answer: order.indexOf(q.answer), explain: q.explain, guide: q.guide } : {}),
      };
    });
    return { attemptId: a.id, kind: a.kind, finished: !!a.finished_on, questions };
  }

  /** starts this week's scored check (or resumes it), or a practice round; a scored check already finished this week is refused */
  async start(user: any, practice: boolean) {
    const w = await this.who(user);
    const week = weekStart();
    if (!practice) {
      const [mine] = await this.manager.query(`select id, finished_on is not null as finished from kc_attempt where user_id = $1 and kind = 'SCORED' and week_start = $2`, [user.id, week]);
      if (mine?.finished) throw new BadRequestException('You have done this week\'s check. Practise as much as you like, or come back on Monday.');
      if (mine) return this.present(mine.id, user.id);
    }
    const bank = bankFor(w.kind);
    const recent = await this.manager.query(
      `select a.question_id from kc_answer a join kc_attempt t on t.id = a.attempt_id where t.user_id = $1 order by a.id desc limit $2`, [user.id, QUESTIONS_PER_CHECK * 3]);
    const picked = pickQuestions(bank, recent.map((r: any) => r.question_id));
    if (!picked.length) throw new BadRequestException('There are no questions for your role yet.');
    const orders: Record<string, number[]> = {};
    for (const q of picked) {
      // the options are shuffled for each attempt: the order is kept so the same attempt always shows the same order
      const sh = shuffleOptions(q);
      orders[q.id] = sh.options.map((o) => q.options.indexOf(o));
    }
    const [a] = await this.manager.query(
      `insert into kc_attempt (user_id, business_id, store_id, kind, week_start, question_ids, option_orders, bank_version) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) returning id`,
      [user.id, w.businessId, w.storeId, practice ? 'PRACTICE' : 'SCORED', week, picked.map((q) => q.id), JSON.stringify(orders), BANK_META.version]);
    return this.present(a.id, user.id);
  }

  /** marks one answer and says at once what was right and why */
  async answer(user: any, attemptId: number, questionId: string, choice: number) {
    const [a] = await this.manager.query(`select id, question_ids, option_orders, finished_on from kc_attempt where id = $1 and user_id = $2`, [attemptId, user.id]);
    if (!a) throw new NotFoundException('That check was not found.');
    if (a.finished_on) throw new BadRequestException('This check is finished.');
    if (!(a.question_ids as string[]).includes(questionId)) throw new BadRequestException('That question is not in this check.');
    const q = byId.get(questionId) as Question;
    const order: number[] = (a.option_orders || {})[questionId] || q.options.map((_, i) => i);
    const picked = Number(choice);
    if (!Number.isInteger(picked) || picked < 0 || picked >= order.length) throw new BadRequestException('Choose one of the options.');
    const correct = order[picked] === q.answer;
    const done = await this.manager.query(
      `insert into kc_answer (attempt_id, question_id, topic, chosen, correct) values ($1, $2, $3, $4, $5) on conflict (attempt_id, question_id) do nothing returning id`, [attemptId, questionId, q.topic, picked, correct]);
    if (!done.length) throw new BadRequestException('You have already answered that question.');
    return { correct, answer: order.indexOf(q.answer), explain: q.explain, guide: q.guide };
  }

  /** closes a check once every question is answered, and gives the result with what to read again */
  async finish(user: any, attemptId: number) {
    const [a] = await this.manager.query(`select id, kind, question_ids, finished_on from kc_attempt where id = $1 and user_id = $2`, [attemptId, user.id]);
    if (!a) throw new NotFoundException('That check was not found.');
    const answers = await this.manager.query(`select question_id, topic, chosen, correct from kc_answer where attempt_id = $1`, [attemptId]);
    if (answers.length < (a.question_ids as string[]).length) throw new BadRequestException('Answer every question first.');
    const score = answers.filter((r: any) => r.correct).length;
    const total = (a.question_ids as string[]).length;
    const ok = passed(score, total);
    if (!a.finished_on) await this.manager.query(`update kc_attempt set finished_on = now(), score = $2, total = $3, passed = $4 where id = $1`, [attemptId, score, total, ok]);
    const missed = answers.filter((r: any) => !r.correct).map((r: any) => {
      const q = byId.get(r.question_id) as Question;
      return { id: q.id, topicLabel: this.label(q.topic), text: q.text, explain: q.explain, guide: q.guide, right: q.options[q.answer] };
    });
    return { attemptId, kind: a.kind, score, total, passed: ok, passPct: PASS_PCT, missed, readAgain: Array.from(new Set(missed.map((m: any) => m.topicLabel))) };
  }

  // ------------------------------------------------------------------ the people who run the store
  /** who has done this week's check, how they have done lately and which topics are weak, for the people in the manager's stores */
  async team(user: any) {
    const w = await this.who(user);
    if (!w.manager || !w.businessId) throw new ForbiddenException('The team results are for the people who run the shop.');
    const week = weekStart();
    const scope = w.owner
      ? `(${BUSINESS_OF_USER_SQL}) = $1`
      : `u.id in (select us2.user_id from user_stores us2 where us2.active and not us2.archive and us2.store_id in (select store_id from user_stores where user_id = $2 and active and not archive))`;
    const people = await this.manager.query(
      `select u.id, u.full_name as name, r.name as role,
              (select a.score || '/' || a.total from kc_attempt a where a.user_id = u.id and a.kind = 'SCORED' and a.finished_on is not null order by a.finished_on desc limit 1) as last_score,
              (select to_char(a.finished_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') from kc_attempt a where a.user_id = u.id and a.kind = 'SCORED' and a.finished_on is not null order by a.finished_on desc limit 1) as last_day,
              (select count(*)::int from kc_attempt a where a.user_id = u.id and a.kind = 'SCORED' and a.finished_on is not null and a.week_start >= $3::date - 49) as weeks_done,
              (select a.passed from kc_attempt a where a.user_id = u.id and a.kind = 'SCORED' and a.week_start = $3::date and a.finished_on is not null) as this_week_passed,
              exists (select 1 from kc_attempt a where a.user_id = u.id and a.kind = 'SCORED' and a.week_start = $3::date and a.finished_on is not null) as this_week_done
         from app_user u join app_role r on r.id = u.role_id
        where u.active and not u.archive and r.name <> 'Site Admin' and ${scope} and $1::int is not distinct from $1::int and $2::int is not distinct from $2::int
        order by u.full_name`, w.owner ? [w.businessId, null, week] : [null, user.id, week]);
    const ids = people.map((p: any) => +p.id);
    const answers = ids.length ? await this.manager.query(
      `select t.user_id, a.topic, a.correct from kc_answer a join kc_attempt t on t.id = a.attempt_id where t.user_id = any($1::int[]) and a.answered_on > now() - interval '90 days'`, [ids]) : [];
    const perUser = new Map<number, { topic: string; correct: boolean }[]>();
    for (const a of answers) { const k = +a.user_id; if (!perUser.has(k)) perUser.set(k, []); perUser.get(k)!.push({ topic: a.topic, correct: a.correct }); }
    return {
      week, passPct: PASS_PCT,
      people: people.map((p: any) => ({
        id: +p.id, name: String(p.name).trim(), role: p.role, doneThisWeek: !!p.this_week_done, passedThisWeek: p.this_week_passed, lastScore: p.last_score, lastDay: p.last_day, weeksDone: p.weeks_done,
        weak: weakTopics(perUser.get(+p.id) || []).slice(0, 2).map((t) => this.label(t.topic)),
      })),
      topics: weakTopics(answers.map((a: any) => ({ topic: a.topic, correct: a.correct }))).map((t) => ({ topic: t.topic, label: this.label(t.topic), answered: t.answered, missed: t.missed })),
    };
  }
}
