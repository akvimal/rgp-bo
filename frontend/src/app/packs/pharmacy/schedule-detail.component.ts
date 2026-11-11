import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { DrugRegisterService } from "./drug-register.service";
import { detailProblems, laterDefault, laterLast, RX_CHOICES, RX_LABELS, rxProblems, ScheduleDetail, withoutPrescription } from "./drug-register-rules";
import { FileUploadService } from "src/app/secured/documents/file-upload.service";
import { DocumentsService } from "src/app/secured/documents/documents.service";
import { CustomersService } from "src/app/secured/customers/customers.service";

/**
 * The patient and the prescriber for the scheduled drugs on a bill (pharmacy pack). It edits the bill's own details object in place, so the bill sends
 * it and a bill held for later keeps it. The patient starts as the customer; the prescriber is picked from the people already on earlier bills.
 * The details are optional on the bill unless the shop holds bills back (enforce); a picture or PDF of the prescription can be uploaded here, kept with the
 * customer, and attached to the bill, with the patient and the doctor entered above.
 */
@Component({
    selector: 'app-schedule-detail',
    templateUrl: './schedule-detail.component.html'
})
export class ScheduleDetailComponent implements OnChanges {

    @Input() detail: ScheduleDetail = {};
    /** the scheduled drugs on the bill */
    @Input() drugs: any[] = [];
    @Input() customer: any = null;
    /** the shop holds a bill back until the details are given; otherwise they are optional */
    @Input() enforce = false;
    /** the details are being added to a bill already completed (from the drug register) */
    @Input() later = false;
    /** the documents on the bill, of which the prescriptions are listed */
    @Input() documents: any[] = [];
    /** a prescription was uploaded: the document as saved */
    @Output() uploaded = new EventEmitter<any>();
    /** a prescription taken for another patient is let go of: its document id (the bill drops it) */
    @Output() detached = new EventEmitter<number>();

    suggestions: any[] = [];
    private timer: any = null;

    rxOpen = false;
    rxFile: File | null = null;
    rx: { patient_mobile: string; doctor_phone: string } = { patient_mobile: '', doctor_phone: '' };
    rxBusy = false;
    rxError = '';
    rxMessage = '';

    constructor(private service: DrugRegisterService, private files: FileUploadService, private docs: DocumentsService, private customers: CustomersService) {}

    /** what is already on record for the customer: prescriptions kept with them, and the patient and prescriber of their last supplies */
    ctx: { prescriptions: any[]; last: any[]; patients?: any[]; prescribers?: any[]; standing_months: number } | null = null;
    /** the one in use now ("rx12" or "last0"), so the person can see it was taken */
    usedKey = '';
    private ctxFor = 0;

    ngOnChanges(c: SimpleChanges) {
        if (c['customer']) this.loadContext();
        // the patient is usually the customer: start from them, once, when nothing has been typed
        if ((c['customer'] || c['detail']) && this.customer && !this.detail.patient_name && this.customer.name && String(this.customer.name).trim().toUpperCase() !== 'NIL') {
            this.detail.patient_name = this.customer.name;
            if (!this.detail.patient_address && this.customer.address) this.detail.patient_address = this.customer.address;
            this.patientUndo = { patient_name: '', patient_age: this.detail.patient_age || '', patient_address: '' };
            this.patientSrc = this.customerId ? 'the customer record' : 'the bill';
        }
    }

    get problems(): string[] { return detailProblems(this.detail, undefined, this.hasPrescription); }
    /** no prescription is in hand, so the prescriber is not asked for (it can be added when the prescription arrives) */
    get prescriberOptional(): boolean { return !this.hasPrescription && withoutPrescription(this.detail.rx_basis); }

