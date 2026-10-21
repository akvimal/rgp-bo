import { Component } from "@angular/core";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";

@Component({
    selector: 'app2-customers',
    templateUrl: 'customers.component.html'
})
export class CustomersComponent {

    customers:any[] = [];
    segments = ['OTC only', 'Chronic only', 'OTC + Chronic', 'Other', 'No purchases'];
    
    constructor(private service:CustomersService){}

    ngOnInit(){
        this.fetchCustomers();
    }

    fetchCustomers(){
        this.service.findAll().subscribe((data:any) => this.customers = data);
    }

}