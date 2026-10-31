import { Component, OnInit } from "@angular/core";
import { CustomersService } from "../customers.service";
import { greetingName } from "../greeting";

const DEFAULT_MESSAGES: Record<string, string> = {
    due_back: 'Hello {name}, this is a gentle reminder from us: it is about time for your regular medicines. We are here whenever you need them.',
    new_second_visit: 'Hello {name}, thank you for visiting us. We would be glad to see you again; ask us if there is anything we can help with.',
    champions: 'Hello {name}, thank you for being one of our most valued customers. We would like to share something special with you.',
    loyal: 'Hello {name}, thank you for always choosing us. We appreciate your trust.',
    big_spenders: 'Hello {name}, we would be happy to look after all your regular needs. Please let us know how we can help.',
    at_risk: 'Hello {name}, we have not seen you for a while and wanted to check that all is well. Please let us know if there is anything we can do.',
    lapsed: 'Hello {name}, we miss you. We would love to see you again and have something for you when you visit.',
    all_active: 'Hello {name}, a message from your pharmacy.',
};

/** The people a campaign can reach: pick an audience, narrow it by what they bought, then message or call them from the list or export it. */
@Component({
    selector: 'app-customer-audiences',
    templateUrl: 'customer-audiences.component.html'
})
export class CustomerAudiencesComponent implements OnInit {

    audiences:any[] = [];
    capDays = 7;
    selected:any = null;
    result:any = null;

    product = '';
    months = 6;
    kind = '';
    locality = '';
    message = '';

    nameToken = '{name}';
    canExport = false;
    exporting = false;
    loading = false;
    error = '';
    note = '';
    logging = new Set<number>();
    logged = new Set<number>();

    constructor(private service:CustomersService){}

    ngOnInit(){
        this.service.privacy().subscribe(p => this.canExport = !!p.canExport, () => this.canExport = false);
        this.service.audiences().subscribe(r => { this.audiences = r.audiences; this.capDays = r.contactCapDays; },
            err => this.error = this.say(err, 'Could not load the audiences.'));
    }

    pick(a:any){
        this.selected = a;
        this.logged.clear();
        this.note = '';
        this.message = this.saved(a.key) ?? '';
        this.run();
    }

    run(){
        if(!this.selected) return;
        this.loading = true;
        this.error = '';
        this.service.audience({ audience: this.selected.key, product: this.product, months: this.months, kind: this.kind, locality: this.locality }).subscribe(r => {
            this.result = r;
            this.loading = false;
        }, err => { this.loading = false; this.error = this.say(err, 'Could not load the audience.'); });
    }

    // the wording is kept per audience in this browser, so the next campaign starts from the last one
    private saved(key:string):string | null{
        try { return localStorage.getItem('cust-aud-msg-' + key); } catch { return null; }
    }

    get text():string{
        return this.message || DEFAULT_MESSAGES[this.selected?.key] || '';
    }

    saveText(){
        try { localStorage.setItem('cust-aud-msg-' + this.selected.key, this.message); } catch { /* private window: the text just is not remembered */ }
    }

    messageFor(m:any):string{
        return this.text.replace(/\{name\}/g, greetingName(m.name));
    }

    whatsapp(m:any):string{
        return `https://wa.me/91${m.mobile}?text=${encodeURIComponent(this.messageFor(m))}`;
    }

    /** why people are left out, in counts: the gap is shown, not hidden */
    get leftOut():{ why:string, n:number }[]{
        const by = new Map<string, number>();
        for(const m of (this.result?.members || [])) if(!m.canContact) by.set(m.why, (by.get(m.why) || 0) + 1);
        return [...by.entries()].map(([why, n]) => ({ why, n })).sort((a, b) => b.n - a.n);
    }

    /** the first 200 rows are drawn; the CSV carries everyone who can be contacted */
    get shown():any[]{
        return (this.result?.members || []).slice(0, 200);
    }

    get contactable():any[]{
        return (this.result?.members || []).filter((m:any) => m.canContact);
    }

    markSent(m:any, channel:'WHATSAPP'|'CALL'){
        this.logging.add(m.id);
        this.service.recordContact(m.id, { channel, outcome: 'SENT', audience: this.selected.key }).subscribe(() => {
            this.logging.delete(m.id);
            this.logged.add(m.id);
        }, err => { this.logging.delete(m.id); this.error = this.say(err, 'Could not record the contact.'); });
    }

    /** the file is made on the server, which checks the permission and keeps a record of who took which list */
    exportCsv(){
        this.exporting = true;
        this.error = '';
        this.service.exportAudience({ audience: this.selected.key, product: this.product, months: this.months, kind: this.kind, locality: this.locality, message: this.text }).subscribe(r => {
            this.exporting = false;
            const blob = new Blob(['\ufeff' + r.csv], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = r.filename;
            a.click();
            URL.revokeObjectURL(a.href);
            this.note = `Downloaded ${r.count} customers. The download is recorded and the file names who took it.`;
        }, err => { this.exporting = false; this.error = this.say(err, 'Could not download the list.'); });
    }

    private say(err:any, fallback:string):string{
        const m = err?.error?.message;
        return Array.isArray(m) ? m.join(' ') : (m || fallback);
    }
}
