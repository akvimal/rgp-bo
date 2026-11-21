import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { AuthService } from "src/app/@core/auth/auth.service";
import { DOSAGE_FORMS } from "../../products/dosage-forms";

/**
 * Settings > Counter guide: the cards behind the Counter guide at the counter. A card is a draft until a pharmacist approves it, and only approved cards reach
 * the counter. Editing an approved card makes a new draft that needs approving again. Writing cards and approving them are separate permissions: the sign-off
 * is the pharmacist's, recorded with their name and the date.
 */
@Component({
  selector: "app-counter-guide-admin",
  template: `
    <div class="page-head"><h1>Counter guide cards</h1></div>
    <p class="text-muted small">Each card is one everyday problem: its warning signs, how long is too long, and the medicines that may be offered. Only <strong>approved</strong> cards are shown at the counter; prescription-only products are never offered whatever a card says. Content here is not medical advice until a pharmacist has approved it.</p>
    <!-- how to write and approve a card: open the first time (no card approved yet), then kept out of the way -->
    <div class="hist-card mb-3" data-testid="cg-help">
      <div class="hist-card-head d-flex align-items-center">
        <span><i class="bi bi-life-preserver me-1"></i>How this works</span>
        <button type="button" class="btn btn-sm btn-link ms-auto py-0" (click)="helpOpen = !helpOpen" [attr.aria-expanded]="helpOpen" data-testid="cg-help-toggle">{{helpOpen ? 'Hide' : 'Show'}}</button>
      </div>
      <div class="hist-card-body small" *ngIf="helpOpen" data-testid="cg-help-body">
        <div class="row g-3">
          <div class="col-lg-6">
            <div class="fw-semibold">1. What a card is</div>
            <p class="mb-2">One everyday problem (a headache, a burn). At the counter, staff pick the problem and answer a few taps: who it is for, how long, any warning signs, anything else. The card decides whether to say <strong>see a doctor</strong> or to show what is in stock that the card allows.</p>

            <div class="fw-semibold">2. Writing a card</div>
            <ul class="mb-2 ps-3">
              <li><strong>Problem and picture.</strong> Plain words the staff use. The picture is an emoji on the tile (paste one; on Windows press Win + .).</li>
              <li><strong>Doctor after (days).</strong> The counter asks "less than 2 days, 2 to 3, 4 to 7, more than a week". If the problem has lasted at least this many days, the guide says see a doctor. With 3: "4 to 7 days" and "more than a week" are sent to a doctor, "2 to 3 days" is not. Turn off <em>Ask how long</em> for a burn or a cut.</li>
              <li><strong>What to say when a doctor is advised.</strong> Shown with the reasons. Keep it short and kind.</li>
              <li><strong>Warning signs.</strong> Any one ticked means a doctor and no medicine is shown. Write each as the customer would say it. At least two.</li>
              <li><strong>Options.</strong> Write the composition with its strength the way the brand dictionary does: <em>Paracetamol 500 mg</em>, or for a combination <em>Amoxicillin 500 mg + Clavulanic acid 125 mg</em>. Pick the form, who it is for (child 2 to 12, adult, over 60) and what it must <em>not</em> be given with. Options are shown in the order listed.</li>
              <li><strong>Dose and days.</strong> Every option needs both. Write the dose as <em>morning - noon - night</em>: <em>1 (bf) - 0 - 1 (af)</em> is one in the morning before food, none at noon, one at night after food (<em>bf</em> before food, <em>af</em> after food). Add a unit where it is not a tablet: <em>5 ml - 5 ml - 5 ml (af)</em>. A dose that is not three times a day is written in words, for example <em>A thin layer 2 times a day</em>. The counter shows it as three boxes with the number of days.</li>
              <li><strong>Guidance.</strong> What to watch for and how to take it, in your words (for example "not more than 4 tablets in a day").</li>
              <li><strong>The product count</strong> beside an option is how many products in the catalogue carry that composition and form. <span class="text-warning-emphasis">Zero</span> means the shop writes it differently or does not carry it: fix the option, or fill the product's composition (Products &gt; Compositions).</li>
            </ul>
          </div>
          <div class="col-lg-6">
            <div class="fw-semibold">3. Draft, approve, retire</div>
            <ul class="mb-2 ps-3">
              <li>A new or edited card is a <span class="badge bg-warning text-dark">Draft</span>: the counter does not see it.</li>
              <li>The <strong>pharmacist</strong> reads the whole card, ticks that they have, and presses <strong>Approve</strong>. It then shows at the counter with their name and the date.</li>
              <li>Changing an approved card makes a new draft that must be approved again; the card leaves the counter until then.</li>
              <li><strong>Retire</strong> takes a card off the counter and keeps it. <strong>Delete</strong> works on drafts and retired cards only.</li>
            </ul>

            <div class="fw-semibold">4. Before you approve: check that</div>
            <ul class="mb-2 ps-3">
              <li>every warning sign you would send to a doctor for is there;</li>
              <li>each option is right for each group ticked, and its "do not give with" list is complete;</li>
              <li>no option is something that needs a prescription (these are never shown, but the card should not rely on that);</li>
              <li>the "doctor after" days are right for this problem;</li>
              <li>the wording is clear, and the Tamil text is added where staff need it.</li>
            </ul>

            <div class="fw-semibold">5. What the guide always does</div>
            <ul class="mb-0 ps-3">
              <li>A child under 2, or a pregnant or breastfeeding woman, is always sent to a doctor or the pharmacist.</li>
              <li>Prescription-only products (Schedule H, H1, X) are never offered, whatever a card says.</li>
              <li>It never decides alone: it is not medical advice, and the pharmacist decides what is given.</li>
              <li>The starter cards were written without a clinician. Read and edit each one before approving it.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="error" class="alert alert-danger py-2" data-testid="cg-error"><div *ngFor="let e of errors">{{e}}</div><div *ngIf="!errors.length">{{error}}</div></div>
    <div *ngIf="message" class="alert alert-success py-2" data-testid="cg-message">{{message}}</div>

    <div class="row g-3">
      <div class="col-lg-4">
        <div class="hist-card">
          <div class="hist-card-head d-flex align-items-center">Cards <span class="ms-auto small text-muted">{{cards.length}}</span></div>
          <div class="list-group list-group-flush" data-testid="cg-list">
            <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2" *ngFor="let c of cards" [class.active]="form?.id === c.id" (click)="open(c)" data-testid="cg-card">
              <span class="flex-grow-1">{{c.name}}<div class="small" [class.text-muted]="form?.id !== c.id">v{{c.version}}<span *ngIf="c.status === 'APPROVED'"> &middot; approved by {{c.approvedName}}, {{c.approvedOn | date:'dd MMM yyyy'}}</span></div></span>
              <span class="badge" [ngClass]="c.status === 'APPROVED' ? 'bg-success' : c.status === 'RETIRED' ? 'bg-secondary' : 'bg-warning text-dark'" data-testid="cg-status">{{c.status === 'APPROVED' ? 'Approved' : c.status === 'RETIRED' ? 'Retired' : 'Draft'}}</span>
            </button>
            <div class="list-group-item text-muted small" *ngIf="!cards.length && loaded">No cards yet.</div>
          </div>
          <div class="hist-card-body d-flex flex-wrap gap-2" *ngIf="canManage">
            <button type="button" class="btn btn-sm btn-primary" (click)="newCard()" data-testid="cg-new">New card</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="seed()" [disabled]="busy" data-testid="cg-seed" title="Adds any starter card that is missing, as a draft, and gives pictures to starter cards that have none">Add the starter cards (drafts)</button>
          </div>
        </div>
      </div>

      <div class="col-lg-8">
        <div class="hist-empty" *ngIf="!form"><i class="bi bi-card-checklist"></i>Choose a card, or start a new one.</div>
        <div class="hist-card" *ngIf="form" data-testid="cg-editor">
          <div class="hist-card-head d-flex align-items-center gap-2">
            <span>{{form.id ? 'Edit card' : 'New card'}}</span>
            <span class="badge bg-warning text-dark" *ngIf="status === 'DRAFT'">Draft: not shown at the counter</span>
            <span class="badge bg-success" *ngIf="status === 'APPROVED'">Approved: saving changes makes a new draft</span>
          </div>
          <div class="hist-card-body">
            <div class="row g-2">
              <div class="col-md-2"><label class="form-label small mb-0">Picture</label><input class="form-control form-control-sm fs-5 text-center" maxlength="16" [(ngModel)]="form.icon" [disabled]="!canManage" placeholder="&#128512;" title="Paste or type an emoji (on Windows: Win + .)" data-testid="cg-icon"></div>
              <div class="col-md-5"><label class="form-label small mb-0">Problem</label><input class="form-control form-control-sm" maxlength="120" [(ngModel)]="form.name" [disabled]="!canManage" data-testid="cg-name"></div>
              <div class="col-md-5"><label class="form-label small mb-0">Name in Tamil (optional)</label><input class="form-control form-control-sm" maxlength="160" [(ngModel)]="form.nameTa" [disabled]="!canManage"></div>
              <div class="col-md-3"><label class="form-label small mb-0">Key</label><input class="form-control form-control-sm" maxlength="40" [(ngModel)]="form.key" [disabled]="!canManage || !!form.id" data-testid="cg-key"></div>
              <div class="col-md-3"><label class="form-label small mb-0">Doctor after (days)</label><input type="number" min="1" max="30" class="form-control form-control-sm" [(ngModel)]="form.durationLimitDays" [disabled]="!canManage" data-testid="cg-limit"></div>
              <div class="col-md-3 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" id="cg-asks" [(ngModel)]="form.asksDuration" [disabled]="!canManage"><label class="form-check-label small" for="cg-asks">Ask how long</label></div></div>
              <div class="col-md-3"><label class="form-label small mb-0">Order</label><input type="number" class="form-control form-control-sm" [(ngModel)]="form.sortOrder" [disabled]="!canManage"></div>
              <div class="col-12"><label class="form-label small mb-0">What to say when a doctor is advised</label><textarea rows="2" class="form-control form-control-sm" maxlength="600" [(ngModel)]="form.referralText" [disabled]="!canManage" data-testid="cg-referral"></textarea></div>
              <div class="col-12"><label class="form-label small mb-0">The same in Tamil (optional)</label><textarea rows="2" class="form-control form-control-sm" maxlength="800" [(ngModel)]="form.referralTextTa" [disabled]="!canManage"></textarea></div>
            </div>

            <h6 class="mt-3 mb-1">Warning signs <span class="small text-muted fw-normal">(any one means a doctor: at least two)</span></h6>
            <div class="d-flex gap-2 mb-1" *ngFor="let w of form.warnings; let i = index" data-testid="cg-warning">
              <input class="form-control form-control-sm text-center" style="width:3.6rem; flex:none" maxlength="16" [(ngModel)]="w.icon" [disabled]="!canManage" placeholder="&#9888;" title="A picture for this sign (an emoji)">
              <input class="form-control form-control-sm" maxlength="300" [(ngModel)]="w.text" [disabled]="!canManage" placeholder="In plain words">
              <input class="form-control form-control-sm" maxlength="400" [(ngModel)]="w.textTa" [disabled]="!canManage" placeholder="Tamil (optional)">
              <button type="button" class="btn btn-sm btn-outline-danger" (click)="form.warnings.splice(i, 1)" *ngIf="canManage" aria-label="Remove this warning sign">&times;</button>
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="form.warnings.push({text: '', textTa: '', icon: ''})" *ngIf="canManage" data-testid="cg-add-warning">Add a warning sign</button>

            <h6 class="mt-3 mb-1">Options <span class="small text-muted fw-normal">(in the order they are offered; matched to stock by composition and form)</span></h6>
            <div class="border rounded p-2 mb-2" *ngFor="let o of form.options; let i = index" data-testid="cg-option">
              <div class="row g-2">
                <div class="col-md-6"><label class="form-label small mb-0">Composition with strength</label><input class="form-control form-control-sm" maxlength="300" [(ngModel)]="o.composition" [disabled]="!canManage" placeholder="Paracetamol 500 mg" data-testid="cg-opt-composition"></div>
                <div class="col-md-4"><label class="form-label small mb-0">Form</label>
                  <select class="form-select form-select-sm" [(ngModel)]="o.form" [disabled]="!canManage"><option [ngValue]="null">Any form</option><option *ngFor="let f of forms" [ngValue]="f.key">{{f.label}}</option></select></div>
                <div class="col-md-2 d-flex align-items-end"><span class="badge" [ngClass]="o.products ? 'bg-success' : 'bg-warning text-dark'" [title]="'Products in the catalogue with this composition and form'" data-testid="cg-opt-count">{{o.products || 0}} product(s)</span></div>
                <div class="col-12"><span class="small me-2">For:</span>
                  <label class="me-3 small" *ngFor="let a of audiences"><input type="checkbox" [checked]="has(o.audiences, a)" (change)="toggle(o.audiences, a)" [disabled]="!canManage"> {{audienceLabel(a)}}</label></div>
                <div class="col-12"><span class="small me-2">Do not give with:</span>
                  <label class="me-3 small d-inline-block" *ngFor="let x of issues"><input type="checkbox" [checked]="has(o.excludes, x.key)" (change)="toggle(o.excludes, x.key)" [disabled]="!canManage"> {{x.label}}</label></div>
                <div class="col-md-5"><label class="form-label small mb-0">Dose: morning - noon - night</label><input class="form-control form-control-sm" maxlength="120" [(ngModel)]="o.dose" [disabled]="!canManage" placeholder="1 (bf) - 0 - 1 (af)" data-testid="cg-opt-dose"></div>
                <div class="col-md-2"><label class="form-label small mb-0">For (days)</label><input type="number" min="1" max="30" class="form-control form-control-sm" [(ngModel)]="o.days" [disabled]="!canManage" data-testid="cg-opt-days"></div>
                <div class="col-md-5 small text-muted align-self-end">bf = before food, af = after food. A dose that is not three times of day is written in words: "A thin layer 2 times a day".</div>
                <div class="col-md-6"><label class="form-label small mb-0">Guidance (what to watch for, how to take it)</label><textarea rows="2" class="form-control form-control-sm" maxlength="600" [(ngModel)]="o.guidance" [disabled]="!canManage"></textarea></div>
                <div class="col-md-6"><label class="form-label small mb-0">Guidance in Tamil (optional)</label><textarea rows="2" class="form-control form-control-sm" maxlength="800" [(ngModel)]="o.guidanceTa" [disabled]="!canManage"></textarea></div>
              </div>
              <button type="button" class="btn btn-sm btn-link text-danger px-0" (click)="form.options.splice(i, 1)" *ngIf="canManage">Remove this option</button>
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="addOption()" *ngIf="canManage" data-testid="cg-add-option">Add an option</button>

            <div class="d-flex flex-wrap align-items-center gap-2 mt-3 pt-2 border-top">
              <button type="button" class="btn btn-primary" (click)="save()" [disabled]="busy || !dirty" *ngIf="canManage" data-testid="cg-save">Save{{status === 'APPROVED' ? ' as a new draft' : ''}}</button>
              <button type="button" class="btn btn-outline-secondary" (click)="retire()" *ngIf="canManage && form.id && status !== 'RETIRED'" [disabled]="busy" data-testid="cg-retire">Retire</button>
              <button type="button" class="btn btn-outline-danger" (click)="remove()" *ngIf="canManage && form.id && status !== 'APPROVED'" [disabled]="busy" data-testid="cg-delete">Delete</button>
              <span class="small text-muted" *ngIf="dirty">There are changes not saved yet.</span>
            </div>

            <!-- the pharmacist's sign-off -->
            <div class="alert alert-warning mt-3 mb-0" *ngIf="form.id && status === 'DRAFT' && canApprove" data-testid="cg-approve-box">
              <div class="fw-semibold">Pharmacist's sign-off</div>
              <div class="small">Read the whole card: the warning signs, how long, and every option with who it is for and what it must not be given with. Approving puts it in front of the counter staff under your name.</div>
              <div class="form-check mt-2"><input class="form-check-input" type="checkbox" id="cg-confirm" [(ngModel)]="confirmApprove" [disabled]="dirty"><label class="form-check-label small" for="cg-confirm">I have read this card and approve it for use at the counter.</label></div>
              <button type="button" class="btn btn-success btn-sm mt-2" (click)="approve()" [disabled]="busy || dirty || !confirmApprove" data-testid="cg-approve">Approve</button>
              <span class="small ms-2" *ngIf="dirty">Save your changes first.</span>
            </div>
            <div class="small text-muted mt-3" *ngIf="form.id && status === 'DRAFT' && !canApprove">This card needs a pharmacist's approval before it appears at the counter.</div>
            <div class="small mt-3" *ngIf="status === 'APPROVED'">Approved by <strong>{{approvedBy}}</strong> on {{approvedOn | date:'dd MMM yyyy'}} (version {{version}}).</div>
          </div>
        </div>
      </div>
    </div>`
})
export class CounterGuideAdminComponent implements OnInit {
  private readonly api = `${environment.apiHost}/counter-guide/admin`;
  cards: any[] = [];
  meta: any = { audiences: ["child", "adult", "over60"], issues: [] };
  forms = DOSAGE_FORMS;
  form: any = null;
  private snapshot = "";
  loaded = false;
  busy = false;
  error = "";
  errors: string[] = [];
  message = "";
  confirmApprove = false;
  canManage = false;
  canApprove = false;

