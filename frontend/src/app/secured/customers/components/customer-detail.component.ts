import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ConfirmService } from "src/app/shared/confirm.service";
import { CustomersService } from "../customers.service";

/**
 * One customer on one page: who they are, where they stand, what has been said to them. Edit and Delete live here, not in the list, so a
 * customer is opened and looked at before anything is changed or removed. Contact details are masked for a login that may not read them all;
 * such a login shows one customer's details at a time, which is counted and kept.
 */
@Component({
    selector: 'app-customer-detail',
    templateUrl: 'customer-detail.component.html'
})
export class CustomerDetailComponent implements OnInit {

    id = 0;
    customer:any = null;
    profile:any = null;
    privacy:any = null;
    revealed = false;
    revealing = false;
    error = '';
    message = '';
    deleting = false;

    constructor(private route:ActivatedRoute, private router:Router, private service:CustomersService, private confirm:ConfirmService){}

    ngOnInit(){
        this.id = Number(this.route.snapshot.paramMap.get('id'));
        this.service.find(this.id).subscribe((c:any) => this.customer = c, err => this.error = this.say(err, 'Could not load the customer.'));
        this.service.profile(this.id).subscribe(p => this.profile = p, () => this.profile = null);
        this.loadPrivacy();
    }

    private loadPrivacy(){
        this.service.privacy().subscribe(p => this.privacy = p, () => this.privacy = null);
    }

    /** true while the contact details shown are the masked ones */
    get masked():boolean{
        return !!this.customer?.masked && !this.revealed;
    }

    get canDelete():boolean{
        return !!this.customer && this.customer.mobile !== '0000000000';
    }

    get dailyLimitReached():boolean{
        return !!this.privacy && this.privacy.left === 0;
    }

    reveal(){
        this.error = '';
        this.revealing = true;
        this.service.reveal(this.id).subscribe(d => {
            this.customer = { ...this.customer, ...d, masked: false };
            this.revealed = true;
            this.revealing = false;
            this.loadPrivacy();
        }, err => { this.revealing = false; this.error = this.say(err, 'Could not show the details.'); });
    }

    remove(){
        const c = this.customer;
        const name = String(c.name || '').trim() || 'this customer';
        this.error = '';
        this.confirm.confirmDelete(name, () => {
            this.deleting = true;
            this.service.remove(this.id).subscribe((r:any) => {
                this.deleting = false;
                // the list explains what happened: removed outright, or archived because of its bills
                this.router.navigate(['/secure/customers/cust/list'], { queryParams: { removed: r.result, name } });
            }, err => { this.deleting = false; this.error = this.say(err, 'Could not delete the customer.'); });
        }, { entity: 'customer', verb: 'Delete', consequence: 'A customer with no bills or history is removed. One that has them is archived instead: hidden from lists and the counter, with the history kept.' });
    }

    private say(err:any, fallback:string):string{
        const m = err?.error?.message;
        return Array.isArray(m) ? m.join(' ') : (m || fallback);
    }
}
