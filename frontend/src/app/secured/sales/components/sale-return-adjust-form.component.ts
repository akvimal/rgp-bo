import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { SaleService } from "../sales.service";

@Component({
    selector: 'sale-return-adjust-form',
    templateUrl: './sale-return-adjust-form.component.html'
})
export class SaleReturnAdjustFormComponent {

    returnItem:any = {itemid:0, price:0, qty: 0, accept: 0, reject: {reason: '', qty: 0}, refundmode: '', note: ''};

    @Input() id:any;
    @Output() success = new EventEmitter();
    error = '';
    busy = false;

    constructor(private service:SaleService){}

    ngOnChanges(changes: SimpleChanges) {
        if(changes.id.currentValue !== ''){
            this.error = '';
            this.service.findReturnItemToAdjust(this.id).subscribe((data:any) => {
                if(data && data.length == 1){
                    const d = data[0];
                    this.returnItem = {...this.returnItem, ...d, accept: +d.qty, reject: {reason: '', qty: 0}, note: '',
                        refundmode: String(d['refund_mode'] || d['refundmode'] || '').toUpperCase()};
                }
            });
        }
    }

    private clamp(v:any): number {
        const n = Math.floor(+v || 0);
        return Math.min(Math.max(0, n), +this.returnItem.qty);
    }

    /** the two quantities always add up to what came back */
    setAccepted(v:any) {
        this.returnItem.accept = this.clamp(v);
        this.returnItem.reject.qty = +this.returnItem.qty - this.returnItem.accept;
    }

    setDiscarded(v:any) {
        this.returnItem.reject.qty = this.clamp(v);
        this.returnItem.accept = +this.returnItem.qty - this.returnItem.reject.qty;
    }

    get refundEstimate(): number {
        return (+this.returnItem.accept || 0) * (+this.returnItem.price || 0);
    }

    onSubmit(): void {
        this.error = '';
        if(!this.returnItem.refundmode){
            this.error = 'Choose how the customer is refunded.';
            return;
        }
        const note = String(this.returnItem.note || '').trim();
        if(this.returnItem.needs_inspection && !note){
            this.error = 'Say what the inspection found.';
            return;
        }
        this.busy = true;
        // stock moves with the refund on the server, in one step
        this.service.settleReturn({id:this.returnItem.id,status:'ADJUSTED',refundmode:this.returnItem.refundmode,
            acceptedqty:+this.returnItem.accept,inspectionnote:note || undefined}).subscribe((data:any) => {
            this.busy = false;
            this.success.emit(data);
        }, (err:any) => {
            this.busy = false;
            const m = err?.error?.message;
            this.error = Array.isArray(m) ? m.join(' ') : (m || 'Could not settle the return.');
        });
    }
}