  constructor(private http: HttpClient, auth: AuthService) {
    this.canManage = auth.isActionAuthorized("counterguide.manage");
    this.canApprove = auth.isActionAuthorized("counterguide.approve");
  }

  get audiences(): string[] { return this.meta.audiences; }
  get issues(): { key: string; label: string }[] { return this.meta.issues; }
  get dirty(): boolean { return !!this.form && JSON.stringify(this.form) !== this.snapshot; }
  private get current(): any { return this.cards.find(c => c.id === this.form?.id) || null; }
  get status(): string { return this.current?.status || "DRAFT"; }
  get version(): number { return this.current?.version || 1; }
  get approvedBy(): string { return this.current?.approvedName || ""; }
  get approvedOn(): any { return this.current?.approvedOn; }

  audienceLabel(a: string) { return a === "child" ? "Child 2 to 12" : a === "adult" ? "Adult" : "Over 60"; }
  has(list: string[], k: string) { return (list || []).includes(k); }
  toggle(list: string[], k: string) { const i = list.indexOf(k); if (i >= 0) list.splice(i, 1); else list.push(k); }

  ngOnInit() { this.load(); }

  private fail(e: any, fallback: string) {
    this.busy = false;
    const m = e?.error?.message;
    this.errors = Array.isArray(m) ? m : [];
    this.error = Array.isArray(m) ? "The card cannot be saved yet:" : (m || fallback);
  }
  private clear() { this.error = ""; this.errors = []; this.message = ""; }

