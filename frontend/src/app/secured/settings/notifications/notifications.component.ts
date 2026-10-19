import { Component, OnInit } from "@angular/core";
import { NotificationsService } from "./notifications.service";

@Component({
  templateUrl: "./notifications.component.html"
})
export class NotificationsComponent implements OnInit {
  loading = true;
  saving = false;
  botConfigured = true;
  config: any = { dailyenabled: true, dailytime: '22:30', consolidatedchatid: '', stores: [] };
  message = '';
  error = '';
  testResult: { [key: string]: string } = {};
  testing: { [key: string]: boolean } = {};

  // preview / send now
  digestDate = NotificationsComponent.today();
  previewScope = 'all';
  previewText = '';
  previewing = false;
  forceSend = false;
  sending = false;
  sendResults: any[] = [];

  log: any[] = [];

  constructor(private readonly service: NotificationsService) {}

  ngOnInit(): void {
    this.load();
    this.loadLog();
  }

  /** Browser-local YYYY-MM-DD (the shop's own day). */
  static today(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  load() {
    this.loading = true;
    this.service.getConfig().subscribe(cfg => {
      this.config = cfg;
      this.botConfigured = !!cfg.botconfigured;
      this.loading = false;
    }, err => {
      this.loading = false;
      this.error = this.errorText(err, 'Unable to load notification settings');
    });
  }

  loadLog() {
    this.service.getLog().subscribe(rows => this.log = rows || [], () => this.log = []);
  }

  get configuredStores(): number {
    return (this.config.stores || []).filter((s: any) => s.telegramchatid && s.telegramdigestenabled).length;
  }

  save() {
    this.message = '';
    this.error = '';
    this.saving = true;
    const payload = {
      dailyenabled: this.config.dailyenabled,
      dailytime: this.config.dailytime,
      consolidatedchatid: (this.config.consolidatedchatid || '').trim(),
      stores: (this.config.stores || []).map((s: any) => ({
        id: s.id,
        telegramchatid: (s.telegramchatid || '').trim(),
        telegramdigestenabled: s.telegramdigestenabled !== false
      }))
    };
    this.service.saveConfig(payload).subscribe(cfg => {
      this.saving = false;
      this.config = cfg;
      this.message = 'Notification settings saved.';
    }, err => {
      this.saving = false;
      this.error = this.errorText(err, 'Unable to save notification settings');
    });
  }

  test(key: string, chatid: string) {
    const id = (chatid || '').trim();
    if (!id) {
      this.testResult[key] = 'Enter a chat ID first.';
      return;
    }
    this.testing[key] = true;
    this.testResult[key] = '';
    this.service.sendTest(id).subscribe(() => {
      this.testing[key] = false;
      this.testResult[key] = 'Test message sent.';
    }, err => {
      this.testing[key] = false;
      this.testResult[key] = this.errorText(err, 'Test failed');
    });
  }

  preview() {
    this.error = '';
    this.previewText = '';
    this.previewing = true;
    const storeid = this.previewScope === 'all' ? null : +this.previewScope;
    this.service.preview(this.digestDate, storeid).subscribe(rows => {
      this.previewing = false;
      const wanted = this.previewScope === 'all' ? 'all' : `store:${this.previewScope}`;
      this.previewText = (rows || []).find(r => r.scope === wanted)?.message || 'Nothing to show for this selection.';
    }, err => {
      this.previewing = false;
      this.error = this.errorText(err, 'Unable to build the preview');
    });
  }

  sendNow() {
    this.error = '';
    this.sendResults = [];
    this.sending = true;
    this.service.sendNow(this.digestDate, this.forceSend).subscribe(rows => {
      this.sending = false;
      this.sendResults = rows || [];
      this.loadLog();
    }, err => {
      this.sending = false;
      this.error = this.errorText(err, 'Unable to send the digest');
    });
  }

  scopeLabel(scope: string): string {
    if (scope === 'all') return 'All stores';
    const id = +String(scope).replace('store:', '');
    return (this.config.stores || []).find((s: any) => s.id === id)?.location || scope;
  }

  private errorText(err: any, fallback: string): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(', ') : (m || fallback);
  }
}
