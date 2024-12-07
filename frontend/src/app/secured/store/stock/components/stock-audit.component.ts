import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { DateUtilService } from "src/app/secured/date-util.service";
import { InvoiceService } from "src/app/secured/purchases/invoices/invoices.service";
import { StockService } from "../stock.service";

@Component({
    templateUrl: 'stock-audit.component.html',
    styles: [
        `
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        `
    ]
})
export class StockAuditComponent {

    items:any = [];
    
    displayQtyAdjForm: boolean = false;
    displayQtyBulkAdjForm: boolean = false;

    selectedItem:any;
    finalqty:number = 0;
    maxAllowed = 0;
    minAllowed = 0;

    available = true;
    expired = false;
    inactive = false;

      qtyAdjustForm:FormGroup = new FormGroup({
        itemid: new FormControl('',Validators.required),
        reason: new FormControl('',Validators.required),
        qty: new FormControl(0,Validators.required),
        comments: new FormControl('')
      });

      qtyBulkAdjustForm:FormGroup = new FormGroup({
        reason: new FormControl('',Validators.required),
        comments: new FormControl('')
      });

      qtyChangeReasons:any[] = [
        { value: 'Damaged', label: 'Damaged' },
        { value: 'Missing', label: 'Missing' },
        { value: 'Expired', label: 'Expired' },
        { value: 'Other', label: 'Other' }
      ]
    
    constructor(private service: StockService, 
        private invoiceService:InvoiceService, 
        private dateService: DateUtilService){}

    ngOnInit(){
        this.fetchStock();
    }

    complete(){
            const ids:number[] = [];
            this.items.forEach((item:any) => {
                if(item['selected'])
                    ids.push(item['id']);
            });
            this.invoiceService.updateItems(ids, {status: 'VERIFIED', verifyenddate: this.dateService.getFormatDate(new Date())}).subscribe(result => this.fetchStock());
    }
    
    bulkadjust(){
        this.displayQtyBulkAdjForm = true;
    }

    fetchStock(){
        
        this.service.filterByCriteria({available:this.available,expired:this.expired,status:'AUDIT'}).subscribe((items:any) => {
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

    showQtyDialog(item:any) {
        this.selectedItem = item;
        this.qtyAdjustForm.reset();
        this.qtyAdjustForm.controls['itemid'].setValue(item['purchase_itemid']);
        this.displayQtyAdjForm = true;
        this.finalqty = this.selectedItem.available;   
        this.minAllowed = -1 * (+this.selectedItem.available);
    }
    
    onQtyAdjSubmit(){
        this.service.updateQty(this.qtyAdjustForm.value)
            .subscribe(data => {
                this.fetchStock();
                this.displayQtyAdjForm = false;                        
        });
    }

    isItemsSelected(){
        const selected = this.items.filter((i:any) => i.selected)
        return selected.length > 0;
    }

    onQtyBulkAdjSubmit(){
        const ids:number[] = [];
        this.items.forEach((item:any) => {
            if(item['selected'])
                ids.push(item['id']);
        });
        this.service.updateQtyToZero({ids, reason:this.qtyBulkAdjustForm.controls['reason'].value, 
                comments:this.qtyBulkAdjustForm.controls['comments'].value})
            .subscribe(data => {
            this.fetchStock();
            this.qtyBulkAdjustForm.reset();
            this.displayQtyBulkAdjForm = false;
        });
        
    }

    onQtyChange(event:any){
        this.finalqty = this.selectedItem.available - (-1 * (this.qtyAdjustForm.controls['qty'].value * 1));      
    }
    
}