  /** the helper is open the first time (nothing approved yet) and kept out of the way once cards are in use */
  helpOpen = false;

  private take(d: any) {
    if (!this.loaded) this.helpOpen = !(d.cards || []).some((c: any) => c.status === "APPROVED");
    this.cards = d.cards || []; this.meta = d.meta || this.meta; this.loaded = true; }

  load() {
    this.http.get<any>(`${this.api}/cards`).subscribe(d => this.take(d), e => { this.loaded = true; this.fail(e, "Could not load the cards."); });
  }

  /** a working copy of a card, so edits are not live until saved */
  private copy(c: any) {
    return {
      id: c.id, key: c.key, name: c.name, nameTa: c.nameTa || "", icon: c.icon || "", asksDuration: c.asksDuration !== false, durationLimitDays: c.durationLimitDays, sortOrder: c.sortOrder,
      referralText: c.referralText, referralTextTa: c.referralTextTa || "",
      warnings: (c.warnings || []).map((w: any) => ({ text: w.text, textTa: w.textTa || "", icon: w.icon || "" })),
      options: (c.options || []).map((o: any) => ({ composition: o.composition, form: o.form || null, audiences: [...o.audiences], excludes: [...o.excludes], dose: o.dose || "", days: o.days || null, guidance: o.guidance || "", guidanceTa: o.guidanceTa || "", products: o.products })),
    };
  }
  private show(f: any) { this.form = f; this.snapshot = JSON.stringify(f); this.confirmApprove = false; }

