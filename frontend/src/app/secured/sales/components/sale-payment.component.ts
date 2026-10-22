import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

@Component({
    selector: 'app-sale-payment',
    templateUrl: 'sale-payment.component.html'
})
export class SalePaymentComponent {
  
    @Input() total = 0;
    
    @Input() payment:{digimode?:string,digiamt?:number,
        digirefno?:string,cashamt?:number,valid?:boolean,staffcredit?:boolean,staffcredituserid?:number|null,usecredit?:boolean,creditbalance?:number}={};

    /** the customer on the bill (a named customer may hold store credit) */
    @Input() customerId:number|null = null;

    /** people with a monthly staff-credit limit, and what is left of it this month */
    staffOptions:any[] = [];

    constructor(private http: HttpClient) {}
    cashbal = 0;
    /** what the customer handed over, for working out the change; null until typed */
    tendered:number|null = null;

    /** a digital amount with no (or a malformed) reference: the bill cannot be completed and cannot be reconciled later */
    get refMissing(): boolean {
        return !this.cashonly && !this.payment.staffcredit && Math.min(+(this.payment.digiamt || 0), this.total - this.creditUse) > 0
            && !/^[A-Za-z0-9][A-Za-z0-9\-_\/]{5,39}$/.test(String(this.payment.digirefno || '').replace(/\s+/g, ''));
    }
    cashonly = false;

    @Output() updated:EventEmitter<any> = new EventEmitter();

    ngOnInit(){
        this.normalizePaymentForTotal();
        this.http.get<any[]>(`${environment.apiHost}/staff-credit/options`).subscribe(o => this.staffOptions = o || [], () => this.staffOptions = []);
    }

    get staffShort(): boolean {
        const s = this.staffOptions.find(o => o.id === this.payment.staffcredituserid);
        return !!this.payment.staffcredit && !!s && this.total > s.remaining + 0.005;
    }

    /** the whole bill goes on one person's credit: no cash or digital part */
    staffCreditChange(){
        if(this.payment.staffcredit){
            this.cashonly = false;
            this.payment.digiamt = 0;
            this.payment.cashamt = 0;
            this.payment.digimode = '';
            this.payment.digirefno = '';
            this.payment.staffcredituserid = null;
        } else {
            this.payment.staffcredituserid = null;
            this.cashonly = true;
            this.payment.digiamt = 0;
            this.payment.cashamt = this.total;
        }
        this.payment['valid'] = true;
    }

    ngOnChanges(changes:SimpleChanges){
        if(changes['total']){
            this.normalizePaymentForTotal();
        }
        if(changes['customerId']){
            this.payment.usecredit = false;
            this.payment.creditbalance = 0;
            if(this.customerId){
                this.http.get<any>(`${environment.apiHost}/customers/${this.customerId}/credit`).subscribe(c => this.payment.creditbalance = +(c?.balance || 0), () => this.payment.creditbalance = 0);
            }
        }
    }

    /** what the store credit takes off this bill */
    get creditUse(): number {
        return this.payment.usecredit ? Math.max(0, Math.min(+(this.payment.creditbalance || 0), this.total)) : 0;
    }

    creditChange(){
        if(this.creditUse >= this.total){
            // the credit pays it all: nothing digital to enter
            this.payment.digiamt = 0;
            this.payment.digirefno = '';
            this.payment.cashamt = 0;
        }
        this.payment['valid'] = true;
    }

    ngDoCheck(){
        this.updated.emit(this.payment);
    }

    digimodechange(event:any){
        this.payment.digiamt = this.total;
        this.payment.cashamt = 0;
        this.payment['valid'] = true;
    }

    cashamtchange(event:any){
        const cash = this.clampAmount(event.target.value);
        this.payment.cashamt = cash;
        this.payment.digiamt = this.total - cash;
        this.payment['valid'] = true;
    }

    digiamtchange(event:any){
        const digi = this.clampAmount(event.target.value);
        this.payment.digiamt = digi;
        this.payment.cashamt = this.total - digi;
        this.payment['valid'] = true;
    }

    changeToCash(event:any){
        if(event.target.checked){
            this.payment.digiamt = 0;
            this.payment.digimode = '';
            this.payment.digirefno = '';
            this.payment.cashamt = this.total;
        }
        else {
            this.payment.digiamt = this.total;
            this.payment.digimode = 'UPI';
            this.payment.digirefno = '';
            this.payment.cashamt = 0;
        }
        this.payment['valid'] = true;
    }

    /** the Cash / Digital switch */
    setCashMode(cash:boolean){
        if(this.payment.staffcredit){
            this.payment.staffcredit = false;
            this.payment.staffcredituserid = null;
        }
        this.cashonly = cash;
        this.changeToCash({target:{checked:cash}});
    }

    tenderBal(event:any){
        const v = event.target.value;
        this.tendered = v === '' || v === null ? null : +v;
        this.cashbal = (this.tendered ?? 0) - ((this.payment.cashamt||0) > 0 ? (this.payment.cashamt||0) : this.total);
    }

    private clampAmount(value:any){
        const amount = +(value || 0);
        if(amount < 0) return 0;
        if(amount > this.total) return this.total;
        return amount;
    }

    private normalizePaymentForTotal(){
        if(this.payment.staffcredit){
            this.payment.digiamt = 0;
            this.payment.cashamt = 0;
            return;
        }
        if(this.cashonly || +(this.payment['cashamt'] || 0) === this.total){
            this.cashonly = true;
            this.payment.digiamt = 0;
            this.payment.cashamt = this.total;
            this.payment.digimode = '';
            this.payment.digirefno = '';
            this.payment['valid'] = true;
            return;
        }

        const digi = this.clampAmount(this.payment['digiamt']);
        this.payment.digiamt = digi;
        this.payment.cashamt = this.total - digi;
        if((this.payment['digiamt'] || 0) > 0 && !this.payment['digimode']){
            this.payment['digimode'] = 'UPI';
        }
        this.payment['valid'] = true;
    }

}
