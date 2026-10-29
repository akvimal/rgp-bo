import { Component, Input } from "@angular/core";

export interface NeedsItem {
    key: string;
    label: string;
    count: number;
    /** bad: act now, warn: soon, info: for your attention */
    tone: 'bad' | 'warn' | 'info';
    link: any[] | string;
}

/**
 * The "Needs you now" strip every dashboard view starts with (DASHBOARD_AND_MENU_DESIGN 6A): a chip per kind of thing waiting, with a count,
 * each opening the screen where it is dealt with. Chips with nothing waiting are left out; with none left it says so kindly.
 */
@Component({
    selector: 'app-needs-strip',
    template: `
    <section class="card mb-3" aria-label="Needs you now" data-testid="needs-strip">
      <div class="card-body py-2 d-flex flex-wrap align-items-center gap-2">
        <strong class="me-2">Needs you now</strong>
        <a *ngFor="let n of visible" [routerLink]="n.link" class="needs-chip" [ngClass]="'needs-' + n.tone" [attr.data-testid]="'needs-' + n.key">
          <span class="needs-count">{{n.count}}</span> {{n.label}}
        </a>
        <span *ngIf="!visible.length" class="text-success fw-semibold" data-testid="needs-clear">Nothing needs you right now.</span>
      </div>
    </section>`,
    styles: [`
      .needs-chip { display: inline-flex; align-items: center; gap: .4rem; border: 1px solid; border-radius: 18px; padding: 3px 12px; text-decoration: none; color: #2d3748; }
      .needs-count { font-weight: 700; }
      .needs-bad { background: #fff4e5; border-color: #f5c98b; } .needs-bad .needs-count { color: #9a3412; }
      .needs-warn { background: #fff8e8; border-color: #ecd9a0; } .needs-warn .needs-count { color: #8a5a00; }
      .needs-info { background: #f0f3ff; border-color: #c9d3ff; } .needs-info .needs-count { color: #012970; }
    `]
})
export class NeedsStripComponent {
    @Input() items: NeedsItem[] = [];
    get visible(): NeedsItem[] { return (this.items || []).filter(i => i.count > 0); }
}
