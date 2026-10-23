import { Component } from "@angular/core";
import { UsersService } from "../users.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { AuthService } from "src/app/@core/auth/auth.service";
import { HrService } from "../../../hr/hr.service";
import { staffDetailsBody, staffDetailsModel } from "./staff-details-fields.component";

@Component({
    templateUrl: 'user-list.component.html'
})
export class UserListComponent {

    users:any;
    /** where the HR module is off, the owner keeps a few staff details here (pharmacist registration, joining date, emergency contact) */
    details:{[userId:number]:any} = {};
    attention = 0;
    editing:any = null;
    saving = false;
    message = '';
    error = '';
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

    openDetails(p:any){
        this.message = this.error = '';
        this.editing = { id: p.id, name: p.fullname, pharmacy: this.details[p.id]?.pharmacy !== false, ...staffDetailsModel(this.details[p.id]) };
    }

    saveDetails(){
        const e = this.editing;
        this.saving = true; this.message = this.error = '';
        const body = staffDetailsBody(e, e.pharmacy !== false);
        if (!body) { this.saving = false; this.error = 'Nothing to save yet.'; return; }
        const { id, name } = e;
        this.service.saveStaffDetails(id, body).subscribe((r:any) => {
            this.saving = false; this.message = `Saved for ${name}.`; this.editing = null; this.loadDetails();
        }, (err:any) => { this.saving = false; const m = err?.error?.message; this.error = Array.isArray(m) ? m.join(' ') : (m || 'Could not save.'); });
    }
    private staffByUser:{[userId:number]:any} = {};

    constructor(private service:UsersService, private confirm:ConfirmService, private auth:AuthService, private hr:HrService){}

    staffOf(userId:number){ return this.staffByUser[userId]; }

    ngOnInit(){
        this.fetchList();
        this.loadDetails();
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
            this.service.remove(user.id).subscribe(() => this.fetchList());
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
