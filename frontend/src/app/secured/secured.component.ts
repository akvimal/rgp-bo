import { PropsService } from "../shared/props.service";
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
import { ConfigService } from "../shared/config.service";
import { MenuGroup, buildMenu } from "./menu";

@Component({
    templateUrl: 'secured.component.html'
})
export class SecuredComponent {
  
    user:any;
    stores:any[] = [];

    get singleStore():any {
      return !this.allStores && this.stores.length === 1 ? this.stores[0] : null;
    }

    /** how many stores the business has; with one there is nothing to choose, so the header shows no store box */
    totalStores: number | null = null;
    get hideStoreSwitcher(): boolean {
      return this.totalStores !== null && this.totalStores <= 1;
    }

    /** a hosted customer's copy shows neutral branding instead of RGP's */
    get hosted(): boolean { return !!this.platform; }
    get brandName(): string { return this.hosted ? (this.user?.businessname || this.businessName || 'Back office') : 'RGP'; }
    get initials(): string {
      const parts = String(this.user?.fullname || '?').trim().split(/\s+/).filter(Boolean);
      return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
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
    /** the hosted plan, when this is a customer's copy: shown as a notice for a trial or a stopped account */
    platform: any = null;
    get trialDaysLeft(): number {
      const end = this.platform?.trialEnds ? Date.parse(this.platform.trialEnds + 'T23:59:59') : NaN;
      return Number.isFinite(end) ? Math.max(0, Math.ceil((end - Date.now()) / 86400000)) : 0;
    }
    /** the short notice in the header: a demo or trial with its days left, or why the account has stopped */
    get platformChip(): { text: string; cls: string; title: string } | null {
      const p = this.platform;
      if (!p) return null;
      if (p.status === 'trial') {
        const left = this.trialDaysLeft;
        const days = p.trialEnds ? ` · ${left} day${left === 1 ? '' : 's'} left` : '';
        return {
          text: (p.demo ? 'Demo' : 'Trial') + days,
          cls: left <= 3 ? 'bg-danger' : 'bg-warning text-dark',
          title: (p.demo ? 'Demo account with sample data that may be reset. ' : '') + `Trial of the ${p.plan} plan` + (p.trialEnds ? ` until ${p.trialEnds}` : '') + '.',
        };
      }
      if (p.status === 'suspended' || p.status === 'closed') {
        return { text: p.reason === 'trial_ended' ? 'Trial ended' : (p.status === 'closed' ? 'Account closed' : 'Account suspended'), cls: 'bg-danger', title: 'Contact your provider to continue.' };
      }
      return null;
    }
    selectedStoreId:number | null = null;
    allStores:boolean = false;
    state$!:Observable<AppState>;

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
      private authService: AuthService,
      private propsService: PropsService,
      private config: ConfigService){
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

    /** the grouped menu is a per-business choice (dashboard settings, "The grouped menu"); off keeps the long-standing menu */
    newMenu = false;
    menuGroups: MenuGroup[] = buildMenu({ has: (...k: string[]) => this.has(...k), canOpen: (u: string) => this.canOpen(u), pack: (n: string) => this.authService.packOn(n) });

    groupVisible(g: MenuGroup): boolean {
      return g.items.some((m) => m.show());
    }

    private loadMenuChoice() {
      this.config.effective('views').subscribe({
        next: (r) => { this.newMenu = r.items.find((i) => i.key === 'new_menu')?.value === true; },
        error: () => { this.newMenu = false; },
      });
    }

    /** the pharmacy guide is shown to everyone in a pharmacy business */
    get pharmacyPack(): boolean { return this.authService.packOn('pharmacy'); }

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
        this.loadMenuChoice();
      this.userService.getCurrentUser().subscribe(data => {
        this.titleService.setTitle(`${data['platform'] ? (data['businessname'] || 'Back office') : 'RGP'} - ${data['fullname']}`)
        this.user = data;
        // Permissions are cached at sign-in; pick up role changes made since (new screens, revoked access).
        this.authService.setModules(data['modules']);
        this.authService.setBusiness(data['businesstype'], data['packs']);
        this.authService.setGst(data['gst']);
        this.propsService.refresh();
        this.platform = data['platform'] || null;
        this.authService.setPlatform(data['platform']);
        const fresh = data['permissions'];
        if (Array.isArray(fresh) && JSON.stringify(fresh) !== JSON.stringify(this.authService.getPermissions())) {
          this.authService.setPermissions(fresh);
          window.location.reload();
          return;
        }
        this.operatorContextService.setSharedLogin(data['rolename'] === 'Counter');
        this.operatorContextService.loadOperators(this.selectedStoreId, data['id']).subscribe();
      });
      this.storeContextService.loadContext().subscribe((context:any) => {
        this.stores = context?.stores || [];
        this.allStores = !!context?.allstores;
        this.totalStores = Number.isFinite(Number(context?.totalstores)) ? Number(context.totalstores) : null;
        // A user mapped to one store has nothing to switch: pin the selection to it.
        const only = this.singleStore || (this.hideStoreSwitcher && this.stores.length === 1 ? this.stores[0] : null);
        if (only && this.storeContextService.selectedStoreId !== Number(only.id)) {
          this.storeContextService.setSelectedStoreId(Number(only.id), false);
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

    /** the menu drawer on a phone; on a desktop the menu is always open */
    toggleSidebar(){
      if (this.isMobileViewport()) {
        this.sidebarDrawerOpen = !this.sidebarDrawerOpen;
      }
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
