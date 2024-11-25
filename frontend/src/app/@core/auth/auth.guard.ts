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
    // console.log('authorizing ...',state);
    
    const authorized = this.authService.isUrlAuthorized(state.url);
    // console.log('authorized: ',authorized);
    
    if (!this.credentialsService.isAuthenticated() || !authorized) {
      this.router.navigate(['/login']);
    }
    return true;
  }

}
