import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { DateUtilService } from "src/app/secured/date-util.service";
import { InvoiceService } from "src/app/secured/purchases/invoices/invoices.service";
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

    available = true;
    expired = false;
    inactive = false;

    // priceAdjustForm:FormGroup = new FormGroup({
    //     itemid: new FormControl('',Validators.required),
    //     // effdate: new FormControl(new Date().toISOString().slice(0, 10),Validators.required),
    //     price: new FormControl('',Validators.required),
    //     comments: new FormControl('',Validators.required)
    //   });

      qtyAdjustForm:FormGroup = new FormGroup({
        itemid: new FormControl('',Validators.required),
        // effdate: new FormControl(new Date().toISOString().slice(0, 10),Validators.required),
        reason: new FormControl('Other',Validators.required),
        qty: new FormControl(0,Validators.required),
        comments: new FormControl('')
      });

      qtyChangeReasons:any[] = [
        { value: 'Damaged', label: 'Damaged' },
        { value: 'Missing', label: 'Missing' },
        { value: 'Expired', label: 'Expired' },
        { value: 'Other', label: 'Other' }
      ]
    
    constructor(private service: StockService, private invoiceService: InvoiceService, private dateService:DateUtilService){}

    ngOnInit(){
        this.fetchStock();
    }

    fetchStock(){
        this.service.filterByCriteria('',this.available,this.expired,this.inactive,'VERIFIED',0).subscribe((items:any) => {
            this.items = items.map((i:any) => {
                return {...i, available: +i['available']}
            });
        });
    }

    selectItem(event:any, id:number){
        this.items.forEach((item:any) => {
            if(item.id == id){
                item['selected'] = true;
            }
        });
    }

    selectAllItem(event:any){
        this.items.forEach((item:any) => {
            item['selected'] = event.target.checked;
        });
    }
    
    isItemsSelected(){
        const selected = this.items.filter((i:any) => i.selected)
        return selected.length > 0;
    }

    audit(){
        const ids:number[] = [];
        this.items.forEach((item:any) => {
            if(item['selected'])
                ids.push(item['id']);
        });
        this.invoiceService.updateItems(ids, {status: 'AUDIT',verifystartdate:this.dateService.getFormatDate(new Date())}).subscribe(result => this.fetchStock());
    }

    showQtyDialog(item:any) {
        this.selectedItem = item;
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