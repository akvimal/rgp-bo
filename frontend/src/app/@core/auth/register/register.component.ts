import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../auth.service";

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html'
})
export class RegisterComponent {

    error: string = '';
    success: string = '';
    loading: boolean = false;
    passwordErrors: string[] = [];

    form = new FormGroup({
        name: new FormControl('', Validators.required),
        email: new FormControl('', [Validators.required, Validators.email]),
        password: new FormControl('', Validators.required),
        acceptTerms: new FormControl(false, Validators.requiredTrue)
    });

    constructor(private router:Router, private service:AuthService){}

    onSubmit(){
        if (!this.form.valid) {
            return;
        }

        this.error = '';
        this.passwordErrors = [];
        this.loading = true;

        this.service.register({
            name: this.form.value.name,
            email: this.form.value.email,
            password: this.form.value.password
        }).subscribe({
            next: data => {
                this.loading = false;
                this.success = 'Account created successfully! Redirecting to login...';
                setTimeout(() => {
                    this.router.navigate(['/login']);
                }, 2000);
            },
            error: err => {
                this.loading = false;
                console.error('Registration error:', err);

                // Handle password policy violation
                if (err.status === 400 && err.error?.errors && Array.isArray(err.error.errors)) {
                    this.error = err.error.message || 'Password does not meet policy requirements';
                    this.passwordErrors = err.error.errors;
                } else {
                    this.error = err.error?.message || err.message || 'Registration failed';
                }
            }
        })
      }
}