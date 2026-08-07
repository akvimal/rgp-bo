import { Component, OnDestroy } from "@angular/core";
import { DateUtilService } from "../../date-util.service";
import { Sale } from "../models/sale.model";
import { SaleService } from "../sales.service";
import { Subscription } from "rxjs";
import { OperatorContextService } from "src/app/@core/operator-context.service";
import { StoreContextService } from "src/app/@core/store-context.service";

@Component({
    templateUrl: './sales-list.component.html'
})
export class SalesListComponent implements OnDestroy {

    sales:Sale[] = [];
    date:string = '';
    returnSaleId = '';
    selectedOperatorId: number | null = null;
    selectedStoreId: number | null = null;
    private subs = new Subscription();

    openH1DrugsTab = false;
    productLevelLoaded = false;
    showReturnForm = false;

    totals = {digital:0,cash:0,net:0};

    staffSummary: any[] = [];
    staffPeriod = 'today';
    staffFromDate = '';
    staffToDate = '';
    staffTotals = {bills:0, cash:0, digi:0, net:0, returns:0, returnValue:0};

    constructor(
      private service:SaleService,
      private dateService:DateUtilService,
      private operatorContext: OperatorContextService,
      private storeContext: StoreContextService
    ){}

    ngOnInit(){
      this.date = this.dateService.getFormatDate(new Date());
      this.staffFromDate = this.date;
      this.staffToDate = this.date;
      this.selectedStoreId = this.storeContext.selectedStoreId;
      this.subs.add(
        this.storeContext.selectedStoreId$.subscribe((storeId: any) => {
          this.selectedStoreId = storeId;
          this.fetchSales();
        })
      );
      this.fetchSales();
    }

    ngOnDestroy(): void {
      this.subs.unsubscribe();
    }

    openH1Drugs(event:any){
      this.openH1DrugsTab = true;
    }

    onSalesTabChange(event:any){
      if(event.index === 1){
        this.productLevelLoaded = true;
      }
      if(event.index === 2){
        this.loadStaffSummary();
      }
    }

    setStaffPeriod(period: string) {
      this.staffPeriod = period;
      const today = this.dateService.getFormatDate(new Date());
      if (period === 'today') {
        this.staffFromDate = today;
        this.staffToDate = today;
      } else if (period === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + 1);
        this.staffFromDate = this.dateService.getFormatDate(d);
        this.staffToDate = today;
      } else if (period === 'month') {
        const d = new Date();
        d.setDate(1);
        this.staffFromDate = this.dateService.getFormatDate(d);
        this.staffToDate = today;
      }
      if (period !== 'custom') {
        this.loadStaffSummary();
      }
    }

    loadStaffSummary() {
      const params: any = {};
      if (this.staffFromDate) params.fromdate = this.staffFromDate;
      if (this.staffToDate) params.todate = this.staffToDate;
      if (this.selectedStoreId !== null) params.storeid = this.selectedStoreId;
      this.service.getStaffSummary(params).subscribe((data: any[]) => {
        this.staffSummary = data || [];
        this.staffTotals = this.staffSummary.reduce((acc, r) => ({
          bills: acc.bills + (+r.sales_count || 0),
          cash: acc.cash + (+r.cash_total || 0),
          digi: acc.digi + (+r.digi_total || 0),
          net: acc.net + (+r.net_total || 0),
          returns: acc.returns + (+r.return_count || 0),
          returnValue: acc.returnValue + (+r.return_value || 0),
        }), {bills:0, cash:0, digi:0, net:0, returns:0, returnValue:0});
      });
    }

    private buildCriteria(filter:any = {}){
      const criteria:any = {...filter};
      if (this.date && !criteria.date) {
        criteria.date = this.date;
      }
      if (this.selectedStoreId !== null && this.selectedStoreId !== undefined) {
        criteria.storeid = this.selectedStoreId;
      }
      return criteria;
    }

    fetchSales(filter:any = {}){
      this.totals['digital'] = 0;
      this.totals['cash'] = 0;
      this.totals['net'] = 0;

        this.service.findAll({...this.buildCriteria(filter),status:'COMPLETE'}).subscribe((result:any) => {
          const data: any[] = result?.data ?? (Array.isArray(result) ? result : []);
          data.forEach((sale:any) => {
            if(sale['customer']){
              sale['custinfo'] = `${sale['customer']['name']} (${sale['customer']['mobile']})`
            }
            //round the decimals of total
            sale['total'] = Math.round(sale['total']);
            this.totals['digital'] += sale['digiamt'];
            this.totals['cash'] += sale['cashamt'];
            this.totals['net'] += +sale['total'];
          });
          this.sales = data;
        });
    }

    showReturn(saleid:any){
      this.returnSaleId = saleid;
      this.showReturnForm = true;
    }

    showDelivery(saleid:any){

    }

    onReturnSubmitSuccess(event:any){
      this.showReturnForm = false;
    }

  filterDateSales(input:any, event:any){
      if(event === 'date')
      this.fetchSales({date:input.target.value});
    }

    filterBillSales(input:any){
      this.fetchSales({billno:input.target.value});
    }

    filterCustomerSales(customer:any){
        const {id} = customer;
        // this.criteria.customer = id || 0;
        this.fetchSales({customer:id});
      }

      isActionAllowed(action:string,sale:any){
        let allowed = false;
        if(action === 'Print' && sale.status === 'COMPLETE'){
          allowed = true;
        }
        else if(action === 'Edit' && (sale.status === 'PENDING' || this.dateService.isSameDay(sale.billdate))){
          allowed = true;
        }
        else if(action === 'Return' 
        && (sale.status === 'COMPLETE' && !this.dateService.isSameDay(sale.billdate))
        ){ // return allowed for sale completed within specified period
          allowed = true;
        }
        else if(action === 'Cancel' && sale.status !== 'LOCKED'){ // the sale will be locked on filing GST
          allowed = true;
        }
        else if(action === 'Delivery' && sale.deliverytype === 'Delivery'){
          allowed = true;
        }
        return allowed;
      }
}
