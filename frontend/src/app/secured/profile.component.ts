import { Component } from "@angular/core";
import { AppStateService } from "../shared/appstate.service";

@Component({
    template: `User Profile`
})
export class ProfileComponent {

    constructor(private appStateService:AppStateService){}

    ngOnInit(){
        this.appStateService.state.next({title:'My Profile'})
    }
}