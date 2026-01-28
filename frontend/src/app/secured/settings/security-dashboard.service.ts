import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  UserWithExpiredPassword,
  LockedAccount,
  InactiveUser,
  PasswordPolicy
} from './components/security-dashboard.component';

@Injectable({
  providedIn: 'root'
})
export class SecurityDashboardService {

  private readonly baseUrl = `${environment.apiHost}/auth/security`;

  constructor(private http: HttpClient) {}

  getUsersWithExpiredPasswords(): Observable<UserWithExpiredPassword[]> {
    return this.http.get<UserWithExpiredPassword[]>(`${this.baseUrl}/expired-passwords`);
  }

  getLockedAccounts(): Observable<LockedAccount[]> {
    return this.http.get<LockedAccount[]>(`${this.baseUrl}/locked-accounts`);
  }

  getInactiveUsers(days: number): Observable<InactiveUser[]> {
    return this.http.get<InactiveUser[]>(`${this.baseUrl}/inactive-users/${days}`);
  }

  getPasswordPolicy(): Observable<PasswordPolicy> {
    return this.http.get<PasswordPolicy>(`${this.baseUrl}/password-policy`);
  }

  unlockAccount(userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/unlock-account/${userId}`, {});
  }

  forcePasswordChange(userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/force-password-change/${userId}`, {});
  }
}
