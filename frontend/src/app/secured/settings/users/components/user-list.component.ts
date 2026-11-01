import { Component } from "@angular/core";
import { UsersService } from "../users.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { AuthService } from "src/app/@core/auth/auth.service";
import { HrService } from "../../../hr/hr.service";

@Component({
    templateUrl: 'user-list.component.html'
})
export class UserListComponent {

    users:any;
    /** why the last removal was refused, shown above the list */
    removeMessage = '';
    /** where the HR module is off, the owner keeps a few staff details here (pharmacist registration, joining date, emergency contact) */
    details:{[userId:number]:any} = {};
    attention = 0;
    get showDetails():boolean { return !this.auth.moduleOn('hr'); }

    detailOf(userId:number){ return this.details[userId]; }

    regLabel(d:any):string {
        if (!d || d.reg_status === 'NONE') return '';
        return d.reg_status === 'EXPIRED' ? 'Lapsed' : d.reg_status === 'EXPIRING' ? 'Lapses ' + d.pharmacist_valid_to : 'Registered';
    }

    regClass(d:any):string {
        return d?.reg_status === 'EXPIRED' ? 'bg-danger' : d?.reg_status === 'EXPIRING' ? 'bg-warning text-dark' : 'bg-success';
    }

    loadDetails(){
        if (!this.showDetails) return;
        this.service.staffDetails().subscribe((r:any) => {
            this.details = {};
            (r.people || []).forEach((p:any) => this.details[p.user_id] = p);
            this.attention = r.attention || 0;
        }, () => {});
    }

    /** who has an authenticator app linked (two-step sign-in) */
    mfaByUser:{[userId:number]:boolean} = {};
    mfaMessage = '';

    loadMfa(){
        this.auth.mfaStatus().subscribe((rows:any[]) => {
            this.mfaByUser = {};
            (rows || []).forEach(r => this.mfaByUser[r.id] = !!r.enabled);
        }, () => {});
    }

    /** a lost phone: unlink the authenticator, and the person links a new one at their next sign-in */
    resetMfa(user:any){
        this.confirm.confirmAction('Reset two-step sign-in',
            ['They sign in with their password, then link an authenticator app again.', 'Their recovery codes stop working.'],
            'Reset', () => {
                this.mfaMessage = '';
                this.auth.mfaReset(user.id).subscribe(() => {
                    this.mfaMessage = `Two-step sign-in reset for ${user.fullname}. They link a new app at their next sign-in.`;
                    this.loadMfa();
                }, (e:any) => {
                    const m = e?.error?.message;
                    this.mfaMessage = (Array.isArray(m) ? m.join(' ') : m) || 'Could not reset it.';
                });
            }, `Reset the authenticator of ${user.fullname}?`);
    }

    private staffByUser:{[userId:number]:any} = {};

    constructor(private service:UsersService, private confirm:ConfirmService, private auth:AuthService, private hr:HrService){}

    staffOf(userId:number){ return this.staffByUser[userId]; }

    ngOnInit(){
        this.fetchList();
        this.loadDetails();
        this.loadMfa();
        // the staff link is the Business Head's HR data; only ask when the role may see it
        if (this.auth.isActionAuthorized('hr.view')) {
            this.hr.get('staff').subscribe((rows:any[]) => {
                this.staffByUser = {};
                (rows || []).forEach(r => this.staffByUser[r.user_id] = r);
            }, () => {});
        }
    }

    delete(user:any){
        this.confirm.confirmDelete(user?.fullname, () => {
            this.removeMessage = '';
            this.service.remove(user.id).subscribe(() => this.fetchList(), (e:any) => {
                // the server says why (your own account, the only head of the business, another business): show it instead of failing silently
                const m = e?.error?.message;
                this.removeMessage = (Array.isArray(m) ? m.join(' ') : m) || 'The user could not be removed.';
            });
        }, { entity: 'user', consequence: 'They will no longer be able to sign in; historical records are kept.' });
    }

    fetchList(){
        this.service.findAll().subscribe((data:any) => {
            this.users = data.map((d:any) => {
                return {...d,permissions:JSON.stringify(d.permissions)}
            });
        });
    }
}
