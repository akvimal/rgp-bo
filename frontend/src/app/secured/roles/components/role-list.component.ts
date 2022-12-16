import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { RolesService } from "../roles.service";

@Component({
    templateUrl: 'role-list.component.html'
})
export class RoleListComponent {
    
    roles:any;

    constructor(private service:RolesService, private router:Router){}

    ngOnInit(){ 
        this.fetchList();
    }

    delete(id:number){
        this.service.remove(id).subscribe(data => this.fetchList() )
    }

    fetchList(){
        this.service.findAll().subscribe((data:any) => {
            this.roles = data.map((d:any) => {
                return {...d,permissions:JSON.stringify(d.permissions)}
            });
        });
    }
}