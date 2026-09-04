import { Component } from "@angular/core";
import { AppStateService } from "../shared/appstate.service";
import { UsersService } from "./settings/users/users.service";
import { StoreContextService } from "../@core/store-context.service";

@Component({
    templateUrl: './profile.component.html'
})
export class ProfileComponent {

    user:any = {};
    stores:any[] = [];

    constructor(
        private appStateService:AppStateService,
        private usersService:UsersService,
        private storeContext:StoreContextService
    ){}

    ngOnInit(){
        this.appStateService.state.next({title:'My Profile'});
        this.usersService.getCurrentUser().subscribe((data:any) => this.user = data || {});
        this.stores = this.storeContext.stores || [];
    }

    get initials():string {
        const name = (this.user?.fullname || '').trim();
        if(!name){ return '?'; }
        return name.split(/\s+/).map((p:string) => p[0]).slice(0,2).join('').toUpperCase();
    }
}
