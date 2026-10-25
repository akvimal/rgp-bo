import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DrugRegisterService } from "./drug-register.service";
import { detailProblems, ScheduleDetail } from "./drug-register-rules";

/**
 * The patient and the prescriber for the scheduled drugs on a bill (pharmacy pack). It edits the bill's own details object in place, so the bill sends
 * it and a bill held for later keeps it. The patient starts as the customer; the prescriber is picked from the people already on earlier bills.
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

    suggestions: any[] = [];
    private timer: any = null;

    constructor(private service: DrugRegisterService) {}

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
}
