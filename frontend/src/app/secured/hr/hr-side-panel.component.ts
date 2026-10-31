import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from "@angular/core";

/**
 * A panel that slides in from the right to add or change one thing, with one Save. The page behind stays as it was.
 * Closing with typed changes asks first; Remove asks "are you sure" in the footer. The parent creates it with *ngIf when it is wanted.
 */
@Component({
  selector: "app-hr-side-panel",
  styles: [`
    .sp-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .35); z-index: 1060; }
    .sp { position: fixed; top: 0; right: 0; bottom: 0; width: min(34rem, 100vw); background: var(--bs-body-bg, #fff); z-index: 1061; display: flex; flex-direction: column;
          box-shadow: -8px 0 24px rgba(15, 23, 42, .18); outline: none; animation: sp-in .16s ease-out; }
    .sp.wide { width: min(46rem, 100vw); }
    .sp-head { display: flex; justify-content: space-between; align-items: center; padding: .75rem 1rem; border-bottom: 1px solid var(--rgp-line, #e5e7eb); }
    .sp-body { flex: 1; overflow-y: auto; padding: 1rem; }
    .sp-foot { padding: .75rem 1rem; border-top: 1px solid var(--rgp-line, #e5e7eb); background: var(--bs-body-bg, #fff); }
    @keyframes sp-in { from { transform: translateX(2rem); opacity: .4; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .sp { animation: none; } }
  `],
  template: `
    <div class="sp-backdrop" (click)="tryClose()"></div>
    <aside #box class="sp" [class.wide]="wide" role="dialog" aria-modal="true" [attr.aria-label]="title" tabindex="-1" data-testid="hr-panel">
      <div class="sp-head">
        <h5 class="mb-0">{{title}}</h5>
        <button type="button" class="btn-close" aria-label="Close" (click)="tryClose()" data-testid="hr-panel-close"></button>
      </div>
      <div class="sp-body form-compact">
        <div class="alert alert-danger py-2" *ngIf="error" data-testid="hr-error">{{error}}</div>
        <ng-content></ng-content>
      </div>
      <div class="sp-foot">
        <div *ngIf="asking" class="d-flex flex-wrap align-items-center gap-2" data-testid="hr-panel-discard">
          <span class="small me-auto">You have changes that are not saved.</span>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="asking = false">Keep editing</button>
          <button type="button" class="btn btn-danger btn-sm" (click)="closed.emit()" data-testid="hr-panel-discard-yes">Discard them</button>
        </div>
        <div *ngIf="!asking && askRemove" class="d-flex flex-wrap align-items-center gap-2" data-testid="hr-panel-remove-ask">
          <span class="small me-auto">{{removeText || 'Remove this?'}}</span>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="askRemove = false">No</button>
          <button type="button" class="btn btn-danger btn-sm" (click)="remove.emit()" data-testid="hr-panel-remove-yes">Yes, remove</button>
        </div>
        <div *ngIf="!asking && !askRemove" class="d-flex flex-wrap align-items-center gap-2">
          <button type="button" class="btn btn-primary" [disabled]="!canSave || busy" (click)="save.emit()" [attr.data-testid]="saveTestId">{{saveLabel}}</button>
          <button type="button" class="btn btn-outline-secondary" (click)="tryClose()" data-testid="hr-panel-cancel">Cancel</button>
          <span class="small text-muted" *ngIf="dirty">Not saved yet</span>
          <button type="button" *ngIf="removable" class="btn btn-outline-danger ms-auto" (click)="askRemove = true" [attr.data-testid]="removeTestId">Remove</button>
        </div>
      </div>
    </aside>`,
})
export class HrSidePanelComponent implements AfterViewInit {
  @Input() title = "";
  @Input() dirty = false;
  @Input() canSave = true;
  @Input() busy = false;
  @Input() wide = false;
  @Input() error = "";
  @Input() saveLabel = "Save";
  @Input() saveTestId = "hr-panel-save";
  @Input() removable = false;
  @Input() removeText = "";
  @Input() removeTestId = "hr-panel-remove";
  @Output() save = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild("box") box!: ElementRef<HTMLElement>;
  asking = false;
  askRemove = false;

  ngAfterViewInit() {
    // focus the first field so typing can start at once; the panel itself takes it when there is none
    setTimeout(() => {
      const first = this.box?.nativeElement.querySelector<HTMLElement>(".sp-body input:not([type=checkbox]):not([disabled]), .sp-body select, .sp-body textarea");
      (first || this.box?.nativeElement)?.focus();
    });
  }

  @HostListener("document:keydown.escape")
  onEscape() { this.tryClose(); }

  tryClose() {
    if (this.dirty && !this.asking) { this.asking = true; return; }
    this.closed.emit();
  }
}
