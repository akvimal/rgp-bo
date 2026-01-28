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

    error: any;
    accountLocked: boolean = false;
    lockoutMessage: string = '';
    passwordExpired: boolean = false;
    passwordExpiresSoon: boolean = false;
    daysUntilExpiry: number = 0;

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
        this.resetErrorState();
    }

    private resetErrorState(): void {
        this.error = null;
        this.accountLocked = false;
        this.lockoutMessage = '';
        this.passwordExpired = false;
        this.passwordExpiresSoon = false;
        this.daysUntilExpiry = 0;
    }
    
    onSubmit(){
        this.resetErrorState();

        this.authService.login({
                email:this.form.value.email,
                password:this.form.value.password
            }).subscribe({
                    next: data => {
                        console.log('Login successful, token received:', data['token']);

                        // Check for password expiry warning
                        if (data['passwordExpiresSoon']) {
                            this.passwordExpiresSoon = true;
                            this.daysUntilExpiry = data['daysUntilExpiry'] || 0;
                        }

                        this.credService.setCredentials(data['token']);
                        this.userService.getCurrentUser().subscribe({
                            next: (data:any) => {
                                console.log('Current user data:', data);
                                console.log('Has rolename?', !!data.rolename);
                                console.log('Has permissions?', !!data.permissions);
                                if(data.rolename && data.permissions){
                                    console.log('Permissions array:', data.permissions);
                                    this.authService.setPermissions(data.permissions);

                                    // Always redirect to dashboard after login
                                    const landing_page = 'secure/dashboard';
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

                        // Handle different error types from backend
                        if (err.status === 403) {
                            // Account locked
                            if (err.error?.locked) {
                                this.accountLocked = true;
                                this.lockoutMessage = err.error.message || 'Account is locked due to too many failed login attempts.';
                            }
                            // Password expired
                            else if (err.error?.passwordExpired) {
                                this.passwordExpired = true;
                                this.error = err.error.message || 'Your password has expired. Please contact your administrator to reset it.';
                            }
                            else {
                                this.error = err.error?.message || err.message || 'Access forbidden';
                            }
                        }
                        // Password policy violation (from registration attempts)
                        else if (err.status === 400 && err.error?.errors && Array.isArray(err.error.errors)) {
                            this.error = err.error.message + ': ' + err.error.errors.join(', ');
                        }
                        // Generic error
                        else {
                            this.error = err.error?.message || err.message || 'Invalid credentials';
                        }
                    }
                });
    }
}