import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import { OperatorContextService } from "src/app/@core/operator-context.service";
import { FileUploadService } from "../documents/file-upload.service";
import { MenuAccess } from "../menu";
import { areaForUrl, areasFor, FeedbackArea, SOMETHING_ELSE } from "./feedback-areas";
import { FeedbackDialogService, FeedbackService } from "./feedback.service";

export const KIND_CHOICES = [
  { key: 'problem', label: 'Something is wrong', icon: 'bi-bug' },
  { key: 'question', label: 'I have a question', icon: 'bi-question-circle' },
  { key: 'suggestion', label: 'Suggest a feature', icon: 'bi-lightbulb' },
  { key: 'data', label: 'Wrong data', icon: 'bi-exclamation-diamond' },
];

/**
 * The report form, opened from the floating quick-actions button over whatever screen the person is on. The module is chosen for them from that screen
 * (the guide's page whose address matches), the feature from that page's tasks. Sent to /feedback; the answer is read under Help and feedback.
 */
@Component({
  selector: 'app-feedback-dialog',
  templateUrl: './feedback-dialog.component.html'
})
export class FeedbackDialogComponent implements OnInit, OnDestroy {
  @Input() access!: MenuAccess;

  visible = false;
  kinds = KIND_CHOICES;
  somethingElse = SOMETHING_ELSE;
  areas: FeedbackArea[] = [];
  groups: { group: string; areas: FeedbackArea[] }[] = [];
  form: any = null;
  route = '';
  busy = false;
  error = '';
  sentId = 0;
  files: { path: string; name: string }[] = [];
  uploading = false;
  private sub = new Subscription();
  private uploadKey = '';

  constructor(private dialog: FeedbackDialogService, private service: FeedbackService, private fileSvc: FileUploadService, private operator: OperatorContextService, private router: Router) {}

  ngOnInit() { this.sub.add(this.dialog.opened.subscribe((e) => this.open(e.route))); }
  ngOnDestroy() { this.sub.unsubscribe(); }

  open(route: string) {
    this.areas = areasFor(this.access);
    const seen: string[] = [];
    this.groups = [];
    this.areas.forEach((a) => {
      if (!seen.includes(a.group)) { seen.push(a.group); this.groups.push({ group: a.group, areas: [] }); }
      this.groups.find((g) => g.group === a.group)!.areas.push(a);
    });
    this.route = String(route || '').split(/[?#]/)[0];
    const here = areaForUrl(this.route, this.areas);
    this.form = { kind: 'problem', module_id: here ? here.id : '', feature: '', feature_other: '', title: '', what: '', expected: '', goal: '', benefit: '', impact: 'minor' };
    this.files = [];
    this.uploading = false;
    this.error = '';
    this.sentId = 0;
    this.busy = false;
    this.uploadKey = `u${Date.now()}`;
    this.visible = true;
  }

  close() { this.visible = false; }

  get area(): FeedbackArea | null { return this.areas.find((a) => a.id === this.form?.module_id) || null; }
  get features(): string[] { return this.area ? this.area.features : []; }
  get isSuggestion() { return this.form?.kind === 'suggestion'; }
  get isQuestion() { return this.form?.kind === 'question'; }
  get hasImpact() { return this.form?.kind === 'problem' || this.form?.kind === 'data'; }

  moduleChanged() { this.form.feature = ''; this.form.feature_other = ''; }

  onFiles(ev: any) {
    const picked: File[] = Array.from(ev?.target?.files || []);
    if (ev?.target) ev.target.value = '';
    if (!picked.length) return;
    this.error = '';
    if (this.files.length + picked.length > 3) { this.error = 'Attach up to 3 files.'; return; }
    this.uploading = true;
    let left = picked.length;
    picked.forEach((f) => {
      this.fileSvc.upload(f, `feedback=${this.uploadKey}`).subscribe({
        next: (r: any) => { if (r?.path) this.files.push({ path: r.path, name: r.originalname || f.name }); if (--left === 0) this.uploading = false; },
        error: (e) => { this.error = e?.error?.message || `Could not upload ${f.name} (photos and PDFs only).`; if (--left === 0) this.uploading = false; }
      });
    });
  }
  removeFile(i: number) { this.files.splice(i, 1); }

  send() {
    const f = this.form;
    this.error = '';
    const feature = f.feature === SOMETHING_ELSE ? (f.feature_other || '').trim() : f.feature;
    const body: any = {
      kind: f.kind, module_id: this.area ? this.area.id : null, module_title: this.area ? this.area.title : 'Not sure', feature: feature || null, title: f.title,
      details: f.kind === 'suggestion' ? { goal: f.goal, benefit: f.benefit } : { what: f.what, expected: f.expected },
      impact: this.hasImpact ? f.impact : undefined,
      files: this.files.length ? this.files : undefined,
      actinguserid: this.operator.selectedOperatorId || undefined,
      context: { route: this.route, browser: (navigator.userAgent || '').slice(0, 200) },
    };
    this.busy = true;
    this.service.create(body).subscribe({
      next: (r) => { this.busy = false; this.sentId = r.id; },
      error: (e) => { this.busy = false; const m = e?.error?.message; this.error = Array.isArray(m) ? m.join(' ') : (m || 'The report could not be sent.'); }
    });
  }

  viewMine() { this.visible = false; this.router.navigate(['/secure/feedback']); }
  another() { this.open(this.route); }
}
