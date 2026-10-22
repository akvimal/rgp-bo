import { Component, EventEmitter, Input, Output } from "@angular/core";

/** Toggle chips for the roles a setup item applies to; none ticked means every role. */
@Component({
  selector: "app-hr-roles",
  template: `
    <div class="d-flex flex-wrap gap-1 align-items-center" data-testid="hr-roles">
      <span class="badge rounded-pill border" *ngFor="let r of roles" role="button" tabindex="0"
            [ngClass]="has(r) ? 'bg-primary text-white border-primary' : 'bg-light text-dark'" (click)="toggle(r)" (keyup.enter)="toggle(r)"
            [attr.data-role]="r" [attr.aria-pressed]="has(r)">{{r}}</span>
      <span class="small text-muted ms-1" *ngIf="!value?.length">All roles</span>
    </div>`,
})
export class HrRolesComponent {
  @Input() roles: string[] = [];
  @Input() value: string[] | null = null;
  @Output() valueChange = new EventEmitter<string[] | null>();

  has(r: string) { return !!this.value?.includes(r); }

  toggle(r: string) {
    const cur = this.value || [];
    const next = cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r];
    this.value = next.length ? next : null;
    this.valueChange.emit(this.value);
  }
}
