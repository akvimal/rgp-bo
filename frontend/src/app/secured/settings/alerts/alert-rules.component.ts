import { Component, OnInit } from "@angular/core";
import { ConfirmService } from "src/app/shared/confirm.service";
import { CashService } from "../../store/cash/cash.service";
import { AlertsService } from "../../alerts/alerts.service";

const ROLE_LABELS: { [k: string]: string } = { owners: 'Owners', managers: 'Store heads', staff: 'Staff' };

/** Settings > Alerts: what the shop is told about, to whom and how loudly. Set up by a form, or described in a sentence. */
@Component({
  selector: 'app2-alert-rules',
  templateUrl: './alert-rules.component.html',
})
export class AlertRulesComponent implements OnInit {
  loading = true;
  kinds: any[] = [];
  assistant = false;
  rules: any[] = [];
  stores: any[] = [];
  message = '';
  error = '';

  // the form (new or edit)
  form: any = null;
  previewing = false;
  preview: any = null;
  saving = false;

  // the assistant
  instruction = '';
  drafting = false;
  draftError = '';
  draft: any = null;

  readonly roleKeys = ['owners', 'managers', 'staff'];
  readonly roleLabels = ROLE_LABELS;

  constructor(private alerts: AlertsService, private cash: CashService, private confirm: ConfirmService) {}

  ngOnInit() {
    this.alerts.kinds().subscribe((k) => { this.kinds = k.kinds; this.assistant = k.assistant; });
    this.cash.getStores().subscribe((s: any) => this.stores = (s || []).filter((x: any) => x.isActive !== false && !x.isArchived));
    this.load();
  }

  load() {
    this.alerts.rules().subscribe((r) => { this.rules = r; this.loading = false; }, (e) => { this.loading = false; this.error = this.msg(e); });
  }

  kind(key: string) { return this.kinds.find((k) => k.kind === key); }

  /** "30 days", "14 hours": the numbers of a rule in words */
  summary(rule: any) {
    const k = this.kind(rule.kind);
    const parts = (k?.params || []).map((p: any) => `${rule.params?.[p.key] ?? p.default} ${p.unit}`);
    return parts.length ? parts.join(', ') : '-';
  }

  who(rule: any) { return (rule.recipients?.roles || []).map((r: string) => ROLE_LABELS[r] || r).join(', '); }

  // ---------------------------------------------------------------------------------------------- the form
  newRule() {
    this.clearMessages();
    const k = this.kinds[0];
    this.form = { id: null, kind: k.kind, name: k.label, params: this.defaults(k), severity: k.defaultSeverity, roles: { owners: true, managers: true, staff: false }, storeid: '', instruction: '' };
    this.preview = null;
  }

  edit(rule: any) {
    this.clearMessages();
    const k = this.kind(rule.kind);
    this.form = {
      id: rule.id, kind: rule.kind, name: rule.name, params: { ...this.defaults(k), ...rule.params }, severity: rule.severity, source: rule.source,
      roles: { owners: rule.recipients.roles.includes('owners'), managers: rule.recipients.roles.includes('managers'), staff: rule.recipients.roles.includes('staff') },
      storeid: rule.storeid || '', active: rule.active, instruction: rule.instruction || '',
    };
    this.preview = null;
  }

  private defaults(k: any) { const o: any = {}; for (const p of k.params) o[p.key] = p.default; return o; }

  pickKind() {
    const k = this.kind(this.form.kind);
    this.form.name = k.label; this.form.params = this.defaults(k); this.form.severity = k.defaultSeverity; this.preview = null;
  }

  private body() {
    const f = this.form;
    return {
      kind: f.kind, name: f.name, params: f.params, severity: f.severity,
      recipients: { roles: this.roleKeys.filter((r) => f.roles[r]) }, storeid: f.storeid || null,
      ...(f.fromassistant ? { fromassistant: true, instruction: f.instruction } : {}),
    };
  }

  doPreview() {
    this.error = ''; this.previewing = true;
    this.alerts.preview(this.body()).subscribe((p) => { this.preview = p; this.previewing = false; }, (e) => { this.previewing = false; this.error = this.msg(e); });
  }

  save() {
    this.error = this.message = ''; this.saving = true;
    const done = () => { this.saving = false; this.form = null; this.draft = null; this.message = 'Saved.'; this.load(); };
    const fail = (e: any) => { this.saving = false; this.error = this.msg(e); };
    if (this.form.id) this.alerts.updateRule(this.form.id, { ...this.body(), active: this.form.active }).subscribe(done, fail);
    else this.alerts.createRule(this.body()).subscribe(done, fail);
  }

  cancel() { this.form = null; this.preview = null; }

  toggle(rule: any) {
    this.clearMessages();
    this.alerts.updateRule(rule.id, { active: !rule.active }).subscribe(() => this.load(), (e) => this.error = this.msg(e));
  }

  remove(rule: any) {
    this.confirm.confirmDelete(rule.name, () =>
      this.alerts.removeRule(rule.id).subscribe(() => { this.message = 'Removed.'; this.load(); }, (e) => this.error = this.msg(e)),
      { entity: 'alert', verb: 'Remove', consequence: 'Its open notifications are closed.' });
  }

  checkNow() { this.clearMessages(); this.alerts.runNow().subscribe(() => { this.message = 'Checked just now.'; this.load(); }, (e) => this.error = this.msg(e)); }

  // ---------------------------------------------------------------------------------------------- the assistant
  askAssistant() {
    this.draftError = ''; this.draft = null; this.drafting = true;
    this.alerts.draft(this.instruction).subscribe((d) => { this.draft = d; this.drafting = false; }, (e) => { this.drafting = false; this.draftError = this.msg(e); });
  }

  /** the draft goes into the same form, so it is checked, changed if needed, and saved as the owner's own decision */
  useDraft() {
    const d = this.draft.draft;
    this.form = {
      id: null, kind: d.kind, name: d.name, params: { ...this.defaults(this.kind(d.kind)), ...d.params }, severity: d.severity,
      roles: { owners: d.recipients.roles.includes('owners'), managers: d.recipients.roles.includes('managers'), staff: d.recipients.roles.includes('staff') },
      storeid: d.storeid || '', fromassistant: true, instruction: this.instruction,
    };
    this.preview = this.draft.preview;
    this.draft = null;
  }

  private clearMessages() { this.message = this.error = ''; }

  private msg(e: any): string { const m = e?.error?.message; return Array.isArray(m) ? m.join(' ') : (m || 'That did not work. Try again.'); }
}
