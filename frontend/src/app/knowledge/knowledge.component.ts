import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { KnowledgeService } from "./knowledge.service";

/**
 * The weekly knowledge check: five questions a week (one counted attempt, practice any time), with the right answer and why shown after each answer, and the
 * topics to read again at the end. Kept for coaching, not part of pay or any KPI. The people who run the shop also see who has done it and which topics are weak.
 */
@Component({
  templateUrl: "./knowledge.component.html",
})
export class KnowledgeComponent implements OnInit {
  me: any = null;
  tab: 'week' | 'team' = 'week';
  team: any = null;
  loading = true;
  error = '';
  busy = false;

  /** the check being taken, the question on screen, and the result at the end */
  attempt: any = null;
  index = 0;
  feedback: any = null;
  result: any = null;

  constructor(private service: KnowledgeService, private router: Router) {}

  ngOnInit() { this.load(); }

  private say(e: any, fallback: string): string { const m = e?.error?.message; return (Array.isArray(m) ? m.join(' ') : m) || fallback; }

  load() {
    this.service.me().subscribe((m) => { this.me = m; this.loading = false; }, (e) => { this.loading = false; this.error = this.say(e, 'Could not load your results.'); });
  }

  setTab(t: 'week' | 'team') {
    this.tab = t;
    if (t === 'team' && !this.team) this.service.team().subscribe((r) => this.team = r, (e) => this.error = this.say(e, 'Could not load the team results.'));
  }

  start(practice: boolean) {
    this.error = ''; this.busy = true; this.result = null; this.feedback = null;
    this.service.start(practice).subscribe((a) => {
      this.busy = false; this.attempt = a;
      // resume at the first question not yet answered
      const next = a.questions.findIndex((q: any) => !q.answered);
      this.index = next < 0 ? a.questions.length - 1 : next;
    }, (e) => { this.busy = false; this.error = this.say(e, 'Could not start the check.'); });
  }

  get question(): any { return this.attempt ? this.attempt.questions[this.index] : null; }
  get allAnswered(): boolean { return !!this.attempt && this.attempt.questions.every((q: any) => q.answered); }

  choose(i: number) {
    const q = this.question;
    if (!q || q.answered || this.busy) return;
    this.busy = true; this.error = '';
    this.service.answer(this.attempt.attemptId, q.id, i).subscribe((r) => {
      this.busy = false;
      Object.assign(q, { answered: true, chosen: i, correct: r.correct, answer: r.answer, explain: r.explain, guide: r.guide });
      this.feedback = r;
    }, (e) => { this.busy = false; this.error = this.say(e, 'Could not save that answer.'); });
  }

  next() {
    this.feedback = null;
    if (this.index < this.attempt.questions.length - 1) this.index++;
  }

  finish() {
    this.busy = true;
    this.service.finish(this.attempt.attemptId).subscribe((r) => { this.busy = false; this.result = r; this.attempt = null; this.load(); }, (e) => { this.busy = false; this.error = this.say(e, 'Could not finish the check.'); });
  }

  leave() { this.attempt = null; this.feedback = null; this.result = null; this.load(); }

  read(guide: string) { this.router.navigateByUrl(guide); }

  optionClass(q: any, i: number): string {
    if (!q.answered) return 'btn-outline-secondary';
    if (i === q.answer) return 'btn-success';
    if (i === q.chosen) return 'btn-danger';
    return 'btn-outline-secondary';
  }
}
