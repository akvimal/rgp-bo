import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FileUploadService } from "../documents/file-upload.service";
import { PAGES } from "../../guide/app-guide-content";
import { FeedbackDialogService, FeedbackService } from "./feedback.service";

const STATUS_TONE: any = { NEW: 'secondary', IN_PROGRESS: 'primary', WAITING: 'warning', ANSWERED: 'success', PLANNED: 'info', DECLINED: 'dark', DUPLICATE: 'dark', CLOSED: 'secondary' };
/** the four states everyone sees; the detailed status stays as a smaller line under it */
const STATE_TONE: any = { open: 'primary', waiting: 'warning', done: 'success', closed: 'secondary' };
/** what a manager can move a report to besides resolving it (the endings are chosen in Resolve) */
const MORE_CHOICES = [
  { key: 'IN_PROGRESS', label: 'Looking into it' },
  { key: 'WAITING', label: 'Waiting on the reporter' },
  { key: 'PLANNED', label: 'Planned' },
];

/** how a report ends: what the manager picks in Resolve (the API maps each to a status) */
const RESOLUTION_CHOICES = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'answered', label: 'Answered' },
  { key: 'not_a_bug', label: 'Not a bug' },
  { key: 'cannot_reproduce', label: 'Cannot reproduce' },
  { key: 'not_planned', label: 'Not planned' },
  { key: 'duplicate', label: 'Already reported' },
];

/**
 * Help and feedback: the person's own reports with the answers (tab My reports), and for those who answer, the Inbox of everyone's.
 * Opening a report shows its thread; the reporter can reply, say it is solved, or reopen it; a manager replies, leaves an internal note, sets the status.
 */
@Component({
  selector: 'app-feedback',
  templateUrl: './feedback.component.html'
})
export class FeedbackComponent implements OnInit {
  tab: 'mine' | 'inbox' = 'mine';
  options: any = { manage: false, staff: [] };
  mine: any = { items: [], unread: 0 };
  inbox: any = { items: [], counts: { awaiting: 0, open: 0 } };
  view = 'open';
  kind = '';
  module = '';
  search = '';
  modules = PAGES.filter((p) => p.id !== 'nav-feedback').map((p) => ({ id: p.id, title: p.title }));
  loaded = false;
  error = '';
  message = '';

  open: any = null;           // the report being read
  busy = false;
  reply = { message: '', wait: false, internal: false };
  replyFiles: { path: string; name: string }[] = [];
  uploading = false;
  reopening = false;
  reopenMessage = '';
  moreChoices = MORE_CHOICES;
  /** My reports: Open (open and waiting), Done (done and closed), or All */
  mineView: 'open' | 'done' | 'all' = 'open';
  resolutionChoices = RESOLUTION_CHOICES;
  resolving = false;
  followingUp = false;
  followUpMessage = '';
  resolveForm = { code: 'answered', note: '', duplicate_of: null as number | null, close: true };
  viewOpen = false;
  viewPath = '';
  viewName = '';
  private uploadKey = `r${Date.now()}`;

  constructor(private service: FeedbackService, private dialog: FeedbackDialogService, private files: FileUploadService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.service.options().subscribe({
      next: (o) => {
        this.options = o;
        this.loadMine();
        if (o.manage) this.loadInbox();
        const id = +(this.route.snapshot.queryParamMap.get('id') || 0);
        if (id) this.openReport(id);
      },
      error: (e) => { this.error = e?.error?.message || 'Help and feedback could not be opened.'; this.loaded = true; }
    });
  }

  tone(s: string) { return STATUS_TONE[s] || 'secondary'; }
  stateTone(state: string) { return STATE_TONE[state] || 'secondary'; }

  /** my reports under the chosen chip */
  get mineShown(): any[] {
    const items = this.mine.items || [];
    if (this.mineView === 'all') return items;
    return items.filter((r: any) => (this.mineView === 'open') === (r.state === 'open' || r.state === 'waiting'));
  }
  count(view: 'open' | 'done'): number { return (this.mine.items || []).filter((r: any) => (view === 'open') === (r.state === 'open' || r.state === 'waiting')).length; }
  get waitingOnMe(): number { return (this.mine.items || []).filter((r: any) => r.state === 'waiting').length; }
  newReport() { this.dialog.open('/secure/feedback'); }
  setTab(t: 'mine' | 'inbox') { this.tab = t; this.open = null; this.message = this.error = ''; if (t === 'mine') this.loadMine(); else this.loadInbox(); }

  loadMine() { this.service.mine().subscribe({ next: (r) => { this.mine = r; this.loaded = true; }, error: (e) => { this.error = this.msg(e); this.loaded = true; } }); }
  loadInbox() {
    this.service.inbox({ view: this.view, kind: this.kind, module: this.module, q: this.search.trim() }).subscribe({
      next: (r) => { this.inbox = r; this.loaded = true; }, error: (e) => { this.error = this.msg(e); this.loaded = true; }
    });
  }
  setView(v: string) { this.view = v; this.loadInbox(); }

