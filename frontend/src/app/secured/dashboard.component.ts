import { Component, OnDestroy } from "@angular/core";
import { LegendPosition } from "@swimlane/ngx-charts";
import { Subscription } from "rxjs";
import { DateUtilService } from "./date-util.service";
import { DashboardService } from "./dashboard.service";
import { StoreContextService } from "../@core/store-context.service";

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
    topCustomers:any[] = [];
    topProductsByQty:any[] = [];
    topProductsByRevenue:any[] = [];

    get cashBalancePct(): number {
      const bal = +this.summary?.kpis?.cash_balance || 0;
      const threshold = +this.summary?.kpis?.deposit_threshold || 0;
      if (!threshold) return 0;
      return Math.min(Math.round((bal / threshold) * 100), 100);
    }
    selectedStoreId:number | null = null;
    selectedStoreLabel = 'All stores';
    loading = false;
    error = '';

    private subscriptions = new Subscription();
 
    constructor(
      private dashboardService: DashboardService,
      private dateService: DateUtilService,
      private storeContext: StoreContextService
    ){}
    
    ngOnInit(){
        this.selectedStoreId = this.storeContext.selectedStoreId;
        this.refresh();
        this.loadAdminSummary();
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
