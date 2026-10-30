import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { RolesService } from "../roles.service";
import { PERMISSION_CATALOG } from "../permission-catalog";
import { ConfirmService } from "src/app/shared/confirm.service";
import { AuthService } from "src/app/@core/auth/auth.service";

@Component({
    templateUrl: 'role-list.component.html'
})
export class RoleListComponent {

    roles:any;
    showUnused = false;
    /** kinds of login that exist for particular ways of running a shop: shown only once someone holds them (or on request) */
    private readonly situational = ['Owner-operator', 'Counter', 'Personal'];

    constructor(private service:RolesService, private router:Router, private confirm:ConfirmService, private auth:AuthService){}

    get visibleRoles(): any[] {
        return (this.roles || []).filter((r:any) => this.showUnused || !this.isUnused(r));
    }

    get unusedCount(): number {
        return (this.roles || []).filter((r:any) => this.isUnused(r)).length;
    }

    private isUnused(r:any): boolean {
        return this.situational.includes(r.name) && !r.usercount;
    }

    /** starter roles an owner can create in one click (none for a one-person shop) */
    offered:any[] = [];
    creating = false;
    templateError = '';

    ngOnInit(){
        this.fetchList();
        this.loadOffered();
    }

    private loadOffered(){
        this.service.templates().subscribe((t:any) => this.offered = t || [], () => this.offered = []);
    }

    createTemplate(name:string){
        this.creating = true;
        this.templateError = '';
        this.service.createTemplates([name]).subscribe(() => { this.creating = false; this.fetchList(); this.loadOffered(); },
            (err:any) => { this.creating = false; this.templateError = err?.error?.message || 'Could not create the role'; });
    }

    delete(role:any){
        this.confirm.confirmDelete(role?.name, () => {
            this.service.remove(role.id).subscribe(() => this.fetchList());
        }, { entity: 'role', consequence: 'Users assigned to it will lose its permissions.' });
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
        const available = (key:string) => this.auth.resourceAvailable(key);
        const catalogLabels: {[key:string]:string} = {};
        PERMISSION_CATALOG.forEach(r => catalogLabels[r.key] = r.label);
        return (permissions || [])
            .filter((p:any) => !skip.has(p.resource) && available(p.resource))
            .map((p:any) => catalogLabels[p.resource] || p.resource)
            .filter((label:string, i:number, all:string[]) => all.indexOf(label) === i);
    }
}