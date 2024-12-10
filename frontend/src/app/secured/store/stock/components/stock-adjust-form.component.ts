import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { StockService } from "../stock.service";

@Component({
    selector: 'app-stock-adjust-form',
    templateUrl: './stock-adjust-form.component.html'
})
export class StockAdjustFormComponent {

    @Input() item:any = {};
    @Output() saved = new EventEmitter();

    // adjItem:any = {};

    finalqty:number = 0;
    maxAllowed = 0;
    minAllowed = 0;

    qtyAdjustForm:FormGroup = new FormGroup({
        itemid: new FormControl('',Validators.required),
        reason: new FormControl('',Validators.required),
        qty: new FormControl(0,Validators.required),
        comments: new FormControl('')
    });

    qtyChangeReasons:any[] = [
        { value: 'Damaged', label: 'Damaged' },
        { value: 'Missing', label: 'Missing' },
        { value: 'Expired', label: 'Expired' },
        { value: 'Other', label: 'Other' }
    ]
    
    constructor(private service: StockService){}

    ngOnChanges(changes:SimpleChanges){
        
        if(changes.item.currentValue){
            // this.adjItem = changes.item.currentValue;
            console.log(changes.item.currentValue);
            
            this.qtyAdjustForm.reset();
        this.qtyAdjustForm.controls['itemid'].setValue(this.item['item_id']);
        
        this.finalqty = this.item.balance;   
        this.minAllowed = -1 * (+this.item.balance);
        }
    }


    onQtyChange(event:any){
        this.finalqty = this.item.balance - (-1 * (this.qtyAdjustForm.controls['qty'].value * 1));      
    }


    onQtyAdjSubmit(){
        this.service.updateQty(this.qtyAdjustForm.value)
            .subscribe(data => {
                this.saved.emit(data);         
        });
    }
    
}