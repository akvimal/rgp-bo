import { Component, Input } from "@angular/core";
import { FormControl } from "@angular/forms";

/** A password field the same everywhere: label, a Show / Hide toggle, and the right autocomplete hint. */
@Component({
  selector: "app-auth-password",
  template: `
    <label [for]="inputId" class="form-label">{{label}}</label>
    <div class="input-group">
      <input [type]="show ? 'text' : 'password'" [id]="inputId" [formControl]="control" class="form-control"
             [attr.data-testid]="testid" [attr.autocomplete]="autocomplete" required>
      <button type="button" class="btn btn-outline-secondary" (click)="show = !show" tabindex="-1"
              [attr.aria-label]="show ? 'Hide password' : 'Show password'" [attr.data-testid]="testid + '-toggle'">
        <i class="bi" [ngClass]="show ? 'bi-eye-slash' : 'bi-eye'"></i>
      </button>
    </div>
    <ng-content></ng-content>`,
})
export class AuthPasswordComponent {
  @Input() label = "Password";
  @Input() control!: FormControl;
  @Input() inputId = "password";
  @Input() testid = "";
  @Input() autocomplete = "current-password";
  show = false;
}
