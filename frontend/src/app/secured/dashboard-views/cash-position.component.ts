import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DashboardService } from "../dashboard.service";

/** Cash by place: the drawers and the vault from the dashboard summary, and the last balance of each bank account from its statements. */
@Component({
    selector: 'app-cash-position',
    styles: [':host { display: block; }'],
    template: `
    <app-widget title="Cash by place" testid="cash-position" drill="/secure/finance" [loading]="!bank && !error" [error]="error" (retry)="load()"
      definition="Cash in the drawers and the vault, and the last imported balance of each bank account.">
        <ng-container *ngIf="bank">
          <div class="row g-2 mb-2">
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">In the drawers</div><div class="h5 mb-0">{{drawers === null ? '-' : (drawers | number:'1.0-0')}}</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">In the vault</div><div class="h5 mb-0">{{vault === null ? '-' : (vault | number:'1.0-0')}}</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">In the bank</div><div class="h5 mb-0">{{bank ? (bank.bankTotal | number:'1.0-0') : '-'}}</div><div class="small text-muted" *ngIf="bank && bank.unknown">{{bank.unknown}} account{{bank.unknown === 1 ? '' : 's'}} with no statement yet</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Total</div><div class="h5 mb-0" data-testid="cash-total">{{total | number:'1.0-0'}}</div></div></div>
          </div>
          <div class="table-responsive" *ngIf="bank && bank.accounts.length"><table class="table table-sm mb-1" data-testid="cash-banks">
            <thead><tr><th>Bank account</th><th>Store</th><th class="text-end">Balance</th><th>As of</th></tr></thead>
            <tbody><tr *ngFor="let a of bank.accounts"><td>{{a.name}} <span class="text-muted small">{{a.bank_name}}</span></td><td>{{a.store || 'Business'}}</td><td class="text-end">{{a.balance === null ? '-' : (a.balance | number:'1.0-0')}}</td><td>{{a.as_of || 'no statement'}}</td></tr></tbody></table></div>
          <div class="small text-muted">A bank balance is as of its last imported statement line, so it can be some days old.</div>
        </ng-container>
    </app-widget>`
})
export class CashPositionComponent implements OnChanges {
    @Input() storeid: number | null = null;
    drawers: number | null = null;
    vault: number | null = null;
    bank: any = null;
    error = '';
    constructor(private dashboard: DashboardService) {}

    get total(): number { return (this.drawers || 0) + (this.vault || 0) + (this.bank ? this.bank.bankTotal : 0); }

    ngOnChanges(c: SimpleChanges) { if (c.storeid || !this.bank) this.load(); }
    load() {
        this.error = '';
        this.dashboard.getSummary(this.storeid).subscribe({
            next: (s: any) => { this.drawers = Number(s?.kpis?.cash_in_drawers) || 0; this.vault = Number(s?.kpis?.cash_in_vault) || 0; },
            error: () => { this.drawers = null; this.vault = null; }
        });
        this.dashboard.getFinanceCash(this.storeid).subscribe({
            next: (b: any) => { this.bank = b; this.error = ''; },
            error: (e) => (this.error = e?.error?.message || 'The bank balances could not be loaded.')
        });
    }
}