  openReport(id: number) {
    this.error = this.message = '';
    this.service.get(id).subscribe({
      next: (r) => {
        this.open = r;
        // a report that is someone else's is opened from the Inbox, so Back returns there
        if (r.can?.manage && this.options.manage) this.tab = 'inbox';
        this.reply = { message: '', wait: false, internal: false };
        this.replyFiles = [];
        this.reopening = false; this.reopenMessage = '';
        this.resolving = false;
        this.followingUp = false; this.followUpMessage = '';
        this.resolveForm = { code: r.kind === 'problem' || r.kind === 'data' ? 'fixed' : 'answered', note: '', duplicate_of: null, close: true };
        this.uploadKey = `r${Date.now()}`;
        this.loadMine(); // opening it is reading it, so the unread count falls
      },
      error: (e) => this.error = this.msg(e)
    });
  }
  back() { this.open = null; this.message = this.error = ''; if (this.tab === 'inbox') this.loadInbox(); else this.loadMine(); }

  private after(text: string) { this.busy = false; this.message = text; this.openReport(this.open.id); if (this.options.manage) this.loadInbox(); }
  private fail(e: any) { this.busy = false; this.error = this.msg(e); }
  private msg(e: any) { const m = e?.error?.message; return Array.isArray(m) ? m.join(' ') : (m || 'Something went wrong.'); }

  sendReply() {
    if (!this.reply.message.trim()) { this.error = 'Write your reply.'; return; }
    this.busy = true; this.error = '';
    this.service.reply(this.open.id, { message: this.reply.message, wait: this.reply.wait, internal: this.reply.internal, files: this.replyFiles.length ? this.replyFiles : undefined })
      .subscribe({ next: () => this.after(this.reply.internal ? 'Internal note saved.' : 'Reply sent.'), error: (e) => this.fail(e) });
  }
  solved() { this.busy = true; this.service.close(this.open.id).subscribe({ next: () => this.after('Thank you. Closed.'), error: (e) => this.fail(e) }); }
  sendReopen() {
    this.busy = true;
    this.service.reopen(this.open.id, this.reopenMessage).subscribe({ next: () => this.after('Reopened. We will look again.'), error: (e) => this.fail(e) });
  }
  /** the "More" list: move the report to looking into it, waiting on the reporter, or planned (also how a closed report is picked up again) */
  moveTo(status: string) {
    if (!status) return;
    this.busy = true; this.error = '';
    this.service.setStatus(this.open.id, { status }).subscribe({ next: () => this.after('Updated.'), error: (e) => this.fail(e) });
  }
  /** the reporter takes it back before it is answered */
  withdraw() { this.busy = true; this.service.close(this.open.id).subscribe({ next: () => this.after('Withdrawn. It is closed.'), error: (e) => this.fail(e) }); }
  /** resolve in one step: how it ended and the words the reporter reads */
  doResolve() {
    this.busy = true; this.error = '';
    this.service.resolve(this.open.id, { code: this.resolveForm.code, note: this.resolveForm.note, duplicate_of: this.resolveForm.duplicate_of || undefined, close: this.resolveForm.close })
      .subscribe({ next: () => this.after(this.resolveForm.close ? 'Resolved and closed.' : 'Resolved.'), error: (e) => this.fail(e) });
  }
  /** a report that has ended is closed by a manager once it is done with */
  closeTicket() {
    this.busy = true; this.error = '';
    this.service.setStatus(this.open.id, { status: 'CLOSED' }).subscribe({ next: () => this.after('Closed.'), error: (e) => this.fail(e) });
  }
  resolutionLabel(code: string) { return code === 'no_response' ? 'No response' : (RESOLUTION_CHOICES.find((c) => c.key === code)?.label || ''); }
  /** closed too long ago to reopen: a new report that links back to this one */
  sendFollowUp() {
    this.busy = true; this.error = '';
    this.service.followUp(this.open.id, this.followUpMessage).subscribe({ next: (r) => { this.busy = false; this.message = 'Follow-up sent.'; this.openReport(r.id); this.loadMine(); }, error: (e) => this.fail(e) });
  }
  assign(id: any) { this.service.assign(this.open.id, +id || null).subscribe({ next: () => this.after('Assigned.'), error: (e) => this.fail(e) }); }

  onFiles(ev: any) {
    const picked: File[] = Array.from(ev?.target?.files || []);
    if (ev?.target) ev.target.value = '';
    if (!picked.length) return;
    if (this.replyFiles.length + picked.length > 3) { this.error = 'Attach up to 3 files.'; return; }
    this.uploading = true;
    let left = picked.length;
    picked.forEach((f) => this.files.upload(f, `feedback=${this.uploadKey}`).subscribe({
      next: (r: any) => { if (r?.path) this.replyFiles.push({ path: r.path, name: r.originalname || f.name }); if (--left === 0) this.uploading = false; },
      error: (e) => { this.error = e?.error?.message || `Could not upload ${f.name} (photos and PDFs only).`; if (--left === 0) this.uploading = false; }
    }));
  }
  viewFile(f: { path: string; name: string }) { this.viewPath = f.path; this.viewName = f.name; this.viewOpen = true; }
}
