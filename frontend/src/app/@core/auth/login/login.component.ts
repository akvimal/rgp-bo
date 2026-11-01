import { PropsService } from 'src/app/shared/props.service';
import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
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
    /** the platform-administration page: dark, no business branding, Site Admin only */
    platform = false;

    form = new FormGroup({
        email: new FormControl('',Validators.required),
        password: new FormControl('',Validators.required)
    });

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private authService: AuthService,
        private userService: UsersService,
        private credService: CredentialsService,
        private operatorContext: OperatorContextService,
        private tokenRefreshService: TokenRefreshService,
        private propsService: PropsService){}

    ngOnInit(){
        this.platform = !!this.route.snapshot.data['platform'];
        this.credService.clearCredentials();
        this.operatorContext.clear();
    }
    
    /**
     * Land on the dashboard whenever the role can see it, otherwise fall back to
     * the first permitted path. The `site` permission's path list is the source
     * of truth for a role's home area, but its order is not reliable (some roles
     * list the dashboard after settings pages) so we look for it explicitly.
     */
    private resolveLandingPage(permissions:any[]):string {
        const site = (permissions || []).find((p:any) => p.resource === 'site');
        const dashboard = (site?.path || []).find((path:string) => path === '/secure/dashboard' || path.endsWith('/dashboard'));
        return dashboard || permissions[0]['path'][0];
    }

    /** which part of the sign-in the person is on: the password, the code from their app, linking an app for the first time, or saving the recovery codes */
    step: 'password' | 'code' | 'setup' | 'recovery' = 'password';
    mfaToken = '';
    mfaError = '';
    busy = false;
    useRecovery = false;
    setup: any = null;
    recoveryCodes: string[] = [];
    private pendingToken = '';
    codeControl = new FormControl('', Validators.required);

    get title(): string {
        if (this.step === 'code') return 'Enter your code';
        if (this.step === 'setup') return 'Link your authenticator app';
        if (this.step === 'recovery') return 'Save your recovery codes';
        return this.platform ? 'Sign in to platform administration' : 'Sign in';
    }

    onSubmit(){
        this.authService.login({
                email:this.form.value.email,
                password:this.form.value.password,
                scope:this.platform ? 'platform' : 'business'
            }).subscribe({
                    next: data => {
                        if (data['mfaRequired']) {
                            this.mfaToken = data['mfaToken'];
                            this.step = 'code';
                            return;
                        }
                        if (data['mfaSetupRequired']) {
                            this.mfaToken = data['mfaToken'];
                            this.startSetup();
                            return;
                        }
                        this.finishLogin(data['token']);
                    },
                    error : err => {
                        this.form.controls['password'].reset();
                        this.error = err.message;
                    }
                });
    }

    private finishLogin(token:string){
        this.authService.setLoginScope(this.platform);
        this.credService.setCredentials(token);
        this.tokenRefreshService.schedule(token);
        this.userService.getCurrentUser().subscribe((data:any) => {
                if(data.rolename && data.permissions){
                    this.authService.setPermissions(data.permissions);
                    this.authService.setModules(data.modules);
                    this.authService.setBusiness(data.businesstype, data.packs);
                    this.authService.setGst(data.gst);
                    this.propsService.refresh();
                    this.authService.setPlatform(data.platform);
                    this.router.navigate([this.resolveLandingPage(data.permissions)]);
                }
                else {
                    this.step = 'password';
                    this.error = 'Unauthorized Access. Please Contact Admin!!'
                }
            });
    }

    private message(err:any, fallback:string): string {
        if (err?.status === 0) return 'Cannot reach the server. Check your connection.';
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    /** the step token lasts 5 minutes: when it runs out the person starts again from the password */
    private expired(err:any): boolean {
        return err?.status === 401 && /expired/i.test(String(err?.error?.message || ''));
    }

    private backToPassword(note:string){
        this.step = 'password';
        this.mfaToken = '';
        this.setup = null;
        this.codeControl.reset('');
        this.form.controls['password'].reset();
        this.mfaError = '';
        this.error = note;
    }

    /** step 2: the code from the authenticator app, or a recovery code */
    onCode(){
        const code = String(this.codeControl.value || '').trim();
        if (!code || this.busy) return;
        this.busy = true;
        this.mfaError = '';
        this.authService.mfaVerify(this.mfaToken, code).subscribe({
            next: (data:any) => {
                this.busy = false;
                this.finishLogin(data['token']);
            },
            error: err => {
                this.busy = false;
                if (this.expired(err)) return this.backToPassword('That sign-in timed out. Enter your password again.');
                this.mfaError = this.message(err, 'That code is not right. Try again.');
                this.codeControl.reset('');
            }
        });
    }

    toggleRecovery(){
        this.useRecovery = !this.useRecovery;
        this.codeControl.reset('');
        this.mfaError = '';
    }

    /** first sign-in with MFA required: ask for a new secret and show its QR code */
    private startSetup(){
        this.step = 'setup';
        this.mfaError = '';
        this.codeControl.reset('');
        this.authService.mfaSetup(this.mfaToken).subscribe({
            next: (data:any) => this.setup = data,
            error: err => {
                if (this.expired(err)) return this.backToPassword('That sign-in timed out. Enter your password again.');
                this.mfaError = this.message(err, 'Could not start the set-up. Try again.');
            }
        });
    }

    /** a code from the new app confirms the link; the recovery codes come back once */
    onEnable(){
        const code = String(this.codeControl.value || '').trim();
        if (!code || this.busy) return;
        this.busy = true;
        this.mfaError = '';
        this.authService.mfaEnable(this.mfaToken, code).subscribe({
            next: (data:any) => {
                this.busy = false;
                this.pendingToken = data['token'];
                this.recoveryCodes = data['recoveryCodes'] || [];
                this.step = 'recovery';
            },
            error: err => {
                this.busy = false;
                if (this.expired(err)) return this.backToPassword('That sign-in timed out. Enter your password again.');
                this.mfaError = this.message(err, 'That code is not right. Try again.');
                this.codeControl.reset('');
            }
        });
    }

    copyRecoveryCodes(){
        try { navigator.clipboard.writeText(this.recoveryCodes.join('\n')); } catch { /* the codes are on screen to copy by hand */ }
    }

    downloadRecoveryCodes(){
        const blob = new Blob([`Recovery codes (each works once)\n\n${this.recoveryCodes.join('\n')}\n`], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'recovery-codes.txt';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    /** the codes are saved: go in */
    recoveryDone(){
        this.recoveryCodes = [];
        this.finishLogin(this.pendingToken);
        this.pendingToken = '';
    }

    cancelMfa(){
        this.backToPassword('');
    }
}
