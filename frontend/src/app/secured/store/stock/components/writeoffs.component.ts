import { Component, OnDestroy, OnInit } from "@angular/core";
import { saveAs } from "file-saver";
import { Subscription } from "rxjs";
import { StoreContextService } from "src/app/@core/store-context.service";
import { DisposalService } from "../disposal.service";

/**
 * Stock > Write-offs. Review: old adjustments (made before out-passes existed) that look like expiry write-offs, which a Store Head or Business Head confirms as
 * expiry or not; nothing about the adjustment changes. Statement: what was written off as expired, by month and financial year, for the audit and the CA.
 */
@Component({
    template: `
    <div class="mt-2" data-testid="writeoffs-screen">
      <ul class="nav nav-pills mb-2">
        <li class="nav-item"><a class="nav-link py-1" role="button" [class.active]="tab === 'review'" (click)="tab = 'review'" data-testid="wo-tab-review">Review of old write-offs</a></li>
        <li class="nav-item"><a class="nav-link py-1" role="button" [class.active]="tab === 'statement'" (click)="tab = 'statement'; loadStatement()" data-testid="wo-tab-statement">Statement</a></li>
      </ul>
      <div class="alert alert-danger py-2" *ngIf="error">{{error}}</div>
      <div class="alert alert-success py-2" *ngIf="message" data-testid="wo-message">{{message}}</div>

      <div *ngIf="tab === 'review'" data-testid="wo-review">
        <p class="small text-muted">Adjustments made before out-passes existed that look like expiry write-offs: the reason says expired, the batch had expired (or was within 30 days of expiry) that day, or the words speak of expiry or breakage.
          Confirm the ones that were expiry. Nothing about the adjustment changes; the tag only decides how it reads in the statement. They show as "before disposal records": there is no out-pass for them.</p>
        <div class="d-flex flex-wrap align-items-end gap-2 mb-2">
          <div><label class="form-label small mb-0">Show</label>
            <select class="form-select form-select-sm" [(ngModel)]="status" (ngModelChange)="loadReview()" data-testid="wo-status">
              <option value="UNREVIEWED">Not reviewed yet</option><option value="EXPIRY">Confirmed as expiry</option><option value="NOT_EXPIRY">Not expiry</option><option value="">All</option></select></div>
          <span class="small text-muted" *ngIf="counts">Not reviewed {{counts.UNREVIEWED}} &middot; expiry {{counts.EXPIRY}} &middot; not expiry {{counts.NOT_EXPIRY}}</span>
          <span class="ms-auto d-flex gap-2">
            <button type="button" class="btn btn-success btn-sm" [disabled]="!picked.length || busy" (click)="tag('EXPIRY')" data-testid="wo-tag-expiry">Confirm as expiry ({{picked.length}})</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" [disabled]="!picked.length || busy" (click)="tag('NOT_EXPIRY')" data-testid="wo-tag-not">Not expiry ({{picked.length}})</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" [disabled]="!picked.length || busy" (click)="tag(null)" data-testid="wo-tag-clear">Clear the choice</button>
          </span>
        </div>
        <p-table [value]="rows" [paginator]="true" [rows]="25" styleClass="p-datatable-gridlines p-datatable-sm" data-testid="wo-table">
          <ng-template pTemplate="header"><tr>
            <th style="width:2.5em"><input type="checkbox" [checked]="allPicked" (change)="pickAll($any($event.target).checked)" aria-label="Select all"></th>
            <th>Date</th><th>Store</th><th>Product</th><th>Batch</th><th>Expiry</th><th class="text-end">Qty</th><th class="text-end">At cost</th><th style="min-width:9rem">Reason given</th><th style="min-width:17rem">Why it looks like expiry</th><th>Reading</th></tr></ng-template>
          <ng-template pTemplate="body" let-r>
            <tr data-testid="wo-row">
              <td><input type="checkbox" [(ngModel)]="pick[r.id]" [attr.aria-label]="'Select ' + r.title" data-testid="wo-check"></td>
              <td class="text-nowrap">{{r.adjustedon | date:'dd MMM yyyy'}}</td><td class="small">{{r.store}}</td><td>{{r.title}}</td><td>{{r.batch}}</td><td>{{r.expdate | date:'MMM-yy'}}</td>
              <td class="text-end">{{r.qty}}</td><td class="text-end">{{r.cost | number:'1.2-2'}}</td>
              <td class="small">{{r.reason}}<div class="text-muted" *ngIf="r.comments">{{r.comments}}</div></td>
              <td class="small"><div *ngFor="let t of r.signaltext">{{t}}</div></td>
              <td><span class="badge bg-success" *ngIf="r.tag === 'EXPIRY'">Expiry</span><span class="badge bg-secondary" *ngIf="r.tag === 'NOT_EXPIRY'">Not expiry</span><span class="badge bg-light text-muted border" *ngIf="!r.tag">Not reviewed</span></td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage"><tr><td colspan="11" class="text-center text-muted py-3">Nothing to review here.</td></tr></ng-template>
        </p-table>
      </div>

      <div *ngIf="tab === 'statement'" data-testid="wo-statement">
        <p class="small text-muted">What was written off as expired or near expiry, at cost before GST, with the GST paid on that cost (what an input credit reversal would look at; confirm the treatment with your CA).
          It counts out-passes, goods recorded as disposed earlier, and old write-offs you confirmed as expiry.</p>
        <div class="d-flex flex-wrap align-items-end gap-2 mb-2">
          <div><label class="form-label small mb-0">From</label><input type="date" class="form-control form-control-sm" [(ngModel)]="from" data-testid="wo-from"></div>
          <div><label class="form-label small mb-0">To</label><input type="date" class="form-control form-control-sm" [(ngModel)]="to" data-testid="wo-to"></div>
          <button type="button" class="btn btn-primary btn-sm" (click)="loadStatement()" data-testid="wo-show">Show</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="download()" data-testid="wo-download"><i class="bi bi-file-earmark-excel me-1"></i>Excel</button>
        </div>
        <ng-container *ngIf="st">
          <p-table [value]="st.rows" styleClass="p-datatable-gridlines p-datatable-sm" data-testid="wo-st-table">
            <ng-template pTemplate="header"><tr><th>Financial year</th><th>Month</th><th>Source</th><th class="text-end">Lines</th><th class="text-end">Units</th><th class="text-end">At cost</th><th class="text-end">GST on cost</th></tr></ng-template>
            <ng-template pTemplate="body" let-r><tr data-testid="wo-st-row"><td>{{r.fy}}</td><td>{{r.month}}</td><td>{{r.sourcelabel}}</td><td class="text-end">{{r.lines}}</td><td class="text-end">{{r.qty}}</td><td class="text-end">{{r.cost | number:'1.2-2'}}</td><td class="text-end">{{r.tax | number:'1.2-2'}}</td></tr></ng-template>
            <ng-template pTemplate="emptymessage"><tr><td colspan="7" class="text-center text-muted py-3">No expiry write-offs in this period.</td></tr></ng-template>
          </p-table>
          <div class="mt-2 d-flex flex-wrap gap-4" *ngIf="st.rows.length" data-testid="wo-st-years">
            <div *ngFor="let y of st.byYear" class="small"><b>{{y.fy}}</b>: {{y.qty}} units, {{y.cost | number:'1.2-2'}} at cost, {{y.tax | number:'1.2-2'}} GST</div>
            <div class="small fw-semibold">Total: {{st.total.qty}} units, {{st.total.cost | number:'1.2-2'}} at cost, {{st.total.tax | number:'1.2-2'}} GST</div>
          </div>
        </ng-container>
      </div>
    </div>`
})
export class WriteoffsComponent implements OnInit, OnDestroy {
    tab: "review" | "statement" = "review";
    status = "UNREVIEWED";
    rows: any[] = [];
    counts: any = null;
    pick: { [id: number]: boolean } = {};
    busy = false;
    error = "";
    message = "";
    st: any = null;
    from = "";
    to = new Date().toISOString().slice(0, 10);
    private storeId: number | null = null;
    private sub?: Subscription;

