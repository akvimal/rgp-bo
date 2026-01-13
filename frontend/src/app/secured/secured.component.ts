import { Component } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { Observable } from "rxjs";
import { AppState } from "../shared/app-state";
import { AppStateService } from "../shared/appstate.service";
import { CustomersService } from "./customers/customers.service";
import { UsersService } from "./settings/users/users.service";

@Component({
    templateUrl: 'secured.component.html',
    styleUrls: ['./secured.component.scss']
})
export class SecuredComponent {

    user:any;
    state$!:Observable<AppState>;

    pricing:boolean = false;

    constructor(
      private appStateService:AppStateService,
      private customerService:CustomersService,
      private userService:UsersService,
      private titleService: Title,
      private router: Router){
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

      // Auto-expand menu based on current route
      this.autoExpandMenu();
    }

    openPricing(){
      this.pricing = true;
    }

    autoExpandMenu() {
      const currentUrl = this.router.url;

      // Map routes to menu IDs
      const routeMenuMap: { [key: string]: string } = {
        '/sales': 'operationsMenu',
        '/purchases': 'operationsMenu',
        '/inventory': 'operationsMenu',
        '/returns': 'operationsMenu',
        '/customers': 'stakeholdersMenu',
        '/vendors': 'stakeholdersMenu',
        '/products': 'stakeholdersMenu',
        '/store': 'storeMenu',
        '/documents': 'storeMenu',
        '/hr/': 'hrMenu',
        '/payroll': 'financeMenu',
        '/finance': 'financeMenu',
        '/reports': 'reportsMenu',
        '/settings': 'adminMenu'
      };

      // Find matching menu and expand it
      for (const [route, menuId] of Object.entries(routeMenuMap)) {
        if (currentUrl.includes(route)) {
          setTimeout(() => {
            const menuElement = document.getElementById(menuId);
            if (menuElement) {
              menuElement.classList.add('show');
              // Also update the parent link to not be collapsed
              const parentLink = menuElement.previousElementSibling;
              if (parentLink) {
                parentLink.classList.remove('collapsed');
              }
            }
          }, 100);
          break;
        }
      }
    }
}