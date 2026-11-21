import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";
import { BrandCheckBus } from "./brand-check.bus";

type Step = "card" | "who" | "duration" | "warnings" | "issues" | "result";

/**
 * The Counter guide in the Sales header. Picking the problem goes straight to the medicines in stock, on the usual answers (set under Settings > Counter guide cards: an adult and less than 2 days to begin with), no warning
 * sign, nothing else. Those answers stay in view as chips (marked "assumed" until someone has confirmed them) and any chip can be tapped to change that answer:
 * the advice is then worked out again from the answers already given. A warning sign, a child under 2, pregnancy or a long duration ends in "see a doctor"
 * with no medicines shown. Only cards a pharmacist has approved are offered, and prescription-only products are never shown. The products are real stock at the
 * store (batch, expiry, price) and can be added to the sale invoice: to the bill that is open, or to a new bill when none is. It helps the person at the counter
 * and the pharmacist: whether to give anything is the pharmacist's decision.
 */
@Component({
  selector: "app-counter-guide",
  template: `
    <button type="button" class="btn btn-sm btn-outline-primary" *ngIf="cards.length" (click)="open()" title="Everyday problems: what to ask, and what we have in stock" data-testid="guide-open">
      <i class="bi bi-clipboard2-pulse"></i> Counter guide
    </button>
    <p-dialog header="Counter guide" [(visible)]="show" [modal]="true" [style]="{width:'46rem', maxWidth:'96vw'}" [contentStyle]="{'min-height':'24rem'}" [draggable]="false" (onHide)="reset()">
      <!-- the answers in use: tap one to change it -->
      <div class="mb-2" *ngIf="chips.length" data-testid="guide-chips">
        <div class="d-flex flex-wrap gap-1">
          <button type="button" class="btn btn-sm rounded-pill" *ngFor="let c of chips" [ngClass]="c.step === step ? 'btn-primary' : (c.assumed ? 'btn-outline-secondary' : 'btn-outline-dark')" (click)="goto(c.step)" [attr.data-testid]="'guide-chip-' + c.step" [title]="'Change: ' + c.text">
            <span class="me-1">{{c.icon}}</span>{{c.text}}<small class="ms-1 opacity-75" *ngIf="c.assumed">assumed</small>
          </button>
        </div>
        <div class="small text-muted mt-1" *ngIf="step === 'result'" data-testid="guide-assumed-note">Ask the customer, and tap an answer above if it is not right: the usual answers are used until you do.</div>
      </div>
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

      <!-- who -->
      <div *ngIf="step === 'who'" data-testid="guide-step-who">
        <h6>Who is it for?</h6>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn guide-tile" *ngFor="let w of whoChoices" [ngClass]="who === w.key ? 'btn-primary' : 'btn-outline-primary'" (click)="pickWho(w.key)" [attr.data-testid]="'guide-who-' + w.key">
            <div class="fs-1 lh-1">{{w.icon}}</div><div class="small fw-semibold mt-1">{{w.label}}</div>
          </button>
        </div>
      </div>

      <!-- how long -->
      <div *ngIf="step === 'duration'" data-testid="guide-step-duration">
        <h6>How long has it been going on?</h6>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn guide-tile" *ngFor="let d of durationChoices" [ngClass]="duration === d.key ? 'btn-primary' : 'btn-outline-primary'" (click)="pickDuration(d.key)" [attr.data-testid]="'guide-dur-' + d.key">
            <div class="fs-1 lh-1">{{d.icon}}</div><div class="small fw-semibold mt-1">{{d.label}}</div>
          </button>
        </div>
      </div>

      <!-- the card's warning signs -->
      <div *ngIf="step === 'warnings'" data-testid="guide-step-warnings">
        <h6>Is there any of these? <span class="text-muted fw-normal">(tap what applies)</span></h6>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn guide-tile guide-tile-wide" *ngFor="let w of card.warnings" [ngClass]="warned[w.id] ? 'btn-danger' : 'btn-outline-secondary'" (click)="warned[w.id] = !warned[w.id]" [attr.aria-pressed]="!!warned[w.id]" [attr.data-testid]="'guide-warn-' + w.id">
            <div class="fs-2 lh-1">{{w.icon || '⚠️'}}</div><div class="small mt-1">{{w.text}}</div><div class="small" *ngIf="w.textTa">{{w.textTa}}</div>
          </button>
        </div>
        <button type="button" class="btn btn-primary mt-3" (click)="afterWarnings()" data-testid="guide-next-warnings">{{anyWarned ? 'Show the advice' : 'None of these: show the medicines'}}</button>
      </div>

      <!-- anything else -->
      <div *ngIf="step === 'issues'" data-testid="guide-step-issues">
        <h6>Anything else? <span class="text-muted fw-normal">(tap what applies)</span></h6>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn guide-tile guide-tile-wide" *ngFor="let i of meta.issues" [ngClass]="issued[i.key] ? 'btn-warning' : 'btn-outline-secondary'" (click)="issued[i.key] = !issued[i.key]" [attr.aria-pressed]="!!issued[i.key]" [attr.data-testid]="'guide-issue-' + i.key">
            <div class="fs-2 lh-1">{{i.icon}}</div><div class="small mt-1">{{i.label}}</div>
          </button>
        </div>
        <button type="button" class="btn btn-primary mt-3" (click)="finishIssues()" [disabled]="busy" data-testid="guide-advise">{{anyIssued ? 'Show what we can give' : 'None of these: show the medicines'}}</button>
      </div>

      <div class="small text-muted" *ngIf="busy && step !== 'result'" data-testid="guide-busy">Looking at what is in stock...</div>

      <!-- the answer -->
      <div *ngIf="step === 'result' && result" data-testid="guide-result">
        <div *ngIf="result.refer" class="alert alert-danger" data-testid="guide-refer">
          <div class="fw-bold fs-5"><span class="me-1">&#129657;</span>See a doctor</div>
          <ul class="mb-2 mt-1"><li *ngFor="let r of result.reasons">{{r.text}}</li></ul>
          <div>{{result.text}}</div><div class="small" *ngIf="result.textTa">{{result.textTa}}</div>
          <div class="small mt-2">No medicine is shown for this. If an answer above is not right, tap it to change it.</div>
        </div>

        <ng-container *ngIf="!result.refer">
          <div class="alert alert-warning py-2 small" *ngIf="result.caution" data-testid="guide-caution">They take other medicines: the pharmacist must check before anything is given.</div>
          <div class="alert alert-info py-2 small" *ngIf="!result.anyInStock" data-testid="guide-nostock">{{result.stockChecked ? 'Nothing for this is in stock here. Ask the pharmacist what to do.' : 'Choose a store to see what is in stock.'}}</div>
          <div class="border rounded p-2 mb-2" *ngFor="let o of result.options" data-testid="guide-option">
            <div class="fw-semibold">{{o.composition}}<span class="text-muted fw-normal small" *ngIf="o.form"> &middot; {{formLabel(o.form)}}</span></div>
            <!-- how much, when, and for how many days -->
            <div class="mt-2" *ngIf="o.dose" data-testid="guide-dose">
              <div class="d-flex align-items-stretch gap-1" *ngIf="o.doseSlots; else doseWords" data-testid="guide-dose-slots">
                <div class="text-center border rounded px-2 py-1 flex-fill" *ngFor="let s of o.doseSlots; let i = index" [class.text-muted]="isNone(s.amount)" [class.bg-light]="isNone(s.amount)">
                  <div class="small text-muted">{{slotNames[i]}}</div>
                  <div class="fs-4 fw-bold lh-1">{{s.amount}}</div>
                  <div class="small" *ngIf="s.when"><span class="badge" [ngClass]="s.when === 'bf' ? 'bg-info text-dark' : 'bg-secondary'">{{s.when === 'bf' ? 'before food' : 'after food'}}</span></div>
                </div>
                <div class="text-center border rounded px-2 py-1 bg-light" *ngIf="o.days"><div class="small text-muted">For</div><div class="fs-4 fw-bold lh-1">{{o.days}}</div><div class="small">{{o.days === 1 ? 'day' : 'days'}}</div></div>
              </div>
              <ng-template #doseWords><div class="fw-semibold" data-testid="guide-dose-words">{{o.dose}}<span class="fw-normal text-muted" *ngIf="o.days"> &middot; for {{o.days}} {{o.days === 1 ? 'day' : 'days'}}</span></div></ng-template>
              <div class="small text-muted mt-1" *ngIf="o.doseSlots">bf = before food, af = after food</div>
            </div>
            <div class="small mt-1" *ngIf="o.guidance">{{o.guidance}}</div><div class="small text-muted" *ngIf="o.guidanceTa">{{o.guidanceTa}}</div>
            <!-- the real products in stock, to put on the bill -->
            <div class="mt-2" *ngIf="o.products.length" data-testid="guide-products">
              <div class="d-flex align-items-center gap-2 border rounded p-2 mb-1" *ngFor="let p of o.products" data-testid="guide-product">
                <div class="flex-grow-1">
                  <div class="fw-semibold">{{p.title}}</div>
                  <div class="small text-muted"><span *ngIf="p.mfr">{{p.mfr}} &middot; </span>Batch {{p.batch}}<span *ngIf="p.exp_date"> / {{p.exp_date | date:'MMM-yy'}}</span> &middot; {{p.available}} in stock<span class="badge bg-warning text-dark ms-1" *ngIf="p.formRelation === 'unknown'" title="Its dosage form is not recorded: check the pack">form not recorded</span></div>
                </div>
                <div class="text-end text-nowrap"><div class="fw-semibold">&#8377;{{p.price | number:'1.2-2'}}</div><div class="small text-muted">MRP &#8377;{{p.mrp | number:'1.2-2'}}</div></div>
                <button type="button" class="btn btn-sm" [ngClass]="added[p.productid] ? 'btn-success' : 'btn-primary'" [disabled]="!!added[p.productid]" (click)="add(p)" data-testid="guide-add">
                  <span *ngIf="added[p.productid]">&#10003; Added</span><span *ngIf="!added[p.productid]">{{bus.billOpen ? 'Add to bill' : 'Add to a new bill'}}</span>
                </button>
              </div>
            </div>
            <div class="small text-muted mt-1" *ngIf="!o.products.length && result.stockChecked" data-testid="guide-option-nostock">Not in stock<span *ngIf="o.notStocked.length">: we know {{names(o.notStocked)}}</span>.</div>
          </div>
          <details class="small mb-2" *ngIf="result.dropped.length"><summary>Left out for these answers ({{result.dropped.length}})</summary>
            <div *ngFor="let d of result.dropped">{{d.composition}}: {{d.because.join('; ')}}</div></details>
          <div class="small text-muted" *ngIf="result.prescriptionOnlyWithheld">{{result.prescriptionOnlyWithheld}} prescription-only product(s) in stock were not shown.</div>
        </ng-container>

        <div class="d-flex gap-2 mt-3 align-items-center">
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="reset()" data-testid="guide-again">Another problem</button>
          <button type="button" class="btn btn-success btn-sm" *ngIf="anyAdded" (click)="show = false" data-testid="guide-done">Done: back to the bill</button>
          <span class="small text-muted ms-auto">Card: {{result.card.name}}, version {{result.card.version}}. Not medical advice: the pharmacist decides what to give.</span>
        </div>
      </div>

      <div class="mt-3" *ngIf="step !== 'card' && step !== 'result'"><button type="button" class="btn btn-link btn-sm px-0" (click)="advise()" data-testid="guide-back">&larr; Back to the medicines</button></div>
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
  /** the usual answers are in use until a person has looked at the step: the chip says "assumed" */
  touched = { who: false, duration: false, warnings: false, issues: false };
  result: any = null;
  busy = false;
  error = "";
  /** the products put on the bill from this answer */
  added: { [productid: number]: boolean } = {};

  /** the answers used until someone changes them: the saved ones (an adult and less than 2 days to begin with) for who and how long, no warning sign, nothing else */
  defaults: { who: string; duration: string } = { who: "adult", duration: "lt2" };

  readonly whoChoices = [
    { key: "under2", label: "Child under 2", icon: "\u{1F476}" }, { key: "child", label: "Child 2 to 12", icon: "\u{1F9D2}" }, { key: "adult", label: "Adult", icon: "\u{1F9D1}" },
    { key: "over60", label: "Over 60", icon: "\u{1F474}" }, { key: "pregnant", label: "Pregnant or breastfeeding", icon: "\u{1F930}" },
  ];
  readonly durationChoices = [
    { key: "lt2", label: "Less than 2 days", icon: "⏱️" }, { key: "d2_3", label: "2 to 3 days", icon: "\u{1F4C5}" },
    { key: "d4_7", label: "4 to 7 days", icon: "\u{1F5D3}️" }, { key: "gt7", label: "More than a week", icon: "⏳" },
  ];
  private readonly forms: { [k: string]: string } = { tablet: "Tablet", tablet_sr: "Tablet (sustained release)", tablet_dt: "Tablet (dispersible or chewable)", capsule: "Capsule", capsule_sr: "Capsule (sustained release)", syrup: "Syrup or suspension", drops: "Drops", injection: "Injection", topical: "Cream, ointment or gel", powder: "Powder or sachet", inhaler: "Inhaler or spray", other: "Other" };

  constructor(private http: HttpClient, private storeContext: StoreContextService, public bus: BrandCheckBus, private router: Router) {}

  /** the guide is offered only when a pharmacist has approved at least one card */
  ngOnInit() {
    this.http.get<any>(`${environment.apiHost}/counter-guide/cards`).subscribe({
      next: d => { this.cards = d?.cards || []; this.meta = d?.meta || this.meta; if (d?.defaults) this.defaults = d.defaults; },
      error: () => this.cards = [],
    });
  }

  get anyWarned(): boolean { return Object.values(this.warned).some(Boolean); }
  get anyIssued(): boolean { return Object.values(this.issued).some(Boolean); }
  get anyAdded(): boolean { return Object.values(this.added).some(Boolean); }
  formLabel(k: string) { return this.forms[k] || k; }
  readonly slotNames = ["Morning", "Noon", "Night"];
  /** a part of the day with nothing to take ("0") */
  isNone(amount: string): boolean { return /^0+(\.0+)?(\s|$)/.test(String(amount)); }
  names(list: { title: string }[]) { return list.map(x => x.title).join(", "); }

  /** the answers in use, one chip each, in the order they are asked */
  get chips(): { step: Step; icon: string; text: string; assumed: boolean }[] {
    if (!this.card) return [];
    const out: { step: Step; icon: string; text: string; assumed: boolean }[] = [{ step: "card", icon: this.card.icon || "\u{1F48A}", text: this.card.name, assumed: false }];
    const w = this.whoChoices.find(x => x.key === this.who);
    if (w) out.push({ step: "who", icon: w.icon, text: w.label, assumed: !this.touched.who });
    const d = this.durationChoices.find(x => x.key === this.duration);
    if (d && this.card.asksDuration !== false) out.push({ step: "duration", icon: d.icon, text: d.label, assumed: !this.touched.duration });
    const n = Object.keys(this.warned).filter(k => this.warned[+k]).length;
    out.push({ step: "warnings", icon: n ? "⚠️" : "✅", text: n ? `${n} warning sign${n > 1 ? "s" : ""}` : "No warning signs", assumed: !this.touched.warnings });
    const picked = (this.meta.issues || []).filter((i: any) => this.issued[i.key]);
    out.push({ step: "issues", icon: picked.length ? "\u{1F48A}" : "✅", text: picked.length ? (picked.length > 2 ? `${picked.length} other things` : picked.map((i: any) => i.label.split(" (")[0]).join(", ")) : "Nothing else", assumed: !this.touched.issues });
    return out;
  }

  open() { this.reset(); this.show = true; }

  reset() {
    this.step = "card"; this.card = null; this.who = ""; this.duration = ""; this.warned = {}; this.issued = {};
    this.touched = { who: false, duration: false, warnings: false, issues: false };
    this.result = null; this.error = ""; this.busy = false; this.added = {};
  }

  /** a chip tapped: back to that question, with the other answers kept */
  goto(step: Step) { this.error = ""; this.step = step; }

  /**
   * The problem is chosen and the medicines come at once, on the usual answers (the saved who and how long, no warning sign, nothing else) for whatever has not
   * been answered yet. Changing the problem keeps the person and how long, but the warning signs belong to the card, so those start again.
   */
  pickCard(c: any) {
    if (this.card?.id !== c.id) { this.card = c; this.warned = {}; this.touched.warnings = false; }
    if (!this.who) this.who = this.defaults.who;
    if (c.asksDuration === false) this.duration = "";
    else if (!this.duration) this.duration = this.defaults.duration;
    this.added = {};
    this.advise();
  }

  pickWho(w: string) { this.who = w; this.touched.who = true; this.added = {}; this.advise(); }
  pickDuration(d: string) { this.duration = d; this.touched.duration = true; this.added = {}; this.advise(); }
  afterWarnings() { this.touched.warnings = true; this.added = {}; this.advise(); }
  finishIssues() { this.touched.issues = true; this.added = {}; this.advise(); }

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

  /**
   * A product chosen for the sale invoice. With a bill open it is added there at once and the guide stays open, so more can be added; with no bill open it is
   * queued and a new bill is opened, which takes it as it appears. The batch added is the soonest to expire that is still in date, as for any suggestion.
   */
  add(p: any) {
    if (this.bus.billOpen) {
      this.bus.pick$.next({ productid: p.productid });
      this.added[p.productid] = true;
      return;
    }
    this.bus.queue(p.productid);
    this.show = false;
    this.router.navigate(["/secure/sales/pos/new"]);
  }
}
