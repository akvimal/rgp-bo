import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { StockService } from "../stock.service";
import { STOCK_ADJUSTMENT_REASONS } from "../reason-codes";
import { StoreContextService } from "src/app/@core/store-context.service";

@Component({
    selector: 'app-stock-adjust-form',
    templateUrl: './stock-adjust-form.component.html'
})
export class StockAdjustFormComponent {

    @Input() item:any = {};
    @Input() defaultReason:string = '';
    @Output() saved = new EventEmitter();

    finalqty:number = 0;
    maxAllowed = 0;
    minAllowed = 0;

    qtyAdjustForm:FormGroup = new FormGroup({
        itemid: new FormControl('',Validators.required),
        reason: new FormControl('',Validators.required),
        qty: new FormControl(0,Validators.required),
        comments: new FormControl('')
    });

    qtyChangeReasons = STOCK_ADJUSTMENT_REASONS;

    constructor(private service: StockService, private storeContext: StoreContextService){}

    ngOnChanges(changes:SimpleChanges){
        
        if(changes.item.currentValue){

            this.qtyAdjustForm.reset();
            this.qtyAdjustForm.controls['itemid'].setValue(this.item['item_id']);
            this.qtyAdjustForm.controls['reason'].setValue(this.defaultReason || '');

            this.finalqty = this.item.balance;
            this.minAllowed = -1 * (+this.item.balance);
        }
    }


    onQtyChange(event:any){
        this.finalqty = this.item.balance - (-1 * (this.qtyAdjustForm.controls['qty'].value * 1));      
    }


    onQtyAdjSubmit(){
        const value = this.qtyAdjustForm.value;
        // Post against the store currently selected in the header - not wherever this batch
        // was originally received - so an adjustment made after a transfer lands on the store
        // it's actually happening at.
        this.service.updateQty({...value, reasoncode: value.reason, storeid: this.storeContext.selectedStoreId})
            .subscribe(data => {
                this.saved.emit(data);
        });
    }
    
}