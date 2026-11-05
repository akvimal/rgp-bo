import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../auth.service";
import { CredentialsService } from "../credentials.service";
import { TokenRefreshService } from "../token-refresh.service";

@Component({
    selector: 'app-logout',
    template: ''
})
export class LogoutComponent {
    
    constructor(
        private credService:CredentialsService,
        private authService:AuthService,
        private tokenRefreshService:TokenRefreshService,
        private router:Router){

        }

        ngOnInit(){
            const back = this.authService.loginUrl();
            this.tokenRefreshService.cancel();
            this.credService.clearCredentials();
            this.authService.setPermissions([]);
            localStorage.removeItem('selected_store_id');
            localStorage.removeItem('selected_operator_id');
            localStorage.removeItem('selected_operator_name');
            // ?manual=1: the sign-in page does not sign a registered PC's Counter login back in by itself, so someone else can sign in
            this.router.navigateByUrl(`${back}?manual=1`,{replaceUrl:true});
        }
}
