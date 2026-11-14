import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from "@angular/core";

export interface RowAction {
    /** view and edit are placed first and shown as icons; anything else goes in the more menu */
    key: string;
    label: string;
    /** a bootstrap icon name, e.g. "bi-eye"; view and edit have their own */
    icon?: string;
    /** a router link instead of an event */
    link?: any[];
    queryParams?: any;
    /** destructive: sorted last in the menu and shown in red */
    danger?: boolean;
    /** hide it (default shown) */
    hidden?: boolean;
}

const ICONS: { [k: string]: string } = { view: 'bi-eye', edit: 'bi-pencil-square' };

/**
 * The action cell every list uses (docs/planning/UI_PATTERNS.md section 3): View (eye), Edit (pencil), then a "more" menu, destructive actions last in red.
 * An action with a `link` navigates; any other emits its key. Test ids are `<testid>-<key>` and `<testid>-more`.
 *
 *   <app-row-actions testid="vendor" [actions]="[{key:'view',label:'View'}, {key:'edit',label:'Edit',link:['../edit',v.id]}, {key:'disable',label:'Disable',danger:true}]" (action)="act($event, v)">
 */
@Component({
    selector: 'app-row-actions',
    styles: [':host { display: inline-block; position: relative; } .menu { position: absolute; right: 0; top: 100%; z-index: 1050; min-width: 11rem; }'],
    template: `
    <div class="d-inline-flex align-items-center gap-2">
      <ng-container *ngFor="let a of inline">
        <a *ngIf="a.link" class="text-primary" [routerLink]="a.link" [queryParams]="a.queryParams" [title]="a.label" [attr.aria-label]="a.label" [attr.data-testid]="testid + '-' + a.key"><i class="bi" [ngClass]="iconOf(a)"></i></a>
        <a *ngIf="!a.link" class="text-primary" href="javascript:void(0)" (click)="emit(a)" [title]="a.label" [attr.aria-label]="a.label" [attr.data-testid]="testid + '-' + a.key"><i class="bi" [ngClass]="iconOf(a)"></i></a>
      </ng-container>
      <a *ngIf="menu.length" class="text-secondary" href="javascript:void(0)" (click)="toggle($event)" title="More" aria-label="More actions" aria-haspopup="menu" [attr.aria-expanded]="open" [attr.data-testid]="testid + '-more'"><i class="bi bi-three-dots"></i></a>
    </div>
    <div class="menu card shadow-sm py-1 text-start" *ngIf="open" role="menu" [attr.data-testid]="testid + '-menu'">
      <ng-container *ngFor="let a of menu">
        <a *ngIf="a.link" class="dropdown-item small" [class.text-danger]="a.danger" [routerLink]="a.link" [queryParams]="a.queryParams" role="menuitem" (click)="open = false" [attr.data-testid]="testid + '-' + a.key"><i class="bi me-2" [ngClass]="iconOf(a)"></i>{{a.label}}</a>
        <a *ngIf="!a.link" class="dropdown-item small" [class.text-danger]="a.danger" href="javascript:void(0)" role="menuitem" (click)="emit(a)" [attr.data-testid]="testid + '-' + a.key"><i class="bi me-2" [ngClass]="iconOf(a)"></i>{{a.label}}</a>
      </ng-container>
    </div>`
})
export class RowActionsComponent {
    @Input() actions: RowAction[] = [];
    @Input() testid = 'row';
    @Output() action = new EventEmitter<string>();
    open = false;

    constructor(private host: ElementRef) {}

    private get shown(): RowAction[] { return (this.actions || []).filter((a) => !a.hidden); }
    /** view first, then edit: the two icons every list has in the same place */
    get inline(): RowAction[] {
        const v = this.shown.find((a) => a.key === 'view'), e = this.shown.find((a) => a.key === 'edit');
        return [v, e].filter((a): a is RowAction => !!a);
    }
    /** the rest, in the order given, destructive ones last */
    get menu(): RowAction[] {
        const rest = this.shown.filter((a) => a.key !== 'view' && a.key !== 'edit');
        return [...rest.filter((a) => !a.danger), ...rest.filter((a) => a.danger)];
    }

    iconOf(a: RowAction): string { return a.icon || ICONS[a.key] || (a.danger ? 'bi-trash' : 'bi-dot'); }

    toggle(e: Event) { e.stopPropagation(); this.open = !this.open; }
    emit(a: RowAction) { this.open = false; this.action.emit(a.key); }

    @HostListener('document:click', ['$event'])
    outside(e: Event) { if (this.open && !this.host.nativeElement.contains(e.target)) this.open = false; }

    @HostListener('document:keydown.escape')
    escape() { this.open = false; }
}
