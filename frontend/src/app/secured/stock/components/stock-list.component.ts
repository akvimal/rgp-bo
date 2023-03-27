import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ProductUtilService } from "../../product-util.service";
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
    displayPriceAdjForm: boolean = false;
    displayQtyAdjForm: boolean = false;

    selectedItem:any;
    finalqty:number = 0;

    priceAdjustForm:FormGroup = new FormGroup({
        itemid: new FormControl('',Validators.required),
        // effdate: new FormControl(new Date().toISOString().slice(0, 10),Validators.required),
        price: new FormControl('',Validators.required),
        comments: new FormControl('')
      });

      qtyAdjustForm:FormGroup = new FormGroup({
        itemid: new FormControl('',Validators.required),
        // effdate: new FormControl(new Date().toISOString().slice(0, 10),Validators.required),
        reason: new FormControl('',Validators.required),
        qty: new FormControl('',Validators.required),
        comments: new FormControl('')
      });

      qtyChangeReasons:any[] = [
        { value: 'Damaged', label: 'Damaged' },
        { value: 'Missing', label: 'Missing' },
        { value: 'Expired', label: 'Expired' },
        { value: 'Other', label: 'Other' }
      ]
      margin:number = 0;
      saving:number = 0;
    
    constructor(private service: StockService, 
        private prodUtilService: ProductUtilService){}

    ngOnInit(){
        this.service.findAll().subscribe((data:any) => {
            this.items = data.map((s:any) => {
                const margin = this.prodUtilService.getMargin(s.ptr_cost,s.sale_price);
                const saving = this.prodUtilService.getSaving(s.mrp_cost,s.sale_price);
                const qtypcnt = Math.round((s.available_qty/s.sale_qty)*100);
                return {...s, qtypcnt, mrp_cost: this.padDecimal(s.mrp_cost,2), 
                    ptr_cost: this.padDecimal(s.ptr_cost,2),
                    sale_price: this.padDecimal(s.sale_price,2),
                    margin, saving };
            });
        });
    }

    padDecimal(value:any,cnt:number){
        return Number(value).toFixed(cnt);
    }

    showPriceDialog(item:any) {
        this.selectedItem = item;
        this.priceAdjustForm.reset();
        this.priceAdjustForm.controls['itemid'].setValue(item.id);
        this.displayPriceAdjForm = true;
        
        this.margin = this.prodUtilService.getMargin(this.selectedItem.ptr_cost,this.selectedItem.sale_price);
        this.saving = this.prodUtilService.getSaving(this.selectedItem.mrp_cost,this.selectedItem.sale_price);
    }

    showQtyDialog(item:any) {
        this.selectedItem = item;
        this.qtyAdjustForm.reset();
        this.qtyAdjustForm.controls['itemid'].setValue(item.id);
        this.displayQtyAdjForm = true;
        this.finalqty = this.selectedItem.available_qty;        
    }
    
    onQtyAdjSubmit(){
        console.log(this.qtyAdjustForm.value);
        this.service.updateQty({...this.qtyAdjustForm.value,
            price:this.selectedItem.sale_price})
            .subscribe((data:any) => {
                const item = this.items.find((i:any) => i.id == data.itemid);
                console.log(this.items);
                item.available_qty = item.available_qty - data.qty;
                item.qtypcnt = Math.round((item.available_qty/item.sale_qty)*100);
                this.displayQtyAdjForm = false;                        
        });
    }

    onPriceAdjSubmit(){
        this.service.updatePrice({...this.priceAdjustForm.value,
            oldprice: this.selectedItem.sale_price,
            price:(this.priceAdjustForm.value.price)})
            .subscribe((data:any) => {
                const item = this.items.find((i:any) => i.id == data.itemid);
                item.sale_price = data.price;
                item.margin = this.prodUtilService.getMargin(item.ptr_cost,item.sale_price);
                item.saving = this.prodUtilService.getSaving(item.mrp_cost,item.sale_price);
                this.displayPriceAdjForm = false;                        
        });
    }

    newQtyInput(event:any){
        event.target.value < 0 ? 
            (event.target.value = 0) :
                this.finalqty = this.selectedItem.available_qty - (this.qtyAdjustForm.controls['qty'].value * 1)
    }
    
    newPriceInput(event:any){
        // const mrpAfterTaxDedcut = (this.selectedItem.mrp_cost / (1 + (this.selectedItem.tax_pcnt/100))).toFixed(2);        
        const mrpAfterTaxDedcut = this.selectedItem.mrp_cost;
        if (+event.target.value > +mrpAfterTaxDedcut){
            this.priceAdjustForm.controls['price'].setValue(mrpAfterTaxDedcut);
            event.target.value = mrpAfterTaxDedcut; //prevent entering value over max qty
        }
        else if (+event.target.value < +this.selectedItem.ptr_cost){
            this.priceAdjustForm.controls['price'].setValue(this.selectedItem.ptr_cost);
            event.target.value = this.selectedItem.ptr_cost; //prevent entering value over max qty
        }

        this.margin = this.prodUtilService.getMargin(this.selectedItem.ptr_cost,+event.target.value);
        this.saving = this.prodUtilService.getSaving(this.selectedItem.mrp_cost,+event.target.value);
    }

}