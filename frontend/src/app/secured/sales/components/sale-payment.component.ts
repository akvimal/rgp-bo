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
        if(this.payment['digiamt'] == this.total && this.payment['digimode'] == undefined)
            this.payment['digimode'] = 'UPI';
        if(this.payment['cashamt'] == this.total)
            this.cashonly = true;
    }

    ngOnChanges(changes:SimpleChanges){
        this.payment['digiamt'] = changes.total.currentValue;
        this.payment['valid'] = true;
    }

    ngDoCheck(){
        this.updated.emit(this.payment);
    }

    digimodechange(event:any){
        this.payment.digiamt = this.total;
        this.payment['valid'] = true;
    }

    cashamtchange(event:any){
        if((event.target.value + this.payment.digiamt) < this.total){
            this.payment['valid'] = false;
        }
        else {
            event.target.value = this.total - (this.payment.digiamt||0);
            this.payment['valid'] = true;
        }
    }

    digiamtchange(event:any){
        
        if(event.target.value > this.total) {
            event.target.value = this.total;
            this.payment.cashamt = 0;
            this.payment['valid'] = true;
        }
        else {
            this.payment.cashamt = this.total - event.target.value;
            this.payment['valid'] = (this.payment.cashamt + (this.payment.digiamt||0)) < this.total ? false : true;
        }
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

}