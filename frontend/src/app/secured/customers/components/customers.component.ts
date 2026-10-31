import { AuthService } from "src/app/@core/auth/auth.service";
import { Component } from "@angular/core";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";
import { ActivatedRoute } from "@angular/router";

@Component({
    selector: 'app2-customers',
    templateUrl: 'customers.component.html'
})
export class CustomersComponent {

    customers:any[] = [];
    segments = ['OTC only', 'Chronic only', 'OTC + Chronic', 'Other', 'No purchases'];

    /** Active is the default view; a search looks across everyone so a returning customer can always be found */
    status: 'active' | 'inactive' | 'all' = 'active';
    search = '';
    summary:any = null;
    relSegment = '';
    activeDaysEdit: number | null = null;
    savingSettings = false;

    message = '';
    error = '';

    constructor(private service:CustomersService, public auth: AuthService, private route:ActivatedRoute){}

    /** whether this login reads every contact detail: only then are audiences (whole numbers, a CSV) offered */
    canRevealAll = false;
    /** ids matching a typed number, from the server: the list itself holds masked numbers for some logins */
    private searchIds: Set<number> | null = null;
    private searchTimer:any;

    ngOnInit(){
        const q = this.route.snapshot.queryParamMap;
        if(q.get('removed')){
            const name = q.get('name') || 'The customer';
            this.message = q.get('removed') === 'deleted'
                ? `${name} was deleted.`
                : `${name} has bills and other history, so the record was archived: it no longer shows in lists or at the counter, and the bills keep the name.`;
        }
        this.service.privacy().subscribe(p => this.canRevealAll = !!p.canRevealAll, () => this.canRevealAll = false);
        this.fetchCustomers();
        this.loadSummary();
    }

    loadSummary(){
        this.service.relSummary().subscribe(s => { this.summary = s; this.activeDaysEdit = s.activeDays; }, () => this.summary = null);
    }

    /** The rows the grid shows. A stable array: the grid re-filters and resets its page whenever it is handed a new one, so it is rebuilt only when the data, the status or the search switches on or off. */
    rows:any[] = [];

    counts = { active: 0, inactive: 0 };

    private refilter(){
        this.counts = { active: this.customers.filter(c => c.status === 'active').length, inactive: this.customers.filter(c => c.status === 'inactive').length };
        const searching = !!this.search.trim();
        const base = searching || this.status === 'all' ? this.customers : this.customers.filter(c => c.status === this.status);
        // a typed number is matched on the server (the full number, either of the two): the grid only holds masked ones for some logins
        this.rows = searching && this.searchIds ? base.filter(c => this.searchIds!.has(c.id)) : base;
    }

    setStatus(status:'active'|'inactive'|'all'){
        this.status = status;
        this.refilter();
    }

    onSearch(value:string, dt:any){
        this.search = value;
        clearTimeout(this.searchTimer);
        const text = value.trim();
        if(text.length < 3){
            this.searchIds = null;
            this.refilter();
            dt.filterGlobal(text.length ? value : '', 'contains');
            return;
        }
        // the grid's own filter is not used while searching: the server decides who matches (name, place or number)
        dt.filterGlobal('', 'contains');
        this.rows = [];
        this.searchTimer = setTimeout(() => {
            this.service.lookup(text).subscribe(r => { if(this.search.trim() !== text) return; this.searchIds = new Set(r.ids); this.refilter(); }, () => { this.searchIds = null; this.refilter(); });
        }, 250);
    }

    /** the strip's segment buttons share one filter; picking the same one again clears it */
    setSegment(segment:string, dt:any){
        this.relSegment = this.relSegment === segment ? '' : segment;
        dt.filter(this.relSegment, 'relsegment', 'equals');
    }

    saveActiveDays(){
        const n = Number(this.activeDaysEdit);
        this.error = '';
        this.savingSettings = true;
        this.service.saveRelSettings({ activeDays: n }).subscribe(() => {
            this.savingSettings = false;
            this.message = `Customers are now active when they visited in the last ${n} days.`;
            this.fetchCustomers();
            this.loadSummary();
        }, err => {
            this.savingSettings = false;
            const m = err?.error?.message;
            this.error = Array.isArray(m) ? m.join(' ') : (m || 'Could not save the setting.');
        });
    }

    fetchCustomers(){
        this.service.findAll().subscribe((data:any) => { this.customers = data; this.refilter(); });
    }

}