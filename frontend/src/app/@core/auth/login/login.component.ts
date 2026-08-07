import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { UsersService } from "src/app/secured/settings/users/users.service";
import { AuthService } from "../auth.service";
import { CredentialsService } from "../credentials.service";
import { OperatorContextService } from "../../operator-context.service";
import { TokenRefreshService } from "../token-refresh.service";

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html'
})
export class LoginComponent {

    error:any;

    form = new FormGroup({
        email: new FormControl('',Validators.required),
        password: new FormControl('',Validators.required)
    });

    constructor(
        private router: Router,
        private authService: AuthService,
        private userService: UsersService,
        private credService: CredentialsService,
        private operatorContext: OperatorContextService,
        private tokenRefreshService: TokenRefreshService){}

    ngOnInit(){
        this.credService.clearCredentials();
        this.operatorContext.clear();
    }
    
    onSubmit(){
        // console.log(this.form.value);
        this.authService.login({
                email:this.form.value.email,
                password:this.form.value.password
            }).subscribe({
                    next: data => {
                        this.credService.setCredentials(data['token']);
                        this.tokenRefreshService.schedule(data['token']);
                        this.userService.getCurrentUser().subscribe((data:any) => {
                                if(data.rolename && data.permissions){
                                    this.authService.setPermissions(data.permissions);
                                    const landing_page = data.permissions[0]['path'][0]
                                    this.router.navigate([landing_page]); //TODO: redirect to path accessed    
                                }
                                else {
                                    this.error = 'Unauthorized Access. Please Contact Admin!!'
                                }
                            });
                    }, 
                    error : err => {
                        this.form.controls['password'].reset();
                        this.error = err.message;
                    }
                });
    }
}