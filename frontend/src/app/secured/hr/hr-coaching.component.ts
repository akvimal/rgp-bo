import { Component, OnInit } from "@angular/core";
import { InsightsService } from "src/app/shared/insights.service";

/**
 * HR > Coaching: for one person and month, the figures (KPI, attendance, sales served) and a note a manager can talk through with them: what went well,
 * where to focus, a tip for each and what to say. The assistant (or plain words from the figures) writes the first version; the manager edits it, and the
 * person sees it only when the manager shares it.
 */
@Component({
  selector: "app-hr-coaching",
  template: `
    <div class="form-compact">
      <div class="card"><div class="card-body">
        <div class="d-flex flex-wrap align-items-end gap-2 mt-2">
          <h5 class="card-title m-0 p-0">Coaching notes</h5>
          <div class="ms-auto d-flex align-items-center gap-2">
            <label class="small mb-0" for="co-month">Month</label>
            <input id="co-month" type="month" class="form-control form-control-sm w-auto" [(ngModel)]="period" (ngModelChange)="load()" data-testid="co-month">
          </div>
        </div>
        <div class="small text-muted mb-2">A note to talk through with each person: what went well, one or two things to work on, and a small tip for each. Nothing is shown to the person until you share it. No names or pay figures are sent to the assistant.</div>
        <div class="small text-danger" *ngIf="error" data-testid="co-error">{{error}}</div>

        <div class="row g-3">
          <div class="col-lg-4">
            <div class="list-group" data-testid="co-people">
              <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2" *ngFor="let p of people" [class.active]="current && current.employee.id === p.id" (click)="open(p.id)" [attr.data-testid]="'co-person-' + p.id">
                <span class="flex-grow-1">{{p.name}}<span class="small d-block opacity-75">{{p.role || 'Staff'}}</span></span>
                <span class="small" *ngIf="p.percent !== null">{{p.percent}}%</span>
                <span class="badge bg-success" *ngIf="p.shared" title="Shared with the person">Shared</span>
                <span class="badge bg-secondary" *ngIf="p.has_note && !p.shared" title="Written, not shared">Draft</span>
              </button>
              <div class="list-group-item text-muted small" *ngIf="loaded && !people.length">No staff on payroll to coach.</div>
            </div>
          </div>

          <div class="col-lg-8">
            <div *ngIf="!current" class="text-muted small" data-testid="co-pick">Choose a person on the left.</div>
            <div *ngIf="current" data-testid="co-detail">
              <h6 class="mb-1">{{current.employee.name}} <span class="small text-muted fw-normal">{{current.employee.role}} · {{current.period}}</span></h6>
              <div class="row g-2 mb-2" data-testid="co-facts">
                <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="small text-muted">KPI</div><div class="fw-bold">{{current.facts.kpi ? current.facts.kpi.percent + '%' : '-'}}</div><div class="small text-muted" *ngIf="current.facts.kpi && current.facts.kpi.prevPercent !== null">before {{current.facts.kpi.prevPercent}}%<span *ngIf="current.facts.kpi.teamAvg !== null"> · team {{current.facts.kpi.teamAvg}}%</span></div></div></div>
                <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="small text-muted">Days present</div><div class="fw-bold">{{current.facts.attendance.present}}</div><div class="small text-muted">{{current.facts.attendance.late}} late, {{current.facts.attendance.earlyOut}} early out</div></div></div>
                <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="small text-muted">Bills served</div><div class="fw-bold">{{current.facts.sales ? current.facts.sales.bills : '-'}}</div><div class="small text-muted" *ngIf="current.facts.sales">before {{current.facts.sales.prevBills}}</div></div></div>
                <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="small text-muted">Leave taken</div><div class="fw-bold">{{current.facts.leaveDays}} day{{current.facts.leaveDays === 1 ? '' : 's'}}</div></div></div>
              </div>

              <div *ngIf="!current.note" class="alert alert-light border small py-2" data-testid="co-nonote">No note yet for this month.</div>
              <div class="d-flex flex-wrap gap-2 mb-2">
                <button type="button" class="btn btn-sm btn-primary" (click)="draft()" [disabled]="busy" data-testid="co-draft">{{busy ? 'Working...' : current.note ? 'Write it again' : 'Write the note'}}</button>
                <span class="small text-muted align-self-center" *ngIf="current.note">{{sourceText(current.note.source)}}. Writing it again replaces what is here and stops sharing it.</span>
              </div>

              <div *ngIf="current.note" data-testid="co-note">
                <div class="mb-2"><label class="form-label small fw-semibold mb-0" for="co-strengths">What went well <span class="fw-normal text-muted">(one point on each line)</span></label>
                  <textarea id="co-strengths" class="form-control form-control-sm" rows="3" [(ngModel)]="edit.strengths" data-testid="co-strengths"></textarea></div>
                <div class="mb-2"><label class="form-label small fw-semibold mb-0" for="co-focus">Where to focus</label>
                  <textarea id="co-focus" class="form-control form-control-sm" rows="3" [(ngModel)]="edit.focus" data-testid="co-focus"></textarea></div>
                <div class="mb-2"><label class="form-label small fw-semibold mb-0" for="co-tips">Something to try</label>
                  <textarea id="co-tips" class="form-control form-control-sm" rows="3" [(ngModel)]="edit.tips" data-testid="co-tips"></textarea></div>
                <div class="mb-2"><label class="form-label small fw-semibold mb-0" for="co-talk">For you to say in the conversation <span class="fw-normal text-muted">(only you see this)</span></label>
                  <textarea id="co-talk" class="form-control form-control-sm" rows="3" [(ngModel)]="edit.talk" data-testid="co-talk"></textarea></div>
                <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="co-share" [(ngModel)]="edit.shared" data-testid="co-share"><label class="form-check-label small" for="co-share">Share the first three parts with {{current.employee.name}} (they see them under My KPI)</label></div>
                <button type="button" class="btn btn-sm btn-primary" (click)="save()" [disabled]="busy" data-testid="co-save">Save</button>
                <span class="small text-success ms-2" *ngIf="message" data-testid="co-message">{{message}}</span>
              </div>
            </div>
          </div>
        </div>
      </div></div>
    </div>`,
})
export class HrCoachingComponent implements OnInit {
  period = "";
  people: any[] = [];
  loaded = false;
  current: any = null;
  edit: any = { strengths: "", focus: "", tips: "", talk: "", shared: false };
  busy = false;
  error = "";
  message = "";

