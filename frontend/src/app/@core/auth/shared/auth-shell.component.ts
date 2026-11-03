import { Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../../environments/environment";

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
    .auth-page .auth-brand img { width: 72px; height: 72px; object-fit: contain; }
    .auth-page .auth-brand img.custom { width: auto; max-width: 220px; height: auto; max-height: 72px; }
    .auth-page .auth-brand .brand-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
                <img [src]="brand.logo || 'assets/img/rgp-logo.png'" [class.custom]="!!brand.logo" [alt]="brand.name" data-testid="auth-logo">
                <div class="fw-semibold mt-2 brand-name" [title]="brand.name" data-testid="auth-business-name">{{brand.name}}</div>
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
export class AuthShellComponent implements OnInit {
  @Input() platform = false;
  @Input() title = "";

  /** the business's own name and logo; the last ones seen are kept in this browser so the page does not flash the default first */
  brand: { name: string; logo: string | null; showChangePassword?: boolean } = { name: "Ramesh Generic Pharmacy", logo: null };
  /** tells the page whether the business shows the "Change password" link on sign-in */
  @Output() showChangePassword = new EventEmitter<boolean>();

  constructor(private http: HttpClient) {
    try {
      const saved = JSON.parse(localStorage.getItem("rgp.brand") || "null");
      if (saved?.name) this.brand = { name: String(saved.name), logo: typeof saved.logo === "string" ? saved.logo : null, showChangePassword: saved.showChangePassword !== false };
    } catch { /* the default is used */ }
  }

  ngOnInit() {
    if (this.platform) return;
    if (this.brand.showChangePassword === false) setTimeout(() => this.showChangePassword.emit(false));
    this.http.get<{ name?: string; logo?: string | null; showchangepassword?: boolean }>(`${environment.apiHost}/brand`).subscribe(b => {
      if (!b?.name) return;                       // several businesses on one install: keep the default
      this.brand = { name: b.name, logo: b.logo || null, showChangePassword: b.showchangepassword !== false };
      this.showChangePassword.emit(this.brand.showChangePassword !== false);
      try { localStorage.setItem("rgp.brand", JSON.stringify(this.brand)); } catch { /* not remembered */ }
    }, () => { /* the default stays */ });
  }
}
