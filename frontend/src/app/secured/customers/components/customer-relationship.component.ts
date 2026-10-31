import { Component, Input, OnInit } from "@angular/core";
import { CustomersService } from "../customers.service";

const OUTCOME_LABELS: Record<string, string> = {
    REACHED: 'Spoke to them', SENT: 'Message sent', NO_ANSWER: 'No answer', CALLBACK: 'Call back later',
    NOT_INTERESTED: 'Not interested', WRONG_NUMBER: 'Wrong number', ASKED_TO_STOP: 'Asked us to stop',
};

/** On the customer screen: where this customer stands (segment, tier, why) and every call or message made to them. */
@Component({
    selector: 'app-customer-relationship',
    templateUrl: 'customer-relationship.component.html'
})
export class CustomerRelationshipComponent implements OnInit {

    @Input() customerId = 0;

    labels = OUTCOME_LABELS;
    outcomes = Object.keys(OUTCOME_LABELS);
    profile:any = null;
    care:any = null;
    contacts:any[] = [];
    channel = 'CALL';
    outcome = '';
    note = '';
    saving = false;
    error = '';

    constructor(private service:CustomersService){}

    ngOnInit(){
        this.service.profile(this.customerId).subscribe(p => this.profile = p, () => this.profile = null);
        this.loadContacts();
        this.service.care(this.customerId).subscribe(c => this.care = c, () => this.care = null);
    }

    loadContacts(){
        this.service.contacts(this.customerId).subscribe(c => this.contacts = c, () => this.contacts = []);
    }

    add(){
        if(!this.outcome) return;
        this.error = '';
        this.saving = true;
        this.service.recordContact(this.customerId, { channel: this.channel, outcome: this.outcome, note: this.note }).subscribe(() => {
            this.saving = false;
            this.outcome = '';
            this.note = '';
            this.loadContacts();
        }, err => {
            this.saving = false;
            const m = err?.error?.message;
            this.error = Array.isArray(m) ? m.join(' ') : (m || 'Could not record the contact.');
        });
    }
}
