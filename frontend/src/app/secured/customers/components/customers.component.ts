import { AuthService } from "src/app/@core/auth/auth.service";
import { Component } from "@angular/core";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    selector: 'app2-customers',
    templateUrl: 'customers.component.html'
})
export class CustomersComponent {

    customers:any[] = [];
    segments = ['OTC only', 'Chronic only', 'OTC + Chronic', 'Other', 'No purchases'];
    
    message = '';
    error = '';

    constructor(private service:CustomersService, private confirm:ConfirmService, public auth: AuthService){}

    ngOnInit(){
        this.fetchCustomers();
    }

    deleteCustomer(c:any){
        this.message = '';
        this.error = '';
        const name = String(c.name || '').trim() || c.mobile;
        this.confirm.confirmDelete(name, () => {
            this.service.remove(c.id).subscribe((r:any) => {
                this.message = r.result === 'deleted'
                    ? `${name} was deleted.`
                    : `${name} has ${r.history.bills} bill(s) and other history, so the record was archived: it no longer shows in lists or at the counter, and the bills keep the name.`;
                this.fetchCustomers();
            }, err => {
                const m = err?.error?.message;
                this.error = Array.isArray(m) ? m.join(' ') : (m || 'Could not delete the customer.');
            });
        }, { entity: 'customer', verb: 'Delete', consequence: 'A customer with no bills or history is removed. One that has them is archived instead: hidden from lists and the counter, with the history kept.' });
    }

    fetchCustomers(){
        this.service.findAll().subscribe((data:any) => this.customers = data);
    }

}