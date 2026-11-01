import { Component, OnInit } from "@angular/core";
import { AuthService } from "src/app/@core/auth/auth.service";
import { DrugRegisterService } from "./drug-register.service";

/**
 * The prescriptions customers promised to bring (pharmacy pack), shown at the top of the customer worklist. A follow-up closes by itself when a prescription is
 * kept with the customer; a manager can stop chasing one, with the reason, and the register line then says the customer could not provide it.
 */
@Component({
    selector: 'app-rx-followups',
    templateUrl: './rx-followups.component.html'
})
export class RxFollowupsComponent implements OnInit {

    rows: any[] = [];
    error = '';
    message = '';
    busy = new Set<number>();

    constructor(private service: DrugRegisterService, private auth: AuthService) {}

    ngOnInit() {
        if (!this.auth.moduleOn('drug_register')) return;
        this.load();
    }

    load() { this.service.followups().subscribe((r) => this.rows = r.rows || [], () => this.rows = []); }

    openWaive(r: any) { r.waiving = !r.waiving; r.waiveNote = r.waiveNote || ''; r.waiveError = ''; }

    waive(r: any) {
        r.waiveError = '';
        if (String(r.waiveNote || '').trim().length < 3) { r.waiveError = 'Say in a few words why.'; return; }
        this.busy.add(r.id);
        this.service.waiveFollowup(r.id, r.waiveNote).subscribe(() => {
            this.busy.delete(r.id);
            this.message = `Bill ${r.bill_no}: no longer chased. The register says the customer could not provide it.`;
            this.load();
        }, (e: any) => { this.busy.delete(r.id); const m = e?.error?.message; r.waiveError = (Array.isArray(m) ? m.join(' ') : m) || 'Could not close it.'; });
    }
}
