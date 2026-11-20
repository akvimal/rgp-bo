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
    .tone-gold { background:#f2c94c; color:#3b2a00; border-color:#c99a14; }
    .tone-silver { background:#b9c3cd; color:#1d2830; border-color:#8b97a3; }
    .tone-bronze { background:#b8793f; color:#fff; border-color:#8a5628; }
    .tone-new { background:#8cc0ee; color:#0a2e52; border-color:#5a97cf; }
    .tone-watch { background:#f4b183; color:#4a2300; border-color:#d08850; }
    .tone-plain { background:#dfe3e7; color:#3a4148; border-color:#b3bac1; }
    :host-context(html[data-theme="dark"]) .tone-gold { background:#5a4813; color:#f2d77f; border-color:#8c7120; }
    :host-context(html[data-theme="dark"]) .tone-silver { background:#3d4853; color:#d5dce3; border-color:#5f6d7a; }
    :host-context(html[data-theme="dark"]) .tone-bronze { background:#6b4122; color:#f0c29c; border-color:#94623a; }
    :host-context(html[data-theme="dark"]) .tone-new { background:#1f4466; color:#a6d0f5; border-color:#356a9c; }
    :host-context(html[data-theme="dark"]) .tone-watch { background:#66401a; color:#f5bf80; border-color:#94632d; }
    :host-context(html[data-theme="dark"]) .tone-plain { background:#343b43; color:#c6ccd2; border-color:#505964; }
    :host-context(html[data-theme="dark"]) .cust-cue { color:#aeb6bf; }
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