  open(c: any) { this.clear(); this.show(this.copy(c)); }

  newCard() {
    this.clear();
    this.show({ id: null, key: "", name: "", nameTa: "", icon: "", asksDuration: true, durationLimitDays: 3, sortOrder: 100, referralText: "Please see a doctor, or the pharmacist on duty, for this. Medicines are not given from the counter for it.", referralTextTa: "",
      warnings: [{ text: "", textTa: "", icon: "" }, { text: "", textTa: "", icon: "" }], options: [] });
  }

  addOption() { this.form.options.push({ composition: "", form: null, audiences: ["adult"], excludes: [], dose: "", days: 3, guidance: "", guidanceTa: "", products: 0 }); }

  private body() { const { id, ...rest } = this.form; return { ...rest, options: rest.options.map((o: any) => ({ ...o, products: undefined })) }; }

  save() {
    this.clear(); this.busy = true;
    const req = this.form.id ? this.http.put<any>(`${this.api}/cards/${this.form.id}`, this.body()) : this.http.post<any>(`${this.api}/cards`, this.body());
    req.subscribe(d => {
      this.busy = false; this.take(d);
      const saved = this.cards.find(c => c.key === String(this.form.key).trim().toLowerCase());
      if (saved) this.show(this.copy(saved));
      this.message = "Saved as a draft. A pharmacist approves it before it appears at the counter.";
    }, e => this.fail(e, "Could not save the card."));
  }

