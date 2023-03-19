import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { CalculatorService } from "src/app/secured/calculator.service";
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
        // effdate: new FormControl(new Date().toISOString().slice(0, 10),Validators.required),
        price: new FormControl('',Validators.required),
        // comments: new FormControl('',Validators.required)
      });
      margin:number = 0;
      saving:number = 0;
    
    constructor(private service: StockService, 
        private calc: CalculatorService){}

    ngOnInit(){
        this.service.findAll().subscribe((data:any) => {
            this.items = data.map((s:any) => {
                // const ms = this.calcMarginSaving(s.mrp_cost,s.ptr_cost,s.sale_price);
                const margin = this.calc.getMargin(s.ptr_cost,s.sale_price);
                const saving = this.calc.getSaving(s.mrp_cost,s.sale_price);
                const qtypcnt = Math.round((s.available_qty/s.sale_qty)*100);
                return {...s, qtypcnt, mrp_cost: this.padDecimal(s.mrp_cost,2), 
                    ptr_cost: this.padDecimal(s.ptr_cost,2),
                    sale_price: this.padDecimal(s.sale_price,2),
                    margin, saving };
            });
        });
    }

    // calcMarginSaving(mrp:number,ptr:number,sp:number){
    //     const margin = Math.round(((sp - ptr)/ptr)*100);
    //     const saving = Math.round(((mrp - sp)/mrp)*100);
    //     return [margin,saving]
    // }

    padDecimal(value:any,cnt:number){
        return Number(value).toFixed(cnt);
    }

    showDialog(item:any) {
        this.selectedItem = item;
        this.adjustForm.reset();
        this.adjustForm.controls['itemid'].setValue(item.id);
        this.display = true;
        // const ms = this.calcMarginSaving(this.selectedItem.mrp_cost,this.selectedItem.ptr_cost,this.selectedItem.sale_price);
        // this.margin = ms[0];
        // this.saving = ms[1];
        this.margin = this.calc.getMargin(this.selectedItem.ptr_cost,this.selectedItem.sale_price);
        this.saving = this.calc.getSaving(this.selectedItem.mrp_cost,this.selectedItem.sale_price);
    }
    
    onAdjustSubmit(){
        this.service.updatePrice({...this.adjustForm.value,
            price:(this.adjustForm.value.price)})
            .subscribe((data:any) => {
                const item = this.items.find((i:any) => i.id == data.itemid);
                item.sale_price = data.price;
                item.margin = this.calc.getMargin(item.ptr_cost,item.sale_price);
                item.saving = this.calc.getSaving(item.mrp_cost,item.sale_price);
                this.display = false;                        
        });
    }

    spinput(event:any){
        // const mrpAfterTaxDedcut = (this.selectedItem.mrp_cost / (1 + (this.selectedItem.tax_pcnt/100))).toFixed(2);        
        const mrpAfterTaxDedcut = this.selectedItem.mrp_cost;
        if(+event.target.value > +mrpAfterTaxDedcut){
            this.adjustForm.controls['price'].setValue(mrpAfterTaxDedcut);
            event.target.value = mrpAfterTaxDedcut; //prevent entering value over max qty
        }

        this.margin = this.calc.getMargin(this.selectedItem.ptr_cost,+event.target.value);
        this.saving = this.calc.getSaving(this.selectedItem.mrp_cost,+event.target.value);
    }

}