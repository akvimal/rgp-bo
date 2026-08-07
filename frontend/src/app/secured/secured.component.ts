import { Component, HostListener } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { Title } from "@angular/platform-browser";
import { Observable } from "rxjs";
import { filter } from "rxjs/operators";
import { AppState } from "../shared/app-state";
import { AppStateService } from "../shared/appstate.service";
import { CustomersService } from "./customers/customers.service";
import { UsersService } from "./settings/users/users.service";
import { StoreContextService } from "../@core/store-context.service";
import { OperatorContextService } from "../@core/operator-context.service";

@Component({
    templateUrl: 'secured.component.html'
})
export class SecuredComponent {
  
    user:any;
    stores:any[] = [];

    get isSiteAdmin(): boolean {
      return this.user?.rolename === 'Site Admin';
    }

    get businessName(): string {
      const stores = this.storeContextService.stores || [];
      const names = Array.from(new Set(stores.map((s:any) => s.business?.name).filter((n:any) => !!n)));
      if (names.length === 0) {
        return '';
      }
      if (names.length === 1) {
        return names[0];
      }
      return this.allStores ? 'All Businesses' : 'Multiple Businesses';
    }
    selectedStoreId:number | null = null;
    allStores:boolean = false;
    state$!:Observable<AppState>;

    pricing:boolean = false;
    sidebarCollapsed:boolean = true;
    sidebarDrawerOpen:boolean = false;
    settingsMenuOpen:boolean = false;
    
    constructor(
      private appStateService:AppStateService, 
      private customerService:CustomersService,
      private userService:UsersService, private titleService: Title,
      private router: Router,
      private storeContextService: StoreContextService,
      private operatorContextService: OperatorContextService){
        this.state$ = this.appStateService.state;
    }
    
    ngOnInit(){
      this.userService.getCurrentUser().subscribe(data => {
        this.titleService.setTitle(`RGP - ${data['fullname']}`)
        this.user = data;
        this.operatorContextService.loadOperators(this.selectedStoreId, data['id']).subscribe();
      });
      this.storeContextService.loadContext().subscribe((context:any) => {
        this.stores = context?.stores || [];
        this.allStores = !!context?.allstores;
        this.selectedStoreId = this.storeContextService.selectedStoreId;
      });
      this.storeContextService.selectedStoreId$.subscribe((selected:any) => {
        this.selectedStoreId = selected;
        this.operatorContextService.loadOperators(selected, this.user?.id).subscribe();
      });
      this.customerService.findByMobile('0000000000').subscribe(data => {
        data && localStorage.setItem('nil', data['id']);
      });
      this.settingsMenuOpen = this.router.url.startsWith('/secure/settings');
      this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => {
          if (this.isMobileViewport()) {
            this.sidebarDrawerOpen = false;
          }
        });

    }

    toggleSettingsMenu(){
      this.settingsMenuOpen = !this.settingsMenuOpen;
    }

    openPricing(){
      this.pricing = true;
    }

    changeStore(event:any) {
      const value = event.target.value;
      this.storeContextService.setSelectedStoreId(value === '' ? null : Number(value));
    }

    toggleSidebar(){
      if (this.isMobileViewport()) {
        this.sidebarDrawerOpen = !this.sidebarDrawerOpen;
        return;
      }
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }

    closeSidebar(){
      this.sidebarDrawerOpen = false;
    }

    @HostListener('window:resize')
    onResize() {
      if (!this.isMobileViewport()) {
        this.sidebarDrawerOpen = false;
      }
    }

    private isMobileViewport(): boolean {
      return window.innerWidth <= 991;
    }
}
