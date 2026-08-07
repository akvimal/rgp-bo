import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { RolesService } from "../roles.service";
import { PERMISSION_CATALOG } from "../permission-catalog";

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
            this.roles = (data || []).map((d:any) => {
                return {...d, resourceLabels: this.summarize(d.permissions)};
            });
        });
    }

    private summarize(permissions:any[]): string[] {
        const skip = new Set(['site', 'settings']);
        const catalogLabels: {[key:string]:string} = {};
        PERMISSION_CATALOG.forEach(r => catalogLabels[r.key] = r.label);
        return (permissions || [])
            .filter((p:any) => !skip.has(p.resource))
            .map((p:any) => catalogLabels[p.resource] || p.resource);
    }
}