import { Injectable } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { AuthService } from './auth.service';
import { CredentialsService } from './credentials.service';

// How far ahead of expiry to refresh, capped so short-lived tokens (e.g. in tests) still work.
const REFRESH_BUFFER_MS = 10000;
const MIN_DELAY_MS = 1000;

@Injectable({
  providedIn: 'root'
})
export class TokenRefreshService {

  private timerId: any;
  private readonly jwtHelper = new JwtHelperService();

  constructor(
    private authService: AuthService,
    private credService: CredentialsService) {}

  /** Call on app init to resume silent refresh for an already-stored token (e.g. after a page reload). */
  scheduleFromStoredToken() {
    const token = this.credService.credentials;
    if (token && !this.jwtHelper.isTokenExpired(token)) {
      this.schedule(token);
    }
  }

  schedule(token: string) {
    this.cancel();

    const expiryDate = this.jwtHelper.getTokenExpirationDate(token);
    if (!expiryDate) {
      return;
    }

    const msUntilExpiry = expiryDate.getTime() - Date.now();
    const buffer = Math.min(REFRESH_BUFFER_MS, msUntilExpiry * 0.2);
    const delay = Math.max(msUntilExpiry - buffer, MIN_DELAY_MS);

    this.timerId = setTimeout(() => this.refresh(), delay);
  }

  cancel() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private refresh() {
    this.authService.refresh().subscribe({
      next: (res: any) => {
        const newToken = typeof res === 'string' ? res : res?.token;
        if (newToken) {
          this.credService.setCredentials(newToken);
          this.schedule(newToken);
        }
      },
      // If the refresh call fails (e.g. offline), do nothing here - the token will
      // eventually expire and the next real API call is caught by AuthTokenInterceptor,
      // which logs the user out as before.
      error: () => {}
    });
  }
}
