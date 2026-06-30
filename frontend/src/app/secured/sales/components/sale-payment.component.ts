import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";

@Component({
    selector: 'app-sale-payment',
    templateUrl: 'sale-payment.component.html'
})
export class SalePaymentComponent {
  
    @Input() total = 0;
    
    @Input() payment:{digimode?:string,digiamt?:number,
        digirefno?:string,cashamt?:number,valid?:boolean}={};
    cashbal = 0;
    cashonly = false;

    @Output() updated:EventEmitter<any> = new EventEmitter();

    ngOnInit(){
        this.normalizePaymentForTotal();
    }

    ngOnChanges(changes:SimpleChanges){
        if(changes['total']){
            this.normalizePaymentForTotal();
        }
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

    tenderBal(event:any){
        this.cashbal = event.target.value - ((this.payment.cashamt||0) > 0 ? (this.payment.cashamt||0) : this.total);
    }

    private clampAmount(value:any){
        const amount = +(value || 0);
        if(amount < 0) return 0;
        if(amount > this.total) return this.total;
        return amount;
    }

    private normalizePaymentForTotal(){
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
