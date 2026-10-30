import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { CHAPTERS, Chapter, GOLDEN_RULES, GUIDE_META, GuideHit, LEARNING_PATH, QUIZ, Question, searchGuide } from "./pharmacy-guide-content";

/**
 * The pharmacy guide (pharmacy pack): Indian retail pharmacy compliance in plain words, and a training guide for new staff. Everyone who works
 * in a pharmacy business may open it. It only displays the content in pharmacy-guide-content.ts and keeps nothing: the quiz is only for the reader.
 */
@Component({
  templateUrl: "./pharmacy-guide.component.html",
  styles: [`
    .guide-nav .nav-link { cursor: pointer; }
    .guide-nav .nav-link.active { font-weight: 600; }
    .sched { border-left: 4px solid var(--bs-secondary); }
    .sched.tone-good { border-left-color: var(--bs-success); }
    .sched.tone-warn { border-left-color: var(--bs-warning); }
    .sched.tone-danger { border-left-color: var(--bs-danger); }
    .path-step { border-left: 3px solid var(--bs-primary); }
    @media print {
      .no-print { display: none !important; }
      .card { border: 0 !important; box-shadow: none !important; }
    }
  `],
})
export class PharmacyGuideComponent implements OnInit, OnDestroy {
  readonly chapters = CHAPTERS;
  readonly rules = GOLDEN_RULES;
  readonly path = LEARNING_PATH;
  readonly meta = GUIDE_META;

  current: Chapter = CHAPTERS[0];
  query = "";
  hits: GuideHit[] = [];
  termFilter = "";

  // the quiz: a shuffled copy, and which answers are showing
  quiz: Question[] = QUIZ.slice();
  shown = new Set<number>();
  private sub?: Subscription;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.sub = this.route.queryParamMap.subscribe((p) => {
      const c = this.chapters.find((x) => x.id === p.get("c"));
      if (c) { this.current = c; this.query = ""; this.hits = []; }
    });
  }
  ngOnDestroy() { this.sub?.unsubscribe(); }

  open(id: string) {
    this.router.navigate([], { relativeTo: this.route, queryParams: { c: id }, queryParamsHandling: "merge" });
    window.scrollTo({ top: 0 });
  }

  chapterTitle(id: string): string { return (this.chapters.find((c) => c.id === id) || { title: id }).title; }

  search() { this.hits = searchGuide(this.query); }
  clearSearch() { this.query = ""; this.hits = []; }

  get terms() {
    const q = this.termFilter.trim().toLowerCase();
    const all = (this.chapters.find((c) => c.id === "concepts")?.terms || []).slice().sort((a, b) => a.term.localeCompare(b.term));
    return q ? all.filter((t) => (t.term + " " + t.meaning).toLowerCase().includes(q)) : all;
  }

  toggle(i: number) { this.shown.has(i) ? this.shown.delete(i) : this.shown.add(i); }
  showAll() { this.quiz.forEach((_, i) => this.shown.add(i)); }
  hideAll() { this.shown.clear(); }
  shuffle() {
    const a = QUIZ.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    this.quiz = a; this.shown.clear();
  }

  print() { window.print(); }
}
