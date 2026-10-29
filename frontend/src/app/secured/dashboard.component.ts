import { Component, OnDestroy } from "@angular/core";
import { LegendPosition } from "@swimlane/ngx-charts";
import { Subscription } from "rxjs";
import { DateUtilService } from "./date-util.service";
import { DashboardService } from "./dashboard.service";
import { StoreContextService } from "../@core/store-context.service";
import { NeedsItem } from "../shared/components/needs-strip.component";
import { ComplianceService } from "./compliance/compliance.service";

@Component({
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnDestroy {

    legendBelow = LegendPosition.Below;

    summary:any = {
        kpis: {}
    };
    adminSummary:any = {};
    salesTrend:any[] = [];
    purchaseTrend:any[] = [];
    cashTrend:any[] = [];
    paymentSplit:any[] = [];
    purchaseApprovalBreakdown:any[] = [];
    usersByRole:any[] = [];
    storesByBusiness:any[] = [];
    customersPerDay:any[] = [];
    customerScheme:any = { domain: ['#2f9e44', '#1c7ed6'] };  // New, Returning
    topCustomers:any[] = [];
    walkin:any = null;
    topProductsByQty:any[] = [];
    topProductsByRevenue:any[] = [];

    get cashBalancePct(): number {
      const bal = +this.summary?.kpis?.cash_balance || 0;
      const threshold = +this.summary?.kpis?.deposit_threshold || 0;
      if (!threshold) return 0;
      return Math.min(Math.round((bal / threshold) * 100), 100);
    }
    /** the view this role opens and its widgets in order (the server decides); the page renders the cards the role's list holds */
    view = '';
    widgets: string[] = [];
    viewTitles: any = { owner: 'Owner view', manager: 'Manager view', staff: 'Staff view', counter: 'Counter view', personal: 'My page', platform: 'Platform' };
    updated = '';
    complianceNeeds = 0;

    /** owner, manager and platform keep the long-standing cards; staff, counter and personal have their own views */
    get legacy(): boolean { return ['owner', 'manager', 'platform'].includes(this.view); }
    get viewTitle(): string { return this.viewTitles[this.view] || 'Dashboard'; }
    showWidget(key: string): boolean { return !this.widgets.length || this.widgets.includes(key); }

    /** what is waiting, from figures the server has already scoped to this person */
    get needs(): NeedsItem[] {
      const k = this.summary?.kpis || {};
      return [
        { key: 'compliance', label: 'compliance items due or late', count: this.complianceNeeds, tone: 'bad', link: ['/secure/compliance'] },
        { key: 'approvals', label: 'purchase approvals', count: +k.pending_purchase_approvals || 0, tone: 'bad', link: ['/secure/purchases/orders'] },
        { key: 'deposit', label: k.deposit_due ? 'cash deposit due' : '', count: k.deposit_due ? 1 : 0, tone: 'bad', link: ['/secure/store/cash'] },
        { key: 'overdue', label: 'overdue purchase invoices', count: +k.overdue_invoices || 0, tone: 'warn', link: ['/secure/purchases'] },
        { key: 'lowstock', label: 'low stock items', count: +k.low_stock_items || 0, tone: 'info', link: ['/secure/store/stock'] },
      ];
    }
    selectedStoreId:number | null = null;
    selectedStoreLabel = 'All stores';
    loading = false;
    error = '';

    private subscriptions = new Subscription();
 
    constructor(
      private dashboardService: DashboardService,
      private dateService: DateUtilService,
      private storeContext: StoreContextService,
      private compliance: ComplianceService
    ){}
    
    ngOnInit(){
        this.dashboardService.getView().subscribe({ next: (v:any) => { this.view = v?.view || 'owner'; this.widgets = v?.widgets || []; }, error: () => { this.view = 'owner'; } });
        this.selectedStoreId = this.storeContext.selectedStoreId;
        this.refresh();
        this.loadAdminSummary();
        this.compliance.summary().subscribe({ next: (c) => (this.complianceNeeds = c.needs), error: () => {} });
        this.loadTrends();
        this.subscriptions.add(
          this.storeContext.selectedStoreId$.subscribe((selected:any) => {
            this.selectedStoreId = selected;
            this.refresh();
            this.loadTrends();
          })
        );
    }

    ngOnDestroy(): void {
      this.subscriptions.unsubscribe();
    }

    private refresh(){
      this.loading = true;
      this.error = '';
      this.dashboardService.getSummary(this.selectedStoreId).subscribe({
        next: (data:any) => {
          this.summary = data || { kpis: {} };
          this.salesTrend = this.mapSalesTrend(data?.salestrend || []);
          this.purchaseTrend = this.mapSimpleTrend(data?.purchasetrend || []);
          this.cashTrend = data?.cashtrend || [];
          this.paymentSplit = data?.paymentsplit || [];
          this.purchaseApprovalBreakdown = data?.approvalbreakdown || [];
          this.selectedStoreLabel = this.resolveStoreLabel();
          this.loading = false;
          this.updated = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.message || 'Unable to load dashboard';
        }
      });
    }

    private loadAdminSummary(){
      this.dashboardService.getAdminSummary().subscribe({
        next: (data:any) => {
          this.adminSummary = data || {};
          this.usersByRole = data?.usersByRole || [];
          this.storesByBusiness = data?.storesByBusiness || [];
        },
        error: () => {}
      });
    }

    private loadTrends(){
      this.dashboardService.getTrends(this.selectedStoreId).subscribe({
        next: (data:any) => {
          this.customersPerDay = data?.customersPerDay || [];
          this.topCustomers = data?.topCustomers || [];
          this.walkin = data?.walkin || null;
          this.topProductsByQty = data?.topProductsByQty || [];
          this.topProductsByRevenue = data?.topProductsByRevenue || [];
        },
        error: () => {}
      });
    }

    private mapSalesTrend(rows:any[]){
      return rows.map((row:any) => ({
        name: this.formatPeriod(row.name),
        value: Math.round(+row.value || 0),
      }));
    }

    private mapSimpleTrend(rows:any[]){
      return rows.map((row:any) => ({
        name: this.formatPeriod(row.name),
        value: Math.round(+row.value || 0),
      }));
    }

    private formatPeriod(period:string){
      if(!period){
        return '';
      }
      return this.dateService.getDateMonth(period);
    }

    private resolveStoreLabel(){
      if(this.selectedStoreId === null || this.selectedStoreId === undefined){
        return 'All stores';
      }
      const store = this.storeContext.stores.find((item:any) => Number(item.id) === Number(this.selectedStoreId));
      if(!store){
        return 'Selected store';
      }
      const parts = [store.business?.name, store.location].filter(Boolean);
      return parts.length ? parts.join(' - ') : 'Selected store';
    }
}
