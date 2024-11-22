import { Component } from "@angular/core";
import { SaleDeliveryService } from "../sale-delivery.service";

@Component({
    selector:'app-sale-delivery',
    templateUrl: 'sale-delivery.component.html'
})
export class SaleDeliveryComponent {

    deliveries:any[] = []

    constructor(private service:SaleDeliveryService){}

    ngOnInit(){
        console.log('loading ...');
        
        this.service.findAll().subscribe((result:any) => this.deliveries = result)
    }
}