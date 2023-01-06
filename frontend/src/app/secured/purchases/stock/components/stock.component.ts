import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { StockService } from "../stock.service";

@Component({
    templateUrl: 'stock.component.html'
})
export class StockComponent {

    items:any = []
    display: boolean = false;

    selectedItem:any;

    adjustForm:FormGroup = new FormGroup({
        itemid: new FormControl('',Validators.required),
        effdate: new FormControl(new Date().toISOString().slice(0, 10),Validators.required),
        price: new FormControl('',Validators.required),
        comments: new FormControl('',Validators.required)
      });
    
    constructor(private service:StockService){}

    ngOnInit(){
        this.service.findAll().subscribe((data:any) => {
            this.items = data.map((s:any) => {
                const margin = Math.round(((s.sale_price - s.ptr_cost)/s.ptr_cost)*100);
                const saving = Math.round(((s.mrp_cost - s.sale_price)/s.mrp_cost)*100);
                return {...s, mrp_cost: this.padDecimal(s.mrp_cost,2), 
                    ptr_cost: this.padDecimal(s.ptr_cost,2),
                    sale_price: this.padDecimal(s.sale_price,2),
                    margin, saving };
            });
        });
    }

    padDecimal(value:any,cnt:number){
        return Number(value).toFixed(cnt);
    }

    showDialog(item:any) {
        this.selectedItem = item;
        this.adjustForm.reset();
        this.adjustForm.controls['itemid'].setValue(item.id);
        this.display = true;
    }
    
    onAdjustSubmit(){
        this.service.updatePrice(this.adjustForm.value).subscribe((data:any) => {
            const item = this.items.find((i:any) => i.id == data.itemid);
            item.sale_price = data.price;
            this.display = false;
        });
    }

    limitMRP(event:any){
        if(+event.target.value > +this.selectedItem.mrp_cost){
            this.adjustForm.controls['price'].setValue(this.selectedItem.mrp_cost);
            event.target.value = this.selectedItem.mrp_cost; //prevent entering value over max qty
          }
              
    }

}