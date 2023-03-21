import { Component } from "@angular/core";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";

@Component({
    selector: 'app2-customers',
    templateUrl: 'customers.component.html'
})
export class CustomersComponent {

    // displayForm:boolean = false;

    customers:Customer[] = []
    // selectedCustomerId:any;
    
    constructor(private service:CustomersService){}

    ngOnInit(){
        this.fetchCustomers();
    }

    // showNewCustomer(){
    //    this.router.navigate(['new']);
    // }

    // onEdit(id:any) {
    //     this.selectedCustomerId = id;
    //     this.displayForm = true;
    // }

    // onRemove(id:any) {
    //   this.service.remove(id).subscribe(data => this.fetchCustomers());
    // }

    fetchCustomers(){
        this.service.findAll().subscribe((data:any) => this.customers = data);
    }

    // customerSaved(event:any){
    //     this.displayForm = false;
    //     this.fetchCustomers();
    // }

}