    // ------------------------------------------------------------ how the prescription stands
    choices = RX_CHOICES;
    labels = RX_LABELS;
    get hasPrescription(): boolean { return this.prescriptions.length > 0; }
    get rxIssues(): string[] { return rxProblems(this.detail, this.hasPrescription, this.later || this.customerId > 0); }
    get laterFirst(): string { return this.today; }
    get laterEnd(): string { return laterLast(this.today); }

    /** "Will bring it later" starts a week out; a choice that needs no day or words clears them */
    basisChanged() {
        if (this.detail.rx_basis === 'LATER') { if (!this.detail.rx_due) this.detail.rx_due = laterDefault(this.today); }
        else this.detail.rx_due = '';
        if (this.detail.rx_basis !== 'OTHER' && this.detail.rx_basis !== 'LATER' && this.detail.rx_basis !== 'COULD_NOT' && this.detail.rx_basis !== 'REGULAR' && this.detail.rx_basis !== 'SEEN') this.detail.rx_note = '';
        this.detail.rx_document_id = undefined;
    }

    private loadContext() {
        const id = this.customerId;
        if (id === this.ctxFor) return;
        this.ctxFor = id; this.ctx = null; this.usedKey = '';
        if (!id) return;
        this.service.customerContext(id).subscribe((r) => { if (this.ctxFor === id) this.ctx = r; }, () => this.ctx = null);
    }

    /** take the details of a prescription kept with the customer, and carry it on the bill (not when adding details to a bill already completed) */
    useRx(p: any) {
        if (p.patient) this.detail.patient_name = p.patient;
        if (p.doctor) { this.detail.prescriber_name = p.doctor; this.detail.prescriber_reg_no = p.reg_no || ''; this.detail.prescriber_address = p.address || ''; }
        if (p.date && p.date <= this.today) this.detail.rx_date = p.date;
        this.usedKey = 'rx' + p.id; this.usedRxId = p.id; this.usedRxPatient = p.patient || '';
        this.patientKey = ''; this.patientSrc = ''; this.rxPatientWarning = '';
        this.detail.rx_basis = 'ON_FILE'; this.detail.rx_document_id = p.id; this.detail.rx_due = '';
        this.detail.rx_note = this.standingNote(!!p.expired, p.date || p.added);
        if (!this.later) this.uploaded.emit({ id: p.id, category: p.category, name: p.name, alias: p.alias, path: p.path, docprops: p.docprops });
    }

    /** the same patient and prescriber as the customer's last supply */
    useLast(l: any, i: number) {
        this.detail.patient_name = l.patient_name || '';
        this.detail.patient_address = l.patient_address || this.detail.patient_address || '';
        this.detail.patient_age = l.patient_age || '';
        this.detail.prescriber_name = l.prescriber_name || '';
        this.detail.prescriber_reg_no = l.prescriber_reg_no || '';
        this.detail.prescriber_address = l.prescriber_address || '';
        this.detail.rx_date = l.rx_date && l.rx_date <= this.today ? l.rx_date : null;
        this.usedKey = 'last' + i; this.usedRxId = 0; this.usedRxPatient = '';
        this.patientKey = ''; this.patientSrc = ''; this.prescriberKey = ''; this.prescriberSrc = ''; this.rxPatientWarning = '';
        this.detail.rx_basis = 'LAST_SUPPLY'; this.detail.rx_document_id = undefined; this.detail.rx_due = '';
        this.detail.rx_note = this.standingNote(!!l.expired, l.rx_date || l.entry_on);
    }

    /** the scheduled drugs on the bill that are not marked chronic: a prescription is used again only for a repeat supply of a chronic medicine */
    get notChronic(): string[] {
        if (this.later) return [];
        return this.drugs.filter((d: any) => String(d.more_props?.chronic) !== 'true').map((d: any) => d.title);
    }

    /** using this record again needs a second look: it is past its validity, or a drug on the bill is not chronic */
    warns(expired: boolean): boolean { return expired || this.notChronic.length > 0; }

