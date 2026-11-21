import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";
import { BrandCheckBus } from "./brand-check.bus";

type Step = "card" | "who" | "duration" | "warnings" | "issues" | "result";

/**
 * The Counter guide in the Sales header: pick the problem, who it is for, how long, the card's warning signs, and anything else; then either "see a doctor"
 * (no medicines shown) or the card's options with what is in stock at the store. Built for speed: every choice is a large picture tile, the answers so far stay
 * in view as chips, and any chip can be tapped to change that answer (the advice is then worked out again from the answers already given).
 * Only cards a pharmacist has approved are offered, and prescription-only products are never shown. It helps the person at the counter and the pharmacist:
 * whether to give anything is the pharmacist's decision.
 */
@Component({
  selector: "app-counter-guide",
  template: `
    <button type="button" class="btn btn-sm btn-outline-primary" *ngIf="cards.length" (click)="open()" title="Everyday problems: what to ask, and what we have in stock" data-testid="guide-open">
      <i class="bi bi-clipboard2-pulse"></i> Counter guide
    </button>
    <p-dialog header="Counter guide" [(visible)]="show" [modal]="true" [style]="{width:'46rem', maxWidth:'96vw'}" [contentStyle]="{'min-height':'24rem'}" [draggable]="false" (onHide)="reset()">
      <!-- what has been answered so far: tap one to change it -->
      <div class="mb-2" *ngIf="chips.length" data-testid="guide-chips">
        <div class="d-flex flex-wrap gap-1">
          <button type="button" class="btn btn-sm rounded-pill" *ngFor="let c of chips" [ngClass]="c.step === step ? 'btn-primary' : 'btn-outline-secondary'" (click)="goto(c.step)" [attr.data-testid]="'guide-chip-' + c.step" [title]="'Change: ' + c.text">
            <span class="me-1">{{c.icon}}</span>{{c.text}}
          </button>
        </div>
        <div class="small text-muted mt-1" *ngIf="step === 'result'">Tap an answer above to change it.</div>
      </div>
      <div class="small text-muted mb-2" *ngIf="step !== 'result'" data-testid="guide-progress">{{progress}}</div>
      <div class="alert alert-danger py-1 small" *ngIf="error" data-testid="guide-error">{{error}}</div>

      <!-- 1: the problem -->
      <div *ngIf="step === 'card'" data-testid="guide-step-card">
        <h6>What is the problem?</h6>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn guide-tile" *ngFor="let c of cards" [ngClass]="card?.id === c.id ? 'btn-primary' : 'btn-outline-primary'" (click)="pickCard(c)" data-testid="guide-card">
            <div class="fs-1 lh-1">{{c.icon || '\u{1F48A}'}}</div><div class="small fw-semibold mt-1">{{c.name}}</div><div class="small" *ngIf="c.nameTa">{{c.nameTa}}</div>
          </button>
        </div>
      </div>

      <!-- 2: who -->
      <div *ngIf="step === 'who'" data-testid="guide-step-who">
        <h6>Who is it for?</h6>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn guide-tile" *ngFor="let w of whoChoices" [ngClass]="who === w.key ? 'btn-primary' : 'btn-outline-primary'" (click)="pickWho(w.key)" [attr.data-testid]="'guide-who-' + w.key">
            <div class="fs-1 lh-1">{{w.icon}}</div><div class="small fw-semibold mt-1">{{w.label}}</div>
          </button>
        </div>
      </div>

      <!-- 3: how long -->
      <div *ngIf="step === 'duration'" data-testid="guide-step-duration">
        <h6>How long has it been going on?</h6>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn guide-tile" *ngFor="let d of durationChoices" [ngClass]="duration === d.key ? 'btn-primary' : 'btn-outline-primary'" (click)="pickDuration(d.key)" [attr.data-testid]="'guide-dur-' + d.key">
            <div class="fs-1 lh-1">{{d.icon}}</div><div class="small fw-semibold mt-1">{{d.label}}</div>
          </button>
        </div>
      </div>

      <!-- 4: the card's warning signs -->
      <div *ngIf="step === 'warnings'" data-testid="guide-step-warnings">
        <h6>Is there any of these? <span class="text-muted fw-normal">(tap what applies)</span></h6>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn guide-tile guide-tile-wide" *ngFor="let w of card.warnings" [ngClass]="warned[w.id] ? 'btn-danger' : 'btn-outline-secondary'" (click)="warned[w.id] = !warned[w.id]" [attr.aria-pressed]="!!warned[w.id]" [attr.data-testid]="'guide-warn-' + w.id">
            <div class="fs-2 lh-1">{{w.icon || '⚠️'}}</div><div class="small mt-1">{{w.text}}</div><div class="small" *ngIf="w.textTa">{{w.textTa}}</div>
          </button>
        </div>
        <button type="button" class="btn btn-primary mt-3" (click)="afterWarnings()" data-testid="guide-next-warnings">{{anyWarned ? 'Next' : 'None of these: next'}}</button>
      </div>

      <!-- 5: anything else -->
      <div *ngIf="step === 'issues'" data-testid="guide-step-issues">
        <h6>Anything else? <span class="text-muted fw-normal">(tap what applies)</span></h6>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn guide-tile guide-tile-wide" *ngFor="let i of meta.issues" [ngClass]="issued[i.key] ? 'btn-warning' : 'btn-outline-secondary'" (click)="issued[i.key] = !issued[i.key]" [attr.aria-pressed]="!!issued[i.key]" [attr.data-testid]="'guide-issue-' + i.key">
            <div class="fs-2 lh-1">{{i.icon}}</div><div class="small mt-1">{{i.label}}</div>
          </button>
        </div>
        <button type="button" class="btn btn-primary mt-3" (click)="finishIssues()" [disabled]="busy" data-testid="guide-advise">{{anyIssued ? 'Show what we can give' : 'None of these: show what we can give'}}</button>
      </div>

      <!-- the answer -->
      <div *ngIf="step === 'result' && result" data-testid="guide-result">
        <div *ngIf="result.refer" class="alert alert-danger" data-testid="guide-refer">
          <div class="fw-bold fs-5"><span class="me-1">&#129657;</span>See a doctor</div>
          <ul class="mb-2 mt-1"><li *ngFor="let r of result.reasons">{{r.text}}</li></ul>
          <div>{{result.text}}</div><div class="small" *ngIf="result.textTa">{{result.textTa}}</div>
          <div class="small mt-2">No medicine is shown for this.</div>
        </div>

        <ng-container *ngIf="!result.refer">
          <div class="alert alert-warning py-2 small" *ngIf="result.caution" data-testid="guide-caution">They take other medicines: the pharmacist must check before anything is given.</div>
          <div class="alert alert-info py-2 small" *ngIf="!result.anyInStock" data-testid="guide-nostock">{{result.stockChecked ? 'Nothing for this is in stock here. Ask the pharmacist what to do.' : 'Choose a store to see what is in stock.'}}</div>
          <div class="border rounded p-2 mb-2" *ngFor="let o of result.options" data-testid="guide-option">
            <div class="fw-semibold">{{o.composition}}<span class="text-muted fw-normal small" *ngIf="o.form"> &middot; {{formLabel(o.form)}}</span></div>
            <div class="small" *ngIf="o.guidance">{{o.guidance}}</div><div class="small text-muted" *ngIf="o.guidanceTa">{{o.guidanceTa}}</div>
            <table class="table table-sm small mt-1 mb-0" *ngIf="o.products.length" data-testid="guide-products">
              <tbody><tr *ngFor="let p of o.products" data-testid="guide-product">
                <td>{{p.title}}<span class="text-muted" *ngIf="p.mfr"> &middot; {{p.mfr}}</span><span class="badge bg-warning text-dark ms-1" *ngIf="p.formRelation === 'unknown'" title="Its dosage form is not recorded: check the pack">form not recorded</span>
                  <div class="text-muted">Batch {{p.batch}}<span *ngIf="p.exp_date"> / {{p.exp_date | date:'MMM-yy'}}</span> &middot; {{p.available}} in stock</div></td>
                <td class="text-end text-nowrap">&#8377;{{p.price | number:'1.2-2'}}<div class="text-muted">MRP &#8377;{{p.mrp | number:'1.2-2'}}</div></td>
                <td class="text-end"><button type="button" class="btn btn-sm btn-primary" *ngIf="bus.billOpen" (click)="add(p)" data-testid="guide-add">Add to bill</button></td>
              </tr></tbody>
            </table>
            <div class="small text-muted mt-1" *ngIf="!o.products.length && result.stockChecked" data-testid="guide-option-nostock">Not in stock<span *ngIf="o.notStocked.length">: we know {{names(o.notStocked)}}</span>.</div>
          </div>
          <details class="small mb-2" *ngIf="result.dropped.length"><summary>Left out for these answers ({{result.dropped.length}})</summary>
            <div *ngFor="let d of result.dropped">{{d.composition}}: {{d.because.join('; ')}}</div></details>
          <div class="small text-muted" *ngIf="result.prescriptionOnlyWithheld">{{result.prescriptionOnlyWithheld}} prescription-only product(s) in stock were not shown.</div>
        </ng-container>

        <div class="d-flex gap-2 mt-3 align-items-center">
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="reset()" data-testid="guide-again">Start again</button>
          <span class="small text-muted ms-auto">Card: {{result.card.name}}, version {{result.card.version}}. Not medical advice: the pharmacist decides what to give.</span>
        </div>
      </div>

      <div class="mt-3" *ngIf="step !== 'card' && step !== 'result'"><button type="button" class="btn btn-link btn-sm px-0" (click)="back()" data-testid="guide-back">&larr; Back</button></div>
    </p-dialog>`,
  styles: [`
    .guide-tile { width: 8.5rem; padding: .75rem .4rem; white-space: normal; }
    .guide-tile-wide { width: 10.5rem; }
  `]
})
export class CounterGuideComponent implements OnInit {
  cards: any[] = [];
  meta: any = { durations: [], issues: [] };
  show = false;
  step: Step = "card";
  card: any = null;
  who = "";
  duration = "";
  warned: { [id: number]: boolean } = {};
  issued: { [k: string]: boolean } = {};
  /** the two steps with a "none of these" answer: answered once the person has moved on from them */
  warningsDone = false;
  issuesDone = false;
  result: any = null;
  busy = false;
  error = "";

