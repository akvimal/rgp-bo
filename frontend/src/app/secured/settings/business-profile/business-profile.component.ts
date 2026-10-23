import { Component, OnInit } from "@angular/core";
import { BusinessesService } from "../businesses/businesses.service";

@Component({
    templateUrl: './business-profile.component.html'
})
export class BusinessProfileComponent implements OnInit {

    form: any = { name: '', legalname: '', gstin: '', statecode: '', address: '', pincode: '', approvalmode: 'separate' };
    loaded = false;
    /** a one-person shop: nobody else exists to approve, so the approvals choice is not shown */
    singlePerson = false;
    modules: any = null;
    modulesSaving = false;
    modulesMessage = '';
    modulesError = '';
    readonly moduleRows = [
        { key: 'hr', label: 'HR and attendance', hint: 'Staff records, attendance, leave, payroll, KPI ratings.' },
        { key: 'expenses', label: 'Expenses', hint: 'The expense ledger with approval.' },
        { key: 'payment_recon', label: 'Digital payment reconciliation', hint: 'Matching UPI / card takings to the provider statement.' },
        { key: 'stock_audits', label: 'Stock audits', hint: 'Planned cycle counts by category and store.' },
        { key: 'transfers', label: 'Stock transfers', hint: 'Moving stock between your stores.' },
        { key: 'gst', label: 'GST reconciliation', hint: 'Matching purchase invoices to GSTR-2A/2B. Needs purchasing.' },
    ];
    saving = false;
    message = '';
    error = '';

    constructor(private service: BusinessesService) {}

    ngOnInit() {
        this.service.getMyModules().subscribe((m: any) => this.modules = m, () => this.modules = null);
        this.service.getMine().subscribe((b: any) => this.fill(b), err => { this.loaded = true; this.error = this.msg(err, 'Could not load the business details.'); });
    }

    private fill(b: any) {
        this.form = {
            name: b.name || '', legalname: b.legalname || '', gstin: b.gstin || '',
            statecode: b.statecode || '', address: b.address || '', pincode: b.pincode || '', approvalmode: b.approvalmode || 'separate',
        };
        this.singlePerson = !!b.singleperson;
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

    /** Switching a module saves at once; the menus follow on the next screen change. */
    setModule(key: string, value: any) {
        this.modulesMessage = this.modulesError = '';
        this.modulesSaving = true;
        this.service.updateMyModules({ [key]: value }).subscribe(
            (m: any) => { this.modulesSaving = false; this.modules = m; this.modulesMessage = 'Saved. Menus update when you open the next screen.'; },
            err => { this.modulesSaving = false; this.modulesError = this.msg(err, 'Could not change the module.'); this.service.getMyModules().subscribe((m: any) => this.modules = m); });
    }

    /** a module the hosted plan leaves out cannot be switched on here */
    isLocked(key: string): boolean { return !!this.modules?.locked?.includes(key); }

    /** the modules the plan leaves out, in words (purchasing has its own box above) */
    get lockedLabels(): string {
        return this.moduleRows.filter(m => this.isLocked(m.key)).map(m => m.label).join(', ');
    }

    get hasOpenModules(): boolean { return this.moduleRows.some(m => !this.isLocked(m.key)); }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return Array.isArray(m) ? m.join(' ') : (m || fallback);
    }
}
