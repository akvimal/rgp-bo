import { Component } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { Observable } from "rxjs";
import { AppState } from "../shared/app-state";
import { AppStateService } from "../shared/appstate.service";
import { CustomersService } from "./customers/customers.service";
import { UsersService } from "./settings/users/users.service";

@Component({
    templateUrl: 'secured.component.html'
})
export class SecuredComponent {
  
    user:any;
    state$!:Observable<AppState>;

    pricing:boolean = false;
    
    constructor(
      private appStateService:AppStateService, 
      private customerService:CustomersService,
      private userService:UsersService, private titleService: Title){
        this.state$ = this.appStateService.state;
    }
    
    ngOnInit(){
      this.userService.getCurrentUser().subscribe(data => {
        this.titleService.setTitle(`RGP - ${data['fullname']}`)
        this.user = data;
      });
      this.customerService.findByMobile('0000000000').subscribe(data => {
        data && localStorage.setItem('nil', data['id']); 
      });
      
    }

    openPricing(){
      this.pricing = true;
    }
}