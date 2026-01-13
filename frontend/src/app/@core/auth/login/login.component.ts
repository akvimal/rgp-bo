import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { UsersService } from "src/app/secured/settings/users/users.service";
import { AuthService } from "../auth.service";
import { CredentialsService } from "../credentials.service";

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
        private credService: CredentialsService){}

    ngOnInit(){
        this.credService.clearCredentials();
    }
    
    onSubmit(){
        // console.log(this.form.value);
        this.authService.login({
                email:this.form.value.email,
                password:this.form.value.password
            }).subscribe({
                    next: data => {
                        console.log('Login successful, token received:', data['token']);
                        this.credService.setCredentials(data['token']);
                        this.userService.getCurrentUser().subscribe({
                            next: (data:any) => {
                                console.log('Current user data:', data);
                                console.log('Has rolename?', !!data.rolename);
                                console.log('Has permissions?', !!data.permissions);
                                if(data.rolename && data.permissions){
                                    console.log('Permissions array:', data.permissions);
                                    this.authService.setPermissions(data.permissions);
                                    const landing_page = data.permissions[0]['path'][0]
                                    console.log('Landing page:', landing_page);
                                    console.log('Permissions in authService after set:', this.authService.getPermissions());
                                    console.log('Navigating to:', landing_page);
                                    this.router.navigate([landing_page]).then(
                                        success => console.log('Navigation success:', success),
                                        error => console.error('Navigation failed:', error)
                                    ); //TODO: redirect to path accessed
                                }
                                else {
                                    console.error('Missing rolename or permissions!');
                                    this.error = 'Unauthorized Access. Please Contact Admin!!'
                                }
                            },
                            error: (err) => {
                                console.error('getCurrentUser error:', err);
                                this.error = 'Failed to get user information: ' + err.message;
                            }
                        });
                    },
                    error : err => {
                        console.error('Login error:', err);
                        this.form.controls['password'].reset();
                        this.error = err.message;
                    }
                });
    }
}