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
        this.service.findAll().subscribe(data => this.items = data);
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
        console.log(event.target.value);
        console.log(this.selectedItem);
        
        
        if(+event.target.value > +this.selectedItem.mrp_cost){
            this.adjustForm.controls['price'].setValue(this.selectedItem.mrp_cost);
            event.target.value = this.selectedItem.mrp_cost; //prevent entering value over max qty
          }
              
    }

}