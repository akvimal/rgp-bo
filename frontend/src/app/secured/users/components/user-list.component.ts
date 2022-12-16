import { Component } from "@angular/core";
import { UsersService } from "../users.service";

@Component({
    templateUrl: 'user-list.component.html'
})
export class UserListComponent {
    
    users:any;

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
        });
    }
}