import { Component } from "@angular/core";
import { Observable } from "rxjs";
import { AppState } from "../shared/app-state";
import { AppStateService } from "../shared/appstate.service";
import { UsersService } from "./settings/users/users.service";

@Component({
    templateUrl: 'secured.component.html'
})
export class SecuredComponent {
  
    // showUserPopup = false;
    user:any;
    state$!:Observable<AppState>;

    pricing:boolean = false;
    
    constructor(
      private appStateService:AppStateService, 
      private userService:UsersService){
        this.state$ = this.appStateService.state;
      }
    
    ngOnInit(){
      this.userService.getCurrentUser().subscribe(data => this.user = data);
    }
    
    // showDialog(){
    //   this.showUserPopup = true;
    // }

    openPricing(){
      this.pricing = true;
    }
}