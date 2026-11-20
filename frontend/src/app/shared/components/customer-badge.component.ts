import { Component, Input, OnChanges } from "@angular/core";
import { CustomerBadge, CustomerBadgeService } from "../customer-badge.service";

/**
 * Who this customer is to the shop: tier and segment ("Gold · Champion"), and with `cue` one line on how to treat them. No figures are shown. Put it
 * beside a customer's name anywhere; it asks for the badge by id and shows nothing for a customer without one (a walk-in, a new record).
 */
@Component({
    selector: 'app-customer-badge',
    template: `
    <span class="cust-badge-wrap" *ngIf="badge" [attr.data-testid]="'cust-badge'" [attr.data-tone]="badge.tone">
        <span class="cust-badge" [ngClass]="'tone-' + badge.tone" [class.big]="size === 'lg'" [title]="badge.cue">
            <i class="bi" [ngClass]="icon"></i> {{badge.label}}<span *ngIf="badge.dueBack" class="due"> &middot; refill due</span>
        </span>
        <div class="cust-cue" *ngIf="cue" data-testid="cust-cue">{{badge.cue}}</div>
    </span>`,
    styles: [`
    .cust-badge { display:inline-flex; align-items:center; gap:.3rem; padding:.1rem .55rem; border-radius:1rem; font-size:.78rem; font-weight:600; border:1px solid transparent; white-space:nowrap; }
    .cust-badge.big { font-size:.95rem; padding:.2rem .8rem; }
    .tone-gold { background:#fff4cc; color:#7a5a00; border-color:#e6c75a; }
    .tone-silver { background:#eef1f4; color:#4c5963; border-color:#c3cbd2; }
    .tone-bronze { background:#f8e9dc; color:#7a4a1f; border-color:#dcb28a; }
    .tone-new { background:#e3f0fc; color:#1a5a99; border-color:#a9cdee; }
    .tone-watch { background:#fff1d6; color:#7a5200; border-color:#e8c27a; }
    .tone-plain { background:#f1f3f5; color:#555; border-color:#d5d9dd; }
    .due { font-weight:500; }
    .cust-cue { font-size:.8rem; color:#555; margin-top:.15rem; }
    `]
})
export class CustomerBadgeComponent implements OnChanges {
    @Input() customerId: number | null | undefined;
    /** also show the line of guidance under the badge */
    @Input() cue = false;
    @Input() size: 'sm' | 'lg' = 'sm';
    badge: CustomerBadge | null = null;

    constructor(private service: CustomerBadgeService) {}

    get icon(): string {
        const t = this.badge?.tone;
        return t === 'gold' || t === 'silver' || t === 'bronze' ? 'bi-award-fill' : t === 'new' ? 'bi-stars' : t === 'watch' ? 'bi-clock-history' : 'bi-person';
    }

    ngOnChanges() {
        const id = Number(this.customerId);
        this.badge = null;
        if (!Number.isInteger(id) || id <= 0) return;
        this.service.get(id).subscribe((b) => { if (Number(this.customerId) === id) this.badge = b; });
    }
}
