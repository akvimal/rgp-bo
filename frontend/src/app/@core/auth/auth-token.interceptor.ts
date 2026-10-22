import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { JwtHelperService } from "@auth0/angular-jwt";
import { Observable } from "rxjs";
import { CredentialsService } from "./credentials.service";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthTokenInterceptor implements HttpInterceptor {

  constructor(
    private router:Router, private credService:CredentialsService, private authService:AuthService) {}

  intercept(request: HttpRequest<unknown>, 
    next: HttpHandler): Observable<HttpEvent<unknown>> {
      const token = this.credService.credentials;
    if (this.isTokenExpired(token)) {
      this.credService.clearCredentials();
      this.router.navigate([this.authService.loginUrl()])
    } else {
        request = request.clone({
          headers: request.headers.set('Authorization', `Bearer ${token}`)
        });
    }
    return next.handle(request);
  }

  isTokenExpired(token:any) {
    const helper = new JwtHelperService();
    return token && helper.isTokenExpired(token);
  }
  
}