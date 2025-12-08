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
            this.roles = data;
        });
    }

    getPermissionSummary(permissionsString: string): string {
        if (!permissionsString) return 'No permissions';

        try {
            const permissions = typeof permissionsString === 'string'
                ? JSON.parse(permissionsString)
                : permissionsString;

            if (!Array.isArray(permissions) || permissions.length === 0) {
                return 'No permissions';
            }

            const resourceNames = permissions.map((p: any) => {
                const resource = p.resource || '';
                return resource.charAt(0).toUpperCase() + resource.slice(1);
            });

            if (resourceNames.length === 0) return 'No permissions';
            if (resourceNames.length <= 3) {
                return resourceNames.join(', ');
            }

            return `${resourceNames.slice(0, 3).join(', ')} +${resourceNames.length - 3} more`;
        } catch (e) {
            return 'Invalid permissions';
        }
    }

    getResourceBadges(permissionsString: string): any[] {
        if (!permissionsString) return [];

        try {
            const permissions = typeof permissionsString === 'string'
                ? JSON.parse(permissionsString)
                : permissionsString;

            if (!Array.isArray(permissions)) return [];

            return permissions.map((p: any) => ({
                name: p.resource || '',
                label: (p.resource || '').charAt(0).toUpperCase() + (p.resource || '').slice(1),
                count: p.policies ? p.policies.length : 0
            }));
        } catch (e) {
            return [];
        }
    }
}