  readonly whoChoices = [
    { key: "under2", label: "Child under 2", icon: "\u{1F476}" }, { key: "child", label: "Child 2 to 12", icon: "\u{1F9D2}" }, { key: "adult", label: "Adult", icon: "\u{1F9D1}" },
    { key: "over60", label: "Over 60", icon: "\u{1F474}" }, { key: "pregnant", label: "Pregnant or breastfeeding", icon: "\u{1F930}" },
  ];
  readonly durationChoices = [
    { key: "lt2", label: "Less than 2 days", icon: "⏱️" }, { key: "d2_3", label: "2 to 3 days", icon: "\u{1F4C5}" },
    { key: "d4_7", label: "4 to 7 days", icon: "\u{1F5D3}️" }, { key: "gt7", label: "More than a week", icon: "⏳" },
  ];
  private readonly forms: { [k: string]: string } = { tablet: "Tablet", tablet_sr: "Tablet (sustained release)", tablet_dt: "Tablet (dispersible or chewable)", capsule: "Capsule", capsule_sr: "Capsule (sustained release)", syrup: "Syrup or suspension", drops: "Drops", injection: "Injection", topical: "Cream, ointment or gel", powder: "Powder or sachet", inhaler: "Inhaler or spray", other: "Other" };

  constructor(private http: HttpClient, private storeContext: StoreContextService, public bus: BrandCheckBus) {}

