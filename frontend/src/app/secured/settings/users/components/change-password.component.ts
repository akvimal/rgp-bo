import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/@core/auth/auth.service';
import { CredentialsService } from 'src/app/@core/auth/credentials.service';
import { UsersService } from '../users.service';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss']
})
export class ChangePasswordComponent {

  error: string = '';
  success: string = '';
  loading: boolean = false;
  currentUser: any = null;

  form = new FormGroup({
    currentPassword: new FormControl('', Validators.required),
    newPassword: new FormControl('', Validators.required),
    confirmPassword: new FormControl('', Validators.required)
  });

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UsersService,
    private credService: CredentialsService
  ) {}

  ngOnInit() {
    // Get current user info
    this.userService.getCurrentUser().subscribe({
      next: (user: any) => {
        this.currentUser = user;
      },
      error: (err) => {
        console.error('Failed to get current user:', err);
        this.error = 'Failed to load user information';
      }
    });
  }

  get passwordsMatch(): boolean {
    const newPassword = this.form.value.newPassword;
    const confirmPassword = this.form.value.confirmPassword;
    return newPassword === confirmPassword;
  }

  get showPasswordMismatch(): boolean {
    const confirmControl = this.form.controls.confirmPassword;
    return confirmControl.dirty && confirmControl.value !== '' && !this.passwordsMatch;
  }

  onSubmit() {
    this.error = '';
    this.success = '';

    // Validate passwords match
    if (!this.passwordsMatch) {
      this.error = 'New password and confirm password do not match';
      return;
    }

    if (!this.currentUser || !this.currentUser.email) {
      this.error = 'User information not available. Please refresh the page.';
      return;
    }

    this.loading = true;

    const payload = {
      email: this.currentUser.email,
      password: this.form.value.currentPassword,
      newpassword: this.form.value.newPassword
    };

    this.authService.changepwd(payload).subscribe({
      next: (response) => {
        this.loading = false;
        this.success = 'Password changed successfully!';
        this.form.reset();

        // Update token if returned
        if (response.token) {
          this.credService.setCredentials(response.token);
        }

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        console.error('Change password error:', err);

        // Handle different error types from backend
        if (err.status === 400) {
          // Password policy violation or password reuse
          if (err.error?.errors && Array.isArray(err.error.errors)) {
            this.error = err.error.message + ':\n' + err.error.errors.join('\n');
          } else {
            this.error = err.error?.message || 'Password does not meet requirements';
          }
        } else if (err.status === 401) {
          // Current password incorrect
          this.error = 'Current password is incorrect';
        } else {
          this.error = err.error?.message || err.message || 'Failed to change password';
        }
      }
    });
  }

  cancel() {
    this.router.navigate(['/']);
  }
}
