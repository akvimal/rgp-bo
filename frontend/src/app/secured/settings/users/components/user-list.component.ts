import { Component } from "@angular/core";
import { UsersService } from "../users.service";

@Component({
    templateUrl: 'user-list.component.html'
})
export class UserListComponent {

    users:any;
    userRoles:any = {};  // Map of userId -> roles array

    constructor(private service:UsersService){}

    ngOnInit(){
        this.fetchList();
    }

    delete(id:number){
        this.service.remove(id).subscribe(data => this.fetchList() )
    }

    fetchList(){
        this.service.findAll().subscribe((data:any) => {
            this.users = data.map((d:any) => {
                return {...d,permissions:JSON.stringify(d.permissions)}
            });

            // Load roles for each user
            this.users.forEach((user:any) => {
                this.loadUserRoles(user.id);
            });
        });
    }

    loadUserRoles(userId: number) {
        this.service.getUserRoles(userId).subscribe({
            next: (roles:any) => {
                this.userRoles[userId] = roles;
            },
            error: (error:any) => {
                console.error(`Error loading roles for user ${userId}:`, error);
                this.userRoles[userId] = [];
            }
        });
    }

    getRolesForUser(userId: number): any[] {
        return this.userRoles[userId] || [];
    }
}