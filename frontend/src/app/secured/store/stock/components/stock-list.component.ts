import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { DateUtilService } from "src/app/secured/date-util.service";
import { InvoiceService } from "src/app/secured/purchases/invoices/invoices.service";
import { StockService } from "../stock.service";

@Component({
    templateUrl: 'stock-list.component.html',
    styles: [
        `
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        `
    ]
})
export class StockListComponent {

    items:any = [];
    displayQtyAdjForm: boolean = false;

    selectedItem:{id?:number,title?:string} = {};
    finalqty:number = 0;
    maxAllowed = 0;
    minAllowed = 0;

    available = true;
    expired = false;
    inactive = false;

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
        
        let criteria = {status:'VERIFIED',
        id:this.selectedItem['id'],
        title:this.selectedItem['title'],available:this.available,
            expired:this.expired,starts:true}

        this.service.filterByCriteria(criteria).subscribe((items:any) => {
            this.items = items.map((i:any) => {
                return {...i, available: +i['available']}
            });
        });
    }

    // filter(){
    //     this.fetchStock();
    // }

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

    onProductSelect(event:any){
        this.selectedItem = event;
        this.fetchStock();
    }

    audit(){
        const ids:number[] = [];
        this.items.forEach((item:any) => {
            if(item['selected'])
                ids.push(item['id']);
        });
        this.invoiceService.updateItems(ids, {status: 'AUDIT',verifystartdate:this.dateService.getFormatDate(new Date())}).subscribe(result => this.fetchStock());
    }

}