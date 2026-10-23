import { Component, OnInit } from "@angular/core";
import { BusinessesService } from "../businesses/businesses.service";

@Component({
    templateUrl: './business-profile.component.html'
})
export class BusinessProfileComponent implements OnInit {

    form: any = { name: '', legalname: '', gstin: '', statecode: '', address: '', pincode: '' };
    loaded = false;
    saving = false;
    message = '';
    error = '';

    constructor(private service: BusinessesService) {}

    ngOnInit() {
        this.service.getMine().subscribe((b: any) => this.fill(b), err => { this.loaded = true; this.error = this.msg(err, 'Could not load the business details.'); });
    }

    private fill(b: any) {
        this.form = {
            name: b.name || '', legalname: b.legalname || '', gstin: b.gstin || '',
            statecode: b.statecode || '', address: b.address || '', pincode: b.pincode || '',
        };
        this.loaded = true;
    }

    /** The first two characters of a GSTIN are the state: show it as it is typed. */
    get stateFromGstin(): string {
        const g = (this.form.gstin || '').trim();
        return /^[0-9]{2}/.test(g) ? g.substring(0, 2) : '';
    }

    save() {
        this.message = '';
        this.error = '';
        this.saving = true;
        const body: any = { ...this.form, gstin: (this.form.gstin || '').trim().toUpperCase() };
        if (this.stateFromGstin) body.statecode = this.stateFromGstin;
        this.service.updateMine(body).subscribe(
            (b: any) => { this.saving = false; this.fill(b); this.message = 'Business details saved.'; },
            err => { this.saving = false; this.error = this.msg(err, 'Could not save the business details.'); });
    }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return Array.isArray(m) ? m.join(' ') : (m || fallback);
    }
}