    constructor(private service: DisposalService, private storeContext: StoreContextService) {
        // the financial year so far: from the 1st of April
        const now = new Date();
        const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        this.from = `${y}-04-01`;
    }

    ngOnInit() { this.sub = this.storeContext.selectedStoreId$.subscribe((id: any) => { this.storeId = id || null; this.loadReview(); if (this.tab === "statement") this.loadStatement(); }); }
    ngOnDestroy() { this.sub?.unsubscribe(); }

    private params(extra: any = {}) { return { ...(this.storeId ? { storeid: this.storeId } : {}), ...extra }; }

    loadReview() {
        this.error = ""; this.pick = {};
        this.service.legacy(this.params(this.status ? { status: this.status } : {})).subscribe((r: any) => { this.rows = r.rows || []; this.counts = r.counts; }, (e: any) => this.error = this.service.msg(e, "The old write-offs could not be loaded."));
    }

    get picked(): number[] { return this.rows.filter((r: any) => this.pick[r.id]).map((r: any) => r.id); }
    get allPicked(): boolean { return this.rows.length > 0 && this.rows.every((r: any) => this.pick[r.id]); }
    pickAll(on: boolean) { this.rows.forEach((r: any) => this.pick[r.id] = on); }

    tag(t: string | null) {
        this.busy = true; this.error = ""; this.message = "";
        this.service.tagLegacy(this.picked, t).subscribe((r: any) => {
            this.busy = false;
            this.message = t === "EXPIRY" ? `${r.tagged} confirmed as expiry.` : t === "NOT_EXPIRY" ? `${r.tagged} marked as not expiry.` : `${r.tagged} cleared.`;
            this.loadReview();
        }, (e: any) => { this.busy = false; this.error = this.service.msg(e); });
    }

    loadStatement() {
        this.error = "";
        this.service.statement(this.params({ from: this.from, to: this.to })).subscribe((r: any) => this.st = r, (e: any) => this.error = this.service.msg(e, "The statement could not be loaded."));
    }

    download() { this.service.statementXlsx(this.params({ from: this.from, to: this.to })).subscribe((b: Blob) => saveAs(b, "expiry-write-offs.xlsx"), () => this.error = "The statement could not be downloaded."); }
}
