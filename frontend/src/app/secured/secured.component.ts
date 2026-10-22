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
import { ShiftContextService } from "../@core/shift-context.service";
import { AuthService } from "../@core/auth/auth.service";

@Component({
    templateUrl: 'secured.component.html'
})
export class SecuredComponent {
  
    user:any;
    stores:any[] = [];

    get singleStore():any {
      return !this.allStores && this.stores.length === 1 ? this.stores[0] : null;
    }

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

    sidebarCollapsed:boolean = false;
    sidebarDrawerOpen:boolean = false;
    settingsMenuOpen:boolean = false;
    userMenuOpen:boolean = false;
    
    constructor(
      private appStateService:AppStateService,
      private customerService:CustomersService,
      private userService:UsersService, private titleService: Title,
      private router: Router,
      private storeContextService: StoreContextService,
      private operatorContextService: OperatorContextService,
      public shiftContext: ShiftContextService,
      private authService: AuthService){
        this.state$ = this.appStateService.state;
    }

    /** show the header shift pill for roles that run a cash drawer once a specific store is picked */
    get shiftPillVisible(): boolean {
      return !this.isSiteAdmin
        && this.selectedStoreId !== null && this.selectedStoreId !== undefined
        && (this.authService.isActionAuthorized('store.shift.open')
            || this.authService.isActionAuthorized('store.shift.close')
            || this.authService.isUrlAuthorized('/secure/store/shifts'));
    }

    /** menu entries and section headings follow what the role may open */
    canOpen(url: string): boolean {
      return this.authService.isUrlAuthorized(url);
    }

    has(...keys: string[]): boolean {
      return keys.some((k) => this.authService.isActionAuthorized(k));
    }

    get shiftLink(): string {
      return this.authService.isUrlAuthorized('/secure/shift')
        ? '/secure/shift'
        : (this.authService.isUrlAuthorized('/secure/store/shifts') ? '/secure/store/shifts' : '/secure/sales/pos');
    }
    
    ngOnInit(){
      this.userService.getCurrentUser().subscribe(data => {
        this.titleService.setTitle(`RGP - ${data['fullname']}`)
        this.user = data;
        // Permissions are cached at sign-in; pick up role changes made since (new screens, revoked access).
        const fresh = data['permissions'];
        if (Array.isArray(fresh) && JSON.stringify(fresh) !== JSON.stringify(this.authService.getPermissions())) {
          this.authService.setPermissions(fresh);
          window.location.reload();
          return;
        }
        this.operatorContextService.loadOperators(this.selectedStoreId, data['id']).subscribe();
      });
      this.storeContextService.loadContext().subscribe((context:any) => {
        this.stores = context?.stores || [];
        this.allStores = !!context?.allstores;
        // A user mapped to one store has nothing to switch: pin the selection to it.
        if (this.singleStore && this.storeContextService.selectedStoreId !== Number(this.singleStore.id)) {
          this.storeContextService.setSelectedStoreId(Number(this.singleStore.id), false);
        }
        this.selectedStoreId = this.storeContextService.selectedStoreId;
      });
      this.storeContextService.selectedStoreId$.subscribe((selected:any) => {
        this.selectedStoreId = selected;
        this.operatorContextService.loadOperators(selected, this.user?.id).subscribe();
        this.shiftContext.refresh(selected);
      });
      this.customerService.findByMobile('0000000000').subscribe(data => {
        data && localStorage.setItem('nil', data['id']);
      });
      this.settingsMenuOpen = this.router.url.startsWith('/secure/settings');
      this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => {
          this.userMenuOpen = false;
          this.shiftContext.reload();
          if (this.isMobileViewport()) {
            this.sidebarDrawerOpen = false;
          }
        });

    }

    toggleSettingsMenu(){
      this.settingsMenuOpen = !this.settingsMenuOpen;
    }

    toggleUserMenu(event:Event){
      event.stopPropagation();
      this.userMenuOpen = !this.userMenuOpen;
    }

    closeUserMenu(){
      this.userMenuOpen = false;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event:Event){
      const target = event.target as HTMLElement;
      if (this.userMenuOpen && !target.closest('.nav-item.dropdown')) {
        this.userMenuOpen = false;
      }
    }

    @HostListener('document:keydown.escape')
    onEscape(){
      this.userMenuOpen = false;
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
