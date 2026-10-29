import { ShiftContextService } from "src/app/@core/shift-context.service";
import { Component, OnDestroy } from "@angular/core";
import { DateUtilService } from "../../date-util.service";
import { Sale } from "../models/sale.model";
import { SaleService } from "../sales.service";
import { Subscription } from "rxjs";
import { OperatorContextService } from "src/app/@core/operator-context.service";
import { StoreContextService } from "src/app/@core/store-context.service";
import { AuthService } from "src/app/@core/auth/auth.service";

@Component({
    templateUrl: './sales-list.component.html'
})
export class SalesListComponent implements OnDestroy {

    /** the bills of the day, and the ones left after the staff and payment filters */
    sales:any[] = [];
    rows:any[] = [];
    staffFilter = '';
    payFilter = 'ALL';
    staffOptions:string[] = [];
    payOptions:{value:string,label:string}[] = [];

    /** the Digital payments check of each bill (the same record that page reads), and who may see and make it */
    checks:{[saleId:number]:any} = {};
    canViewDigital = false;
    canVerifyDigital = false;
    checkSale:any = null;
    checkForm:any = { status: 'VERIFIED', amount_seen: null, note: '' };
    checkError = '';
    checkSaving = false;
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
      private storeContext: StoreContextService,
      private auth: AuthService,
      private shiftContext: ShiftContextService
    ){
      this.canViewDigital = this.auth.isActionAuthorized('paymentrecon.view');
      this.canVerifyDigital = this.auth.isActionAuthorized('paymentrecon.verify');
    }

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
        this.service.findAll({...this.buildCriteria(filter),status:'COMPLETE'}).subscribe((result:any) => {
          const data: any[] = result?.data ?? (Array.isArray(result) ? result : []);
          data.forEach((sale:any) => {
            if(sale['customer']){
              sale['custinfo'] = `${sale['customer']['name']} (${sale['customer']['mobile']})`
            }
            //round the decimals of total
            sale['total'] = Math.round(sale['total']);
            sale['staffname'] = sale['actinguser'] ? sale['actinguser'].fullname : (sale['created'] ? sale['created'].fullname : '');
          });
          this.sales = data;
          this.staffOptions = Array.from(new Set(data.map((s:any) => s.staffname).filter(Boolean))).sort() as string[];
          const methods = Array.from(new Set(data.filter((s:any) => +s.digiamt > 0).map((s:any) => s.digimethod || 'UPI'))).sort() as string[];
          this.payOptions = [
            { value: 'ALL', label: 'All payments' },
            { value: 'CASH', label: 'Cash only' },
            { value: 'DIGITAL', label: 'Digital (any)' },
            { value: 'SPLIT', label: 'Cash and digital' },
            ...methods.map(m => ({ value: 'M:' + m, label: m })),
            { value: 'UNVERIFIED', label: 'Digital, not verified' },
          ];
          if (this.staffFilter && !this.staffOptions.includes(this.staffFilter)) this.staffFilter = '';
          if (!this.payOptions.some(o => o.value === this.payFilter)) this.payFilter = 'ALL';
          this.applyFilters();
          this.loadChecks();
        });
    }

    /** the staff and payment filters, over the bills of the day; the totals follow what is shown */
    applyFilters(){
      const digital = (s:any) => +s.digiamt > 0;
      this.rows = this.sales.filter((s:any) => {
        if (this.staffFilter && s.staffname !== this.staffFilter) return false;
        const f = this.payFilter;
        if (f === 'CASH') return !digital(s) && +s.cashamt > 0;
        if (f === 'DIGITAL') return digital(s);
        if (f === 'SPLIT') return digital(s) && +s.cashamt > 0;
        if (f === 'UNVERIFIED') return digital(s) && this.checkOf(s)?.status !== 'VERIFIED';
        if (f.startsWith('M:')) return digital(s) && (s.digimethod || 'UPI') === f.slice(2);
        return true;
      });
      const sum = (key:string) => Math.round(this.rows.reduce((t:number, s:any) => t + (+s[key] || 0), 0) * 100) / 100;
      this.totals = { digital: sum('digiamt'), cash: sum('cashamt'), net: sum('total') };
    }

    // ------------------------------------------------------------ the digital payment check
    private loadChecks(){
      const ids = this.sales.filter((s:any) => +s.digiamt > 0).map((s:any) => s.id);
      if (!this.canViewDigital || !ids.length) { this.checks = {}; return; }
      this.service.digitalStatus(ids).subscribe((rows:any[]) => {
        this.checks = {};
        (rows || []).forEach((r:any) => this.checks[+r.sale_id] = r);
        this.applyFilters();
      }, () => this.checks = {});
    }

    checkOf(s:any){ return this.checks[s.id] || null; }

    checkLabel(s:any){
      const c = this.checkOf(s);
      return !c ? 'To verify' : c.status === 'VERIFIED' ? 'Verified' : c.status === 'MISMATCH' ? 'Amount differs' : 'Not received';
    }

    checkClass(s:any){
      const c = this.checkOf(s);
      return !c ? 'bg-light text-dark border' : c.status === 'VERIFIED' ? 'bg-success' : 'bg-danger';
    }

    openCheck(s:any){
      this.checkSale = s;
      const c = this.checkOf(s);
      this.checkForm = { status: c?.status || 'VERIFIED', amount_seen: c?.amount_seen ?? null, note: c?.note || '' };
      this.checkError = '';
    }

    closeCheck(){ this.checkSale = null; }

    saveCheck(){
      const s = this.checkSale, f = this.checkForm;
      if (!s) return;
      this.checkError = '';
      if (f.status !== 'VERIFIED' && !String(f.note || '').trim()) { this.checkError = 'Add a note saying what you found.'; return; }
      if (f.status === 'MISMATCH' && (f.amount_seen === null || f.amount_seen === '')) { this.checkError = 'Enter the amount that was actually received.'; return; }
      this.checkSaving = true;
      this.service.recordDigital(s.id, { status: f.status, note: f.status === 'VERIFIED' ? '' : f.note, amount_seen: f.status === 'MISMATCH' ? f.amount_seen : undefined }).subscribe({
        next: () => {
          this.checkSaving = false;
          this.checks[s.id] = { sale_id: s.id, status: f.status, amount_seen: f.status === 'VERIFIED' ? +s.digiamt : f.amount_seen, note: f.note };
          this.checkSale = null;
          this.applyFilters();
        },
        error: (e:any) => { this.checkSaving = false; const m = e?.error?.message; this.checkError = Array.isArray(m) ? m.join(' ') : (m || 'The check could not be saved.'); }
      });
    }

    /** take the check back: the bill goes back to "to verify" here and on the Digital payments page */
    undoCheck(){
      const s = this.checkSale;
      if (!s) return;
      this.checkSaving = true;
      this.service.clearDigital(s.id).subscribe({
        next: () => { this.checkSaving = false; delete this.checks[s.id]; this.checkSale = null; this.applyFilters(); },
        error: (e:any) => { this.checkSaving = false; this.checkError = e?.error?.message || 'The check could not be removed.'; }
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
        else if(action === 'Edit' && !sale.gstinvoiceno && (sale.status === 'PENDING' || this.dateService.isSameDay(sale.billdate))){
          allowed = true;
        }
        else if(action === 'Return' 
        && this.auth.moduleOn('returns') && this.shiftContext.returnsAllowed
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
