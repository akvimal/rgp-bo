import { Component, OnInit } from "@angular/core";
import { CustomersService } from "../customers.service";
import { greetingName } from "../greeting";

const OUTCOMES = [
    { value: 'REACHED', label: 'Spoke to them' },
    { value: 'SENT', label: 'Message sent' },
    { value: 'NO_ANSWER', label: 'No answer' },
    { value: 'CALLBACK', label: 'Call back later' },
    { value: 'NOT_INTERESTED', label: 'Not interested' },
    { value: 'WRONG_NUMBER', label: 'Wrong number' },
    { value: 'ASKED_TO_STOP', label: 'Asked us to stop' },
];

const SNOOZE_REASONS = [
    { value: 'CALL_LATER', label: 'Asked to be called later' },
    { value: 'AWAY', label: 'Away or travelling' },
    { value: 'UNWELL', label: 'Unwell' },
    { value: 'BUSY', label: 'Too busy to call today' },
    { value: 'WAITING_STOCK', label: 'Waiting for stock or medicine' },
    { value: 'OTHER', label: 'Other (say what)' },
];

const REMINDERS: Record<string, string> = {
    due_back: 'Hello {name}, a gentle reminder from us: it is about time for your regular medicines. We are here whenever you need them.',
    at_risk: 'Hello {name}, we have not seen you for a while and wanted to check that all is well. Please let us know if there is anything we can do.',
    new_second_visit: 'Hello {name}, thank you for visiting us. We would be glad to see you again; ask us if there is anything we can help with.',
};

/** Today's short list of people worth a call or message, best spenders first. Logging an outcome takes the person off the list for the contact gap. */
@Component({
    selector: 'app-customer-worklist',
    templateUrl: 'customer-worklist.component.html'
})
export class CustomerWorklistComponent implements OnInit {

    outcomes = OUTCOMES;
    snoozeReasons = SNOOZE_REASONS;
    snoozed:any[] = [];
    showSnoozed = false;
    rows:any[] = [];
    waiting = 0;
    capDays = 7;
    loading = true;
    error = '';
    message = '';
    busy = new Set<number>();
    privacy:any = null;

    constructor(private service:CustomersService){}

    ngOnInit(){
        try { const l = localStorage.getItem('rgp_followup_lang'); if(l === 'en' || l === 'ta') this.lang = l; } catch { /* a private window */ }
        this.loadWording();
        this.service.privacy().subscribe(p => this.privacy = p, () => this.privacy = null);
        this.load();
    }

    get dailyLimitReached():boolean{
        return !!this.privacy && this.privacy.left === 0;
    }

    /** numbers arrive masked for a login that may not read them all: showing one is counted and kept */
    reveal(r:any){
        this.error = '';
        this.busy.add(r.id);
        this.service.reveal(r.id).subscribe(d => {
            this.busy.delete(r.id);
            r.mobile = d.mobile;
            r.masked = false;
            this.service.privacy().subscribe(p => this.privacy = p, () => undefined);
        }, err => { this.busy.delete(r.id); this.error = this.say(err, 'Could not show the number.'); });
    }

    load(){
        this.loading = true;
        this.service.worklist().subscribe(r => {
            this.rows = r.rows.map((x:any) => ({ ...x, channel: x.preferredChannel === 'WHATSAPP' ? 'WHATSAPP' : 'CALL', outcome: '', note: '' }));
            this.waiting = r.waiting;
            this.snoozed = r.snoozed || [];
            this.capDays = r.contactCapDays;
            this.loading = false;
        }, err => { this.loading = false; this.error = this.say(err, 'Could not load the list.'); });
    }

    /** the message for this customer, in the language chosen, from the shop's wording (the standard wording when it cannot be loaded) */
    textFor(r:any):string{
        const t = this.tpl?.templates?.[r.audience]?.[this.lang] || REMINDERS[r.audience] || '';
        const amount = r.amount === null || r.amount === undefined ? '' : `Rs ${Math.round(r.amount).toLocaleString('en-IN')}`;
        return t.replace(/\{name\}/g, greetingName(r.name)).replace(/\{store\}/g, this.tpl?.store || 'our shop').replace(/\{amount\}/g, amount).replace(/\s+/g, ' ').trim();
    }

    whatsapp(r:any):string{
        return `https://wa.me/91${r.mobile}?text=${encodeURIComponent(this.textFor(r))}`;
    }

