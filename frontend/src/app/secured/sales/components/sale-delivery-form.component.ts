import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { SaleDeliveryService } from "../sale-delivery.service";

@Component({
    selector:'app-sale-delivery-form',
    templateUrl: 'sale-delivery-form.component.html'
})
export class SaleDeliveryFormComponent {

    form:FormGroup = new FormGroup({
        receivername: new FormControl(''),
        receiverphone: new FormControl(''),
        receiveraddress: new FormControl(''),
        charges: new FormControl(''),
        deliveryby: new FormControl('')
    });

    constructor(private service:SaleDeliveryService){}
    
    ngOnInit(){}
      
    onSave(){
        console.log(this.form.value);
        
    }
}