  /** the guide is offered only when a pharmacist has approved at least one card */
  ngOnInit() {
    this.http.get<any>(`${environment.apiHost}/counter-guide/cards`).subscribe({
      next: d => { this.cards = d?.cards || []; this.meta = d?.meta || this.meta; },
      error: () => this.cards = [],
    });
  }

  get anyWarned(): boolean { return Object.values(this.warned).some(Boolean); }
  get anyIssued(): boolean { return Object.values(this.issued).some(Boolean); }
  formLabel(k: string) { return this.forms[k] || k; }
  names(list: { title: string }[]) { return list.map(x => x.title).join(", "); }

  private get steps(): Step[] { return this.card?.asksDuration === false ? ["who", "warnings", "issues"] : ["who", "duration", "warnings", "issues"]; }
  get progress(): string {
    if (this.step === "card") return "Step 1";
    const i = this.steps.indexOf(this.step);
    return `Step ${i + 2} of ${this.steps.length + 1}`;
  }

  /** the answers so far, one chip each, in the order they are asked */
  get chips(): { step: Step; icon: string; text: string }[] {
    if (!this.card) return [];
    const out: { step: Step; icon: string; text: string }[] = [{ step: "card", icon: this.card.icon || "\u{1F48A}", text: this.card.name }];
    const w = this.whoChoices.find(x => x.key === this.who);
    if (w) out.push({ step: "who", icon: w.icon, text: w.label });
    const d = this.durationChoices.find(x => x.key === this.duration);
    if (d && this.card.asksDuration !== false) out.push({ step: "duration", icon: d.icon, text: d.label });
    if (this.warningsDone) {
      const n = Object.keys(this.warned).filter(k => this.warned[+k]).length;
      out.push({ step: "warnings", icon: n ? "⚠️" : "✅", text: n ? `${n} warning sign${n > 1 ? "s" : ""}` : "No warning signs" });
    }
    if (this.issuesDone) {
      const picked = (this.meta.issues || []).filter((i: any) => this.issued[i.key]);
      out.push({ step: "issues", icon: picked.length ? "\u{1F48A}" : "✅", text: picked.length ? (picked.length > 2 ? `${picked.length} other things` : picked.map((i: any) => i.label.split(" (")[0]).join(", ")) : "Nothing else" });
    }
    return out;
  }

