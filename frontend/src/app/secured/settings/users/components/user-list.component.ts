import { Component } from "@angular/core";
import { UsersService } from "../users.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    templateUrl: 'user-list.component.html'
})
export class UserListComponent {

    users:any;

    constructor(private service:UsersService, private confirm:ConfirmService){}

    ngOnInit(){
        this.fetchList();
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