  constructor(private insights: InsightsService) {}

  ngOnInit() { this.load(); }

  private msg(e: any, fallback: string) { const m = e?.error?.message; return Array.isArray(m) ? m.join(" ") : (m || fallback); }
  sourceText(s: string) { return s === "assistant" ? "Written by the assistant" : s === "edited" ? "Written by the assistant and edited" : "Written in plain words from the figures"; }

  load() {
    this.error = ""; this.message = "";
    this.insights.coachingPeople(this.period || undefined).subscribe((d) => {
      this.people = d.people; this.period = d.period; this.loaded = true;
      if (this.current) this.open(this.current.employee.id);
    }, (e) => { this.loaded = true; this.error = this.msg(e, "Coaching notes are for the Business Head and Store Heads."); });
  }

  private take(d: any) {
    this.current = d;
    const n = d.note;
    this.edit = n ? { strengths: n.strengths.join("\n"), focus: n.focus.join("\n"), tips: n.tips.join("\n"), talk: n.talk_points.join("\n"), shared: !!n.shared } : { strengths: "", focus: "", tips: "", talk: "", shared: false };
  }

  open(id: number) {
    this.message = ""; this.error = "";
    this.insights.coaching(id, this.period).subscribe((d) => this.take(d), (e) => (this.error = this.msg(e, "That person could not be opened.")));
  }

  draft() {
    this.busy = true; this.message = ""; this.error = "";
    this.insights.draftCoaching(this.current.employee.id, this.period).subscribe((d) => { this.busy = false; this.take(d); this.refreshList(); this.message = "The note is written. Read it, change what you like, and press Save."; },
      (e) => { this.busy = false; this.error = this.msg(e, "The note could not be written."); });
  }

  private lines(s: string) { return (s || "").split("\n").map((x) => x.trim()).filter(Boolean); }

  save() {
    this.busy = true; this.message = ""; this.error = "";
    this.insights.saveCoaching(this.current.employee.id, { period: this.period, strengths: this.lines(this.edit.strengths), focus: this.lines(this.edit.focus), tips: this.lines(this.edit.tips), talk_points: this.lines(this.edit.talk), shared: !!this.edit.shared }).subscribe(
      (n) => { this.busy = false; this.current = { ...this.current, note: n }; this.message = n.shared ? "Saved and shared." : "Saved. Not shared."; this.refreshList(); },
      (e) => { this.busy = false; this.error = this.msg(e, "The note could not be saved."); });
  }

  private refreshList() {
    this.insights.coachingPeople(this.period).subscribe((d) => (this.people = d.people));
  }
}
