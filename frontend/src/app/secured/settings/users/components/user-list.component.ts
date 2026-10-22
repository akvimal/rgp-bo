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
    private staffByUser:{[userId:number]:any} = {};

    constructor(private service:UsersService, private confirm:ConfirmService, private auth:AuthService, private hr:HrService){}

    staffOf(userId:number){ return this.staffByUser[userId]; }

    ngOnInit(){
        this.fetchList();
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
