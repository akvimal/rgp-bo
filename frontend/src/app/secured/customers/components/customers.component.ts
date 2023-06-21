import { Component } from "@angular/core";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";

@Component({
    selector: 'app2-customers',
    templateUrl: 'customers.component.html'
})
export class CustomersComponent {

    customers:Customer[] = [];
    
    constructor(private service:CustomersService){}

    ngOnInit(){
        this.fetchCustomers();
    }

    fetchCustomers(){
        this.service.findAll().subscribe((data:any) => this.customers = data);
    }

}