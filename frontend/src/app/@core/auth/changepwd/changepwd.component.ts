import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../auth.service";

/** Change password: the same frame, fields and messages as sign in. */
@Component({
    templateUrl: './changepwd.component.html'
})
export class ChangePwdComponent implements OnInit {

    readonly minLength = 8;

    /** the platform-administration look, when you arrive from that sign-in page */
    platform = false;
    error = '';
    done = false;
    busy = false;

    form = new FormGroup({
        email: new FormControl('', Validators.required),
        password: new FormControl('', Validators.required),
        newpassword: new FormControl('', Validators.required),
        confirmpassword: new FormControl('', Validators.required),
    });

    constructor(private authService: AuthService, private route: ActivatedRoute, private router: Router) {}

    ngOnInit() {
        this.platform = this.route.snapshot.queryParamMap.get('scope') === 'platform' || this.authService.loginUrl() === '/platform/login';
    }

    get loginLink(): string { return this.platform ? '/platform/login' : '/login'; }

    get newTooShort(): boolean { const v = this.form.value.newpassword || ''; return v.length > 0 && v.length < this.minLength; }
    get sameAsCurrent(): boolean { const v = this.form.value; return !!v.newpassword && v.newpassword === v.password; }
    get mismatch(): boolean { const v = this.form.value; return !!v.confirmpassword && v.newpassword !== v.confirmpassword; }

    get canSubmit(): boolean {
        return this.form.valid && !this.newTooShort && !this.sameAsCurrent && !this.mismatch;
    }

    onSubmit(){
        if (!this.canSubmit) { return; }
        this.error = '';
        this.busy = true;
        this.authService.changepwd({
            email: this.form.value.email,
            password: this.form.value.password,
            newpassword: this.form.value.newpassword,
        }).subscribe({
            next: () => {
                this.busy = false;
                this.done = true;
                setTimeout(() => this.router.navigate([this.loginLink]), 1800);
            },
            error: err => {
                this.busy = false;
                const m = err?.error?.message;
                this.error = (Array.isArray(m) ? m.join(' ') : m) || 'The password could not be changed. Try again.';
                this.form.controls['password'].reset();
            },
        });
    }
}
