import { Component, Input, ViewEncapsulation } from "@angular/core";

/**
 * The one frame for every signed-out page (sign in, change password): the same card, brand, title, spacing and, for the
 * platform administration pages, the same dark theme. The page puts its form inside.
 */
@Component({
  selector: "app-auth-shell",
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .auth-page { background: #f6f9ff; min-height: 100vh; }
    .auth-page .auth-card { width: 100%; max-width: 26rem; border: 0; }
    .auth-page .auth-brand img { width: 72px; height: 72px; }
    .auth-platform { background: #12171f; }
    .auth-platform .auth-card { background: #1c232e; color: #e6e9ee; border-top: 4px solid #f0a020; }
    .auth-platform .auth-card h5, .auth-platform .auth-card .form-text { color: #e6e9ee; }
    .auth-platform .auth-card .form-label { color: #c9d1dc; }
    .auth-platform .auth-card .form-control,
    .auth-platform .auth-card .input-group-text { background: #0f141b; color: #e6e9ee; border-color: #2c3644; }
    .auth-platform .auth-card .form-control:focus { border-color: #f0a020; box-shadow: 0 0 0 .2rem rgba(240, 160, 32, .25); }
    .auth-platform .auth-card .btn-outline-secondary { color: #c9d1dc; border-color: #2c3644; }
    .auth-platform .auth-card a { color: #f0a020; }
    .auth-platform .auth-card .btn-primary { background: #f0a020; border-color: #f0a020; color: #12171f; }
    .auth-platform .auth-card .btn-primary:disabled { opacity: .5; }
  `],
  template: `
    <main class="auth-page" [class.auth-platform]="platform" [attr.data-login-scope]="platform ? 'platform' : 'business'">
      <section class="min-vh-100 d-flex align-items-center justify-content-center py-4 px-3">
        <div class="auth-card card shadow">
          <div class="card-body p-4">
            <div class="auth-brand text-center mb-3" data-testid="auth-brand">
              <ng-container *ngIf="!platform">
                <img src="assets/img/rgp-logo.png" alt="RGP">
                <div class="fw-semibold mt-2">Ramesh Generic Pharmacy</div>
              </ng-container>
              <div *ngIf="platform" data-testid="login-platform-banner">
                <i class="bi bi-shield-lock" style="font-size: 56px; color: #f0a020;"></i>
                <div class="fw-semibold mt-1">Platform administration</div>
                <div class="small" style="color: #9aa4b2;">Authorised staff only</div>
              </div>
            </div>
            <h5 class="text-center mb-3" data-testid="auth-title">{{title}}</h5>
            <ng-content></ng-content>
          </div>
        </div>
      </section>
    </main>`,
})
export class AuthShellComponent {
  @Input() platform = false;
  @Input() title = "";
}
