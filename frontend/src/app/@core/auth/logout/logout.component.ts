import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { CredentialsService } from "../credentials.service";

@Component({
    selector: 'app-logout',
    template: ''
})
export class LogoutComponent {
    
    constructor(
        private credService:CredentialsService,
        private router:Router){
            
        }

        ngOnInit(){
            this.credService.clearCredentials();
            this.router.navigateByUrl('/login',{replaceUrl:true});
        }
}