  approve() {
    this.clear(); this.busy = true;
    this.http.post<any>(`${this.api}/cards/${this.form.id}/approve`, { version: this.version }).subscribe(d => {
      this.busy = false; this.take(d); const c = this.cards.find(x => x.id === this.form.id); if (c) this.show(this.copy(c));
      this.message = "Approved. It now appears at the counter.";
    }, e => this.fail(e, "Could not approve the card."));
  }

  retire() {
    if (!window.confirm(`Retire "${this.form.name}"? It stops appearing at the counter.`)) return;
    this.clear(); this.busy = true;
    this.http.post<any>(`${this.api}/cards/${this.form.id}/retire`, {}).subscribe(d => {
      this.busy = false; this.take(d); const c = this.cards.find(x => x.id === this.form.id); if (c) this.show(this.copy(c));
      this.message = "Retired.";
    }, e => this.fail(e, "Could not retire the card."));
  }

  remove() {
    if (!window.confirm(`Delete "${this.form.name}"? This cannot be undone.`)) return;
    this.clear(); this.busy = true;
    this.http.delete<any>(`${this.api}/cards/${this.form.id}`).subscribe(d => { this.busy = false; this.take(d); this.form = null; this.message = "Deleted."; }, e => this.fail(e, "Could not delete the card."));
  }

  seed() {
    this.clear(); this.busy = true;
    this.http.post<any>(`${this.api}/seed`, {}).subscribe(d => {
      this.busy = false; this.take(d);
      this.message = (d.added ? `Added ${d.added} starter cards as drafts. They are a starting point: a pharmacist reviews and edits each one before approving it. ` : "The starter cards are already there. ")
        + (d.pictures ? `Gave pictures to ${d.pictures} cards that had none (their approval is unchanged).` : "");
      if (this.form?.id) { const c = this.cards.find(x => x.id === this.form.id); if (c && !this.dirty) this.show(this.copy(c)); }
    }, e => this.fail(e, "Could not add the starter cards."));
  }
}
