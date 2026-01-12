import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

import { CredentialsService } from './credentials.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor (
    private router: Router, 
    private authService: AuthService,
    private credentialsService: CredentialsService) {
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    console.log('AuthGuard.canActivate called for URL:', state.url);
    console.log('isAuthenticated:', this.credentialsService.isAuthenticated());
    console.log('Current permissions:', this.authService.getPermissions());

    const authorized = this.authService.isUrlAuthorized(state.url);
    console.log('isUrlAuthorized result:', authorized);

    if (!this.credentialsService.isAuthenticated() || !authorized) {
      console.log('NOT AUTHORIZED - redirecting to /login');
      this.router.navigate(['/login']);
      return false;
    }
    console.log('AUTHORIZED - allowing navigation');
    return true;
  }

}
