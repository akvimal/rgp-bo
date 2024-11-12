import { Component } from "@angular/core";
import { AppStateService } from "src/app/shared/appstate.service";
import { RolesService } from "../roles.service";

@Component({
    templateUrl: './roles.component.html'
})
export class RolesComponent {

    constructor(private appStateService:AppStateService){}

    ngOnInit(){
        this.appStateService.state.next({title:'Roles'})
    }
}