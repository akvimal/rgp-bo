import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ProductUtilService } from "../../../product-util.service";
import { StockService } from "../stock.service";

@Component({
    templateUrl: 'stock-list.component.html',
    styles: [
        `
        .batch {color:blue;font-style:italic;font-size:smaller}
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        `
    ]
})
export class StockListComponent {

    items:any = [];
    // displayPriceAdjForm: boolean = false;
    displayQtyAdjForm: boolean = false;

    selectedItem:any;
    finalqty:number = 0;
    maxAllowed = 0;
    minAllowed = 0;

    // priceAdjustForm:FormGroup = new FormGroup({
    //     itemid: new FormControl('',Validators.required),
    //     // effdate: new FormControl(new Date().toISOString().slice(0, 10),Validators.required),
    //     price: new FormControl('',Validators.required),
    //     comments: new FormControl('',Validators.required)
    //   });

      qtyAdjustForm:FormGroup = new FormGroup({
        itemid: new FormControl('',Validators.required),
        // effdate: new FormControl(new Date().toISOString().slice(0, 10),Validators.required),
        reason: new FormControl('',Validators.required),
        qty: new FormControl(0,Validators.required),
        comments: new FormControl('',Validators.required)
      });

      qtyChangeReasons:any[] = [
        { value: 'Damaged', label: 'Damaged' },
        { value: 'Missing', label: 'Missing' },
        { value: 'Expired', label: 'Expired' },
        { value: 'Other', label: 'Other' }
      ]
    
    constructor(private service: StockService){}

    ngOnInit(){
        this.fetchStock();
    }

    fetchStock(){
        this.service.filterByCriteria('',false,false,0).subscribe(items => {
            this.items = items;
        });
    }

    showQtyDialog(item:any) {
        this.selectedItem = item;
        console.log(item);
        
        this.qtyAdjustForm.reset();
        this.qtyAdjustForm.controls['itemid'].setValue(item['purchase_itemid']);
        this.displayQtyAdjForm = true;
        this.finalqty = this.selectedItem.available;   
        this.minAllowed = -1 * (+this.selectedItem.available);
        // this.maxAllowed = (+item.available) + (+item.sold);
    }
    
    onQtyAdjSubmit(){
        console.log(this.qtyAdjustForm.value);
        this.service.updateQty(this.qtyAdjustForm.value)
            .subscribe(data => {
                this.fetchStock();
                this.displayQtyAdjForm = false;                        
        });
    }

    onQtyChange(event:any){
        this.finalqty = this.selectedItem.available - (-1 * (this.qtyAdjustForm.controls['qty'].value * 1));      
    }
    

}