import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { DrugRegisterService } from "./drug-register.service";
import { detailProblems, ScheduleDetail } from "./drug-register-rules";
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

    suggestions: any[] = [];
    private timer: any = null;

    rxOpen = false;
    rxFile: File | null = null;
    rx: { patient_mobile: string; doctor_phone: string } = { patient_mobile: '', doctor_phone: '' };
    rxBusy = false;
    rxError = '';
    rxMessage = '';

    constructor(private service: DrugRegisterService, private files: FileUploadService, private docs: DocumentsService, private customers: CustomersService) {}

    ngOnChanges(c: SimpleChanges) {
        // the patient is usually the customer: start from them, once, when nothing has been typed
        if ((c['customer'] || c['detail']) && this.customer && !this.detail.patient_name && this.customer.name && String(this.customer.name).trim().toUpperCase() !== 'NIL') {
            this.detail.patient_name = this.customer.name;
            if (!this.detail.patient_address && this.customer.address) this.detail.patient_address = this.customer.address;
        }
    }

    get problems(): string[] { return detailProblems(this.detail); }

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
                    this.uploaded.emit(doc);
                };
                if (this.customerId) this.customers.addDocument({ customerId: this.customerId, documentId: doc.id }).subscribe(done, fail);
                else done();
            }, fail);
        }, fail);
    }
}