    /** what goes on the register line when a record is used though it needs a second look */
    private standingNote(expired: boolean, day: string): string {
        const out: string[] = [];
        if (expired) out.push(`used past ${this.ctx?.standing_months ?? 6} months (dated ${day || 'unknown'})`);
        if (this.notChronic.length) out.push('medicine not marked chronic');
        return out.length ? out.join('; ').replace(/^./, (x) => x.toUpperCase()) : '';
    }

    // ------------------------------------------------------------ copying a patient or a doctor, one at a time
    /** where the patient on the bill came from, shown under the fields with an Undo; empty once someone types over it */
    patientSrc = '';
    patientKey = '';
    private patientUndo: { patient_name: string; patient_age: string; patient_address: string } | null = null;
    prescriberSrc = '';
    prescriberKey = '';
    private prescriberUndo: { prescriber_name: string; prescriber_reg_no: string; prescriber_address: string } | null = null;
    /** the prescription in use, and whom it is for: another patient chosen later lets it go */
    usedRxId = 0;
    usedRxPatient = '';
    rxPatientWarning = '';

    private norm(v: any): string { return String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase(); }
    private short(day: string): string { return day ? new Date(day + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''; }

    /** the customer first (from their record), then the other people on their earlier supplies */
    get patientChips(): { key: string; label: string; name: string; address: string; age: string; source: string }[] {
        const past: any[] = this.ctx?.patients || [];
        const out: { key: string; label: string; name: string; address: string; age: string; source: string }[] = [];
        const cust = this.customerId ? this.customerName : '';
        if (cust) {
            const same = past.find((p) => this.norm(p.name) === this.norm(cust));
            out.push({ key: 'cust', label: 'Customer: ' + cust, name: cust, address: this.customer?.address || same?.address || '', age: same?.age || '', source: 'the customer record' });
        }
        past.forEach((p, i) => {
            if (cust && this.norm(p.name) === this.norm(cust)) return;
            out.push({ key: 'p' + i, label: p.age ? `${p.name}, ${p.age}` : p.name, name: p.name, address: p.address || '', age: p.age || '', source: 'last supply, ' + this.short(p.last_on) });
        });
        return out;
    }

    get prescriberChips(): { key: string; label: string; name: string; reg_no: string; address: string; source: string }[] {
        return (this.ctx?.prescribers || []).map((d: any, i: number) => ({
            key: 'd' + i, label: d.reg_no ? `${d.name} \u00b7 ${d.reg_no}` : d.name, name: d.name, reg_no: d.reg_no || '', address: d.address || '', source: 'last supply, ' + this.short(d.last_on),
        }));
    }

    copyPatient(c: { key: string; name: string; address: string; age: string; source: string }) {
        this.patientUndo = { patient_name: this.detail.patient_name || '', patient_age: this.detail.patient_age || '', patient_address: this.detail.patient_address || '' };
        this.detail.patient_name = c.name; this.detail.patient_age = c.age; this.detail.patient_address = c.address;
        this.patientKey = c.key; this.patientSrc = c.source;
        // a prescription in use belongs to its own patient: another one chosen lets it go
        if (this.usedRxId && this.usedRxPatient && this.norm(this.usedRxPatient) !== this.norm(c.name)) {
            this.rxPatientWarning = `The prescription on file is for ${this.usedRxPatient}, not ${c.name}, so it is not attached. Upload one for ${c.name}, or say why there is none.`;
            this.detached.emit(this.usedRxId);
            this.usedRxId = 0; this.usedRxPatient = ''; this.usedKey = '';
            this.detail.rx_basis = ''; this.detail.rx_document_id = undefined; this.detail.rx_note = '';
        } else this.rxPatientWarning = '';
    }

    /** someone not offered above: the patient fields are cleared and the cursor goes to the name */
    patientElse() {
        this.patientUndo = { patient_name: this.detail.patient_name || '', patient_age: this.detail.patient_age || '', patient_address: this.detail.patient_address || '' };
        this.detail.patient_name = ''; this.detail.patient_age = ''; this.detail.patient_address = '';
        this.patientKey = 'else'; this.patientSrc = '';
        setTimeout(() => (document.querySelector('[data-testid=sd-patient-name]') as HTMLInputElement | null)?.focus());
    }

    undoPatient() {
        if (this.patientUndo) Object.assign(this.detail, this.patientUndo);
        this.patientUndo = null; this.patientKey = ''; this.patientSrc = '';
    }

    /** typing over a copied value: it is no longer "from" anywhere */
    patientTyped() { this.patientSrc = ''; this.patientKey = ''; }

    copyPrescriber(c: { key: string; name: string; reg_no: string; address: string; source: string }) {
        this.prescriberUndo = { prescriber_name: this.detail.prescriber_name || '', prescriber_reg_no: this.detail.prescriber_reg_no || '', prescriber_address: this.detail.prescriber_address || '' };
        this.detail.prescriber_name = c.name; this.detail.prescriber_reg_no = c.reg_no; this.detail.prescriber_address = c.address;
        this.prescriberKey = c.key; this.prescriberSrc = c.source; this.suggestions = [];
    }

    prescriberElse() {
        this.prescriberUndo = { prescriber_name: this.detail.prescriber_name || '', prescriber_reg_no: this.detail.prescriber_reg_no || '', prescriber_address: this.detail.prescriber_address || '' };
        this.detail.prescriber_name = ''; this.detail.prescriber_reg_no = ''; this.detail.prescriber_address = '';
        this.prescriberKey = 'else'; this.prescriberSrc = ''; this.suggestions = [];
        setTimeout(() => (document.querySelector('[data-testid=sd-prescriber-name]') as HTMLInputElement | null)?.focus());
    }

    undoPrescriber() {
        if (this.prescriberUndo) Object.assign(this.detail, this.prescriberUndo);
        this.prescriberUndo = null; this.prescriberKey = ''; this.prescriberSrc = ''; this.suggestions = [];
    }

    prescriberTyped() { this.prescriberSrc = ''; this.prescriberKey = ''; }

    /** a prescription on file cannot be taken for a patient picked from the chips when it is someone else's */
    rxMismatch(p: any): boolean {
        return !!this.patientKey && this.patientKey !== 'else' && !!p.patient && this.norm(this.detail.patient_name) !== this.norm(p.patient);
    }

    /** the chips are worked out afresh each time, so the buttons are kept by their key: otherwise they are rebuilt under the pointer and a click is lost */
    chipKey = (_: number, c: { key: string }) => c.key;

    /** the customer is not on record: there is nothing of theirs to copy */
    get walkIn(): boolean { return !this.later && !this.customerId && !!this.customerName; }

    get names(): string {
        const seen: { [k: string]: boolean } = {};
        return this.drugs.map((d: any) => `${d.title} (${d.more_props?.schedule})`).filter((n) => !seen[n] && (seen[n] = true)).join(', ');
    }

    search() {
        clearTimeout(this.timer);
        const q = (this.detail.prescriber_name || '').trim();
        if (q.length < 2) { this.suggestions = []; return; }
        this.timer = setTimeout(() => this.service.prescribers(q).subscribe((r) => this.suggestions = r, () => this.suggestions = []), 200);
    }

    pick(p: any) {
        this.detail.prescriber_name = p.name;
        this.detail.prescriber_reg_no = p.reg_no || '';
        this.detail.prescriber_address = p.address || '';
        this.suggestions = [];
        this.prescriberKey = ''; this.prescriberSrc = '';
    }

    get today(): string { return new Date().toISOString().slice(0, 10); }

    // ------------------------------------------------------------ the prescription picture
    /** the customer the prescription is kept with: only one who is already on record has somewhere to keep it */
    get customerId(): number { return this.customer?.existing && this.customer?.id ? +this.customer.id : 0; }
    get customerName(): string { return this.customer?.name && String(this.customer.name).trim().toUpperCase() !== 'NIL' ? String(this.customer.name) : ''; }

    get prescriptions(): any[] { return (this.documents || []).filter((d: any) => String(d.category || '').toLowerCase() === 'prescription'); }

    openRx() {
        this.rxOpen = true; this.rxError = ''; this.rxMessage = '';
        const m = String(this.customer?.mobile || '').replace(/\D/g, '');
        if (!this.rx.patient_mobile && /^[6-9]\d{9}$/.test(m)) this.rx.patient_mobile = m;
    }

    closeRx() { this.rxOpen = false; this.rxFile = null; this.rxError = ''; }

    pickFile(e: any) { this.rxFile = e.target.files?.[0] || null; this.rxError = ''; }

    digits(key: 'patient_mobile' | 'doctor_phone') { this.rx[key] = String(this.rx[key] || '').replace(/\D/g, '').slice(0, 10); }

    /** what is still missing for the upload: the file, the patient and the doctor (above) and the patient's mobile */
    get rxProblems(): string[] {
        const out: string[] = [];
        if (!this.rxFile) out.push('the picture or PDF');
        if (String(this.detail.patient_name || '').trim().length < 2) out.push("the patient's name");
        if (String(this.detail.prescriber_name || '').trim().length < 3) out.push("the doctor's name");
        if (!/^\d{10}$/.test(this.rx.patient_mobile)) out.push("the patient's 10-digit mobile number");
        if (this.rx.doctor_phone && !/^\d{10}$/.test(this.rx.doctor_phone)) out.push("a 10-digit doctor phone, or none");
        return out;
    }

    uploadRx() {
        if (this.rxProblems.length || !this.rxFile) return;
        this.rxBusy = true; this.rxError = ''; this.rxMessage = '';
        const fail = (e: any) => { this.rxBusy = false; const m = e?.error?.message; this.rxError = (Array.isArray(m) ? m.join(' ') : m) || 'The prescription could not be uploaded. Try again.'; };
        this.files.upload(this.rxFile, 'customer=' + (this.customerId || 'new')).subscribe((ev: any) => {
            if (typeof ev !== 'object') return;
            const date = this.detail.rx_date || this.today;
            const props = [
                { id: 'prescdate', label: 'Date', value: date },
                { id: 'doctorname', label: 'Doctor Name', value: this.detail.prescriber_name || '' },
                { id: 'doctorphone', label: 'Doctor Phone', value: this.rx.doctor_phone },
                { id: 'ptntname', label: 'Patient Name', value: this.detail.patient_name || '' },
                { id: 'ptntmobile', label: 'Patient Phone', value: this.rx.patient_mobile },
            ];
            const extn = String(ev.filename || ev.originalname || '').split('.').pop()?.toLowerCase() || '';
            const alias = `${this.detail.prescriber_name} prescription, ${date}`;
            this.docs.save({ name: ev.originalname, path: ev.path, extn, category: 'Prescription', alias, docprops: JSON.stringify(props), uploadprops: JSON.stringify(ev) } as any).subscribe((doc: any) => {
                const done = () => {
                    this.rxBusy = false;
                    this.rxMessage = this.customerId ? `Prescription saved to ${this.customerName || 'the customer'}'s documents${this.later ? '' : ' and attached to this bill'}.` : 'Prescription attached to this bill. Add the customer to keep it with their record.';
                    this.rxOpen = false; this.rxFile = null;
                    this.detail.rx_basis = 'ATTACHED'; this.detail.rx_document_id = doc?.id; this.detail.rx_due = '';
                    this.uploaded.emit(doc);
                };
                if (this.customerId) this.customers.addDocument({ customerId: this.customerId, documentId: doc.id }).subscribe(done, fail);
                else done();
            }, fail);
        }, fail);
    }
}
