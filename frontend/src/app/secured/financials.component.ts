import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { saveAs } from "file-saver";
import { DashboardService } from "./dashboard.service";
import { StoreContextService } from "../@core/store-context.service";

/**
 * The financial dashboard (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2.2): one page that puts the money pieces together for the store chosen in
 * the header. The owner sees the bridge from sales to profit; a Store Head sees sales and costs for their store but no purchases or profit (the server
 * decides that, not this page).
 */
@Component({
    selector: 'app-financials',
    template: `
    <div class="form-compact">
      <div class="pagetitle"><h1>Financial dashboard</h1></div>
      <p class="small text-muted mb-3" data-testid="fd-intro">
        Money by category, what it costs to run, cash, stock and tax in one place for <strong>{{storeLabel}}</strong>. Change the store in the header.
        Figures are before GST and by invoice or bill date.
      </p>
      <section class="card mb-3" *ngIf="owner" data-testid="fd-owner-tools" aria-label="Owner tools">
        <div class="card-body">
          <h2 class="h6">For the owner</h2>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <button class="btn btn-sm btn-outline-primary" (click)="pack()" [disabled]="busy" data-testid="fd-pack">Accountant pack (Excel, this financial year)</button>
            <button class="btn btn-sm btn-outline-secondary" (click)="previewDigest()" [disabled]="busy" data-testid="fd-digest-preview">Preview the weekly digest</button>
            <button class="btn btn-sm btn-outline-secondary" (click)="sendDigest()" [disabled]="busy" data-testid="fd-digest-send">Send it on Telegram now</button>
            <button class="btn btn-sm btn-link" (click)="rebuild()" [disabled]="busy" data-testid="fd-rollup">Rebuild the daily roll-up</button>
          </div>
          <div class="small mt-2" [class.text-danger]="isError" [class.text-success]="!isError" *ngIf="message" data-testid="fd-message">{{message}}</div>
          <pre class="small border rounded p-2 mt-2 mb-0" style="white-space: pre-wrap" *ngIf="digest" data-testid="fd-digest-text"><strong>{{digest.title}}</strong>
{{digest.body}}</pre>
          <div class="small text-muted mt-2">The digest goes to owners who connected Telegram, every Monday at 8:15. E-mail is not set up yet.</div>
        </div>
      </section>
      <app-finance-matrix [storeid]="storeid" [showBridge]="true"></app-finance-matrix>
      <app-cost-ratios [storeid]="storeid"></app-cost-ratios>
      <app-cash-position [storeid]="storeid"></app-cash-position>
      <app-stock-value [storeid]="storeid"></app-stock-value>
      <app-gst-position [storeid]="storeid"></app-gst-position>
    </div>`
})
export class FinancialsComponent implements OnInit, OnDestroy {
    storeid: number | null = null;
    storeLabel = 'all stores';
    owner = false;
    busy = false;
    message = '';
    isError = false;
    digest: any = null;
    private sub?: Subscription;

    constructor(private storeContext: StoreContextService, private dashboard: DashboardService) {}

    private say(m: string, error = false) { this.message = m; this.isError = error; }
    private fail(e: any) { this.busy = false; this.say(e?.error?.message || 'That did not work.', true); }

    /** the financial year so far, as the first and last month */
    private fy(): { from: string; to: string } {
        const now = new Date(Date.now() + 5.5 * 3600000);
        const y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
        const start = m >= 4 ? y : y - 1;
        return { from: `${start}-04`, to: `${start + 1}-03` };
    }

    pack() {
        const r = this.fy();
        this.busy = true; this.say('');
        this.dashboard.downloadAccountantPack(r.from, r.to).subscribe({
            next: (b: Blob) => { this.busy = false; saveAs(b, `accountant-pack-${r.from}-to-${r.to}.xlsx`); this.say('The accountant pack was downloaded.'); },
            error: () => { this.busy = false; this.say('The pack could not be made.', true); }
        });
    }
    previewDigest() {
        this.busy = true; this.say('');
        this.dashboard.getFinanceDigest().subscribe({ next: (d: any) => { this.busy = false; this.digest = d; }, error: (e) => this.fail(e) });
    }
    sendDigest() {
        this.busy = true; this.say('');
        this.dashboard.sendFinanceDigest().subscribe({
            next: (r: any) => { this.busy = false; this.say(r.queued ? `Queued for ${r.queued} owner${r.queued === 1 ? '' : 's'} on Telegram.` : 'Nobody to send to: an owner needs to connect Telegram first.'); },
            error: (e) => this.fail(e)
        });
    }
    rebuild() {
        this.busy = true; this.say('');
        this.dashboard.rebuildFinanceRollup(true).subscribe({ next: (r: any) => { this.busy = false; this.say(`Roll-up built through ${r.through} (${r.rows} rows).`); }, error: (e) => this.fail(e) });
    }

    ngOnInit() {
        this.dashboard.getView().subscribe({ next: (v: any) => (this.owner = (v?.view || 'owner') === 'owner'), error: () => (this.owner = false) });
        this.apply(this.storeContext.selectedStoreId);
        this.sub = this.storeContext.selectedStoreId$.subscribe((id: any) => this.apply(id));
    }
    ngOnDestroy() { this.sub?.unsubscribe(); }

    private apply(id: any) {
        this.storeid = id === undefined || id === null ? null : Number(id);
        const s = (this.storeContext.stores || []).find((x: any) => Number(x.id) === this.storeid);
        this.storeLabel = this.storeid === null ? 'all stores' : (s && (s.location || s.name)) || `store ${this.storeid}`;
    }
}
