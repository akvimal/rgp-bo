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
    /** the other people on the same number (a family often shares one) */
    household:any = null;
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
        this.service.household(this.id).subscribe(h => this.household = h, () => this.household = null);
        this.loadPrivacy();
    }

    // ---- the account (household): change the number, give someone their own account, join two accounts, move a balance
    acct:'' | 'mobile' | 'detach' | 'merge' | 'move' = '';
    acctMobile = ''; acctLocality = ''; acctOther = ''; acctKind = 'DUE'; acctAmount:any = null; acctReason = '';
    acctBusy = false; acctDone = ''; numbers:any = null;

    openAcct(which:'' | 'mobile' | 'detach' | 'merge' | 'move'){
        this.acct = this.acct === which ? '' : which;
        this.acctDone = ''; this.error = '';
        if (this.acct === 'mobile' && !this.numbers) this.service.householdNumbers(this.id).subscribe(n => this.numbers = n, () => this.numbers = null);
    }

    private acctCall(call:any, done:string){
        this.error = ''; this.acctDone = ''; this.acctBusy = true;
        call.subscribe(() => {
            this.acctBusy = false; this.acct = ''; this.numbers = null;
            this.acctMobile = ''; this.acctOther = ''; this.acctAmount = null; this.acctReason = '';
            this.ngOnInit();
            this.acctDone = done;
        }, (err:any) => { this.acctBusy = false; this.error = this.say(err, 'Could not do that.'); });
    }

    changeAcctMobile(){
        this.acctCall(this.service.changeHouseholdMobile(this.id, this.acctMobile), 'The number was changed for everyone on this account. Ask for consent again on the new number.');
    }

    detachAcct(){
        this.acctCall(this.service.detachFromHousehold(this.id, this.acctMobile, this.acctLocality), 'They now have their own account. Balances stayed with the old account.');
    }

    /** the other account is found by a number on it */
    private withOther(then:(otherId:number)=>void){
        this.error = '';
        this.service.byMobile(this.acctOther).subscribe((rows:any[]) => {
            const other = (rows || []).find(r => r.id !== this.id);
            if (!other) { this.error = 'No customer was found on that number.'; return; }
            then(other.id);
        }, (err:any) => this.error = this.say(err, 'Could not look up that number.'));
    }

    mergeAcct(){
        this.withOther(other => this.confirm.confirmDelete('the two accounts', () => {
            this.acctCall(this.service.mergeHouseholds(this.id, other), 'The two accounts are now one. The other number is kept in the history.');
        }, { entity: 'account', verb: 'Join', consequence: 'Everyone on the other number joins this account; dues and store credit are added together, and the other number is kept in the history.' }));
    }

    moveBalance(){
        this.withOther(other => this.acctCall(this.service.transferBalance({
            fromcustomerid: this.id, tocustomerid: other, kind: this.acctKind, amount: this.acctAmount, reason: this.acctReason }), 'The balance was moved.'));
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
