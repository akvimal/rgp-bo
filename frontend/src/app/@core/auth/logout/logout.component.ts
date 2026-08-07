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
            this.tokenRefreshService.cancel();
            this.credService.clearCredentials();
            this.authService.setPermissions([]);
            localStorage.removeItem('selected_store_id');
            localStorage.removeItem('selected_operator_id');
            localStorage.removeItem('selected_operator_name');
            this.router.navigateByUrl('/login',{replaceUrl:true});
        }
}