  open() { this.reset(); this.show = true; }

  reset() {
    this.step = "card"; this.card = null; this.who = ""; this.duration = ""; this.warned = {}; this.issued = {}; this.warningsDone = false; this.issuesDone = false;
    this.result = null; this.error = ""; this.busy = false;
  }

  /** the next question not yet answered, or the advice when everything is: so changing one answer asks only what is still missing */
  private nextStep() {
    this.error = "";
    if (!this.who) { this.step = "who"; return; }
    if (this.card.asksDuration !== false && !this.duration) { this.step = "duration"; return; }
    if (!this.warningsDone) { this.step = "warnings"; return; }
    if (!this.issuesDone) { this.step = "issues"; return; }
    this.advise();
  }

  /** a chip tapped: back to that question, with the other answers kept */
  goto(step: Step) { this.error = ""; this.result = null; this.step = step; }

  pickCard(c: any) {
    if (this.card?.id !== c.id) { this.card = c; this.warned = {}; this.warningsDone = false; if (c.asksDuration === false) this.duration = ""; }
    this.result = null;
    this.nextStep();
  }

  pickWho(w: string) {
    this.who = w;
    this.result = null;
    // a child under 2 or a pregnant woman is always sent to a doctor: no more questions
    if (w === "under2" || w === "pregnant") { this.advise(); return; }
    this.nextStep();
  }

  pickDuration(d: string) { this.duration = d; this.result = null; this.nextStep(); }

  afterWarnings() {
    this.warningsDone = true; this.result = null;
    if (this.anyWarned) { this.advise(); return; }
    this.nextStep();
  }

  finishIssues() { this.issuesDone = true; this.advise(); }

  back() {
    const order: Step[] = ["card", ...this.steps];
    const i = order.indexOf(this.step);
    if (i > 0) this.step = order[i - 1];
  }

  advise() {
    this.error = ""; this.busy = true;
    const warnings = Object.keys(this.warned).filter(k => this.warned[+k]).map(Number);
    const issues = Object.keys(this.issued).filter(k => this.issued[k]);
    this.http.post<any>(`${environment.apiHost}/counter-guide/advise`, {
      cardid: this.card.id, who: this.who, duration: this.duration || undefined, warnings, issues, storeid: this.storeContext.selectedStoreId || null,
    }).subscribe({
      next: r => { this.result = r; this.step = "result"; this.busy = false; },
      error: e => { this.busy = false; const m = e?.error?.message; this.error = Array.isArray(m) ? m.join(" ") : (m || "Could not get the advice."); },
    });
  }

  /** a product chosen for the bill: added to the bill that is open, the same way as from Check brand */
  add(p: any) {
    this.bus.pick$.next({ productid: p.productid });
    this.show = false;
  }
}