    // ------------------------------------------------------------ the wording of the messages
    lang:'en'|'ta' = 'en';
    tpl:any = null;
    wording:any = null;
    wordingOpen = false;
    wordingBusy = false;
    wordingError = '';
    wordingMessage = '';

    setLang(l:'en'|'ta'){
        this.lang = l;
        try { localStorage.setItem('rgp_followup_lang', l); } catch { /* it just will not be remembered */ }
    }

    loadWording(){
        this.service.followupTemplates().subscribe(t => { this.tpl = t; }, () => { this.tpl = null; });
    }

    openWording(){
        this.wordingOpen = !this.wordingOpen;
        this.wordingError = this.wordingMessage = '';
        if(this.wordingOpen && this.tpl) this.wording = JSON.parse(JSON.stringify(this.tpl.templates));
    }

    saveWording(){
        this.wordingBusy = true; this.wordingError = this.wordingMessage = '';
        this.service.saveFollowupTemplates(this.wording).subscribe(t => {
            this.wordingBusy = false; this.tpl = t; this.wording = JSON.parse(JSON.stringify(t.templates)); this.wordingMessage = 'The wording is saved. New messages use it.';
        }, err => { this.wordingBusy = false; this.wordingError = this.say(err, 'Could not save the wording.'); });
    }

    resetWording(){
        this.wordingBusy = true; this.wordingError = this.wordingMessage = '';
        this.service.resetFollowupTemplates().subscribe(t => {
            this.wordingBusy = false; this.tpl = t; this.wording = JSON.parse(JSON.stringify(t.templates)); this.wordingMessage = 'Back to the standard wording.';
        }, err => { this.wordingBusy = false; this.wordingError = this.say(err, 'Could not reset the wording.'); });
    }

    draftWording(){
        this.wordingBusy = true; this.wordingError = this.wordingMessage = '';
        this.service.draftFollowupTemplates().subscribe(d => {
            this.wordingBusy = false; this.wording = d.templates; this.wordingMessage = 'The assistant wrote a first version. Read it, change what you like, and press Save.';
        }, err => { this.wordingBusy = false; this.wordingError = this.say(err, 'The assistant could not write the wording.'); });
    }

    /** opens the postpone panel on a row: a reason (and a few words for "Other"), then it goes until tomorrow */
    openSnooze(r:any){
        r.snoozing = !r.snoozing;
        r.snoozeReason = r.snoozeReason || '';
        r.snoozeNote = r.snoozeNote || '';
        r.snoozeError = '';
    }

    snooze(r:any){
        r.snoozeError = '';
        if(!r.snoozeReason){ r.snoozeError = 'Choose why this is being postponed.'; return; }
        if(r.snoozeReason === 'OTHER' && String(r.snoozeNote || '').trim().length < 3){ r.snoozeError = 'Say in a few words why.'; return; }
        this.busy.add(r.id);
        this.service.snooze(r.id, { reason: r.snoozeReason, note: r.snoozeNote }).subscribe(z => {
            this.busy.delete(r.id);
            this.message = `${String(r.name || '').trim() || 'The customer'} is postponed until tomorrow: ${z.reason}.`;
            this.load();
        }, err => { this.busy.delete(r.id); r.snoozeError = this.say(err, 'Could not postpone.'); });
    }

    bringBack(s:any){
        this.error = '';
        this.service.unsnooze(s.id).subscribe(() => { this.message = `${String(s.name || '').trim() || 'The customer'} is back on today's list.`; this.load(); },
            err => this.error = this.say(err, 'Could not bring them back.'));
    }

    log(r:any){
        if(!r.outcome) return;
        this.error = '';
        this.busy.add(r.id);
        this.service.recordContact(r.id, { channel: r.channel, outcome: r.outcome, audience: r.audience, note: r.note }).subscribe(() => {
            this.busy.delete(r.id);
            this.rows = this.rows.filter(x => x.id !== r.id);
            this.waiting = Math.max(0, this.waiting - 1);
            const who = String(r.name || '').trim() || r.mobile;
            this.message = r.outcome === 'ASKED_TO_STOP'
                ? `${who} will not be contacted again.`
                : `Logged for ${who}. They are off the list for ${this.capDays} days.`;
        }, err => { this.busy.delete(r.id); this.error = this.say(err, 'Could not record the contact.'); });
    }

    private say(err:any, fallback:string):string{
        const m = err?.error?.message;
        return Array.isArray(m) ? m.join(' ') : (m || fallback);
    }
}
