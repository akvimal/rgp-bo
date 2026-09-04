import { Component } from "@angular/core";
import { GstService } from "../gst.service";

@Component({
    templateUrl: './gst-reconciliation.component.html'
})
export class GstReconciliationComponent {

    period: string = this.currentPeriod();
    periods: any[] = [];
    currentPeriodRow: any = null;

    summary: any = null;
    worklist: any[] = [];
    statusFilter: string = 'ALL';
    loading: boolean = false;
    message: string = '';
    error: string = '';

    showDialog: boolean = false;
    dialogRow: any = null;
    dialogAction: string = '';
    dialogNote: string = '';

    readonly statusTabs = [
        { key: 'ALL', label: 'All' },
        { key: 'MATCHED', label: 'Matched' },
        { key: 'PROBABLE', label: 'Probable' },
        { key: 'MISMATCH', label: 'Mismatch' },
        { key: 'MISSING_IN_2B', label: 'Missing in 2B' },
        { key: 'MISSING_IN_BOOKS', label: 'Missing in books' },
        { key: 'ACCEPTED', label: 'Accepted' },
        { key: 'DISPUTED', label: 'Disputed' },
        { key: 'EXCLUDED', label: 'Excluded' },
        { key: 'CARRIED_FORWARD', label: 'Carried forward' },
    ];

    constructor(private service: GstService) {}

    ngOnInit() {
        this.refreshPeriods();
        this.refresh();
    }

    private currentPeriod() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    refreshPeriods() {
        this.service.listPeriods().subscribe((rows: any) => {
            this.periods = rows || [];
            this.currentPeriodRow = this.periods.find((p: any) => p.period === this.period) || null;
        });
    }

    refresh() {
        this.error = '';
        this.loading = true;
        this.service.summary(this.period).subscribe({
            next: (data: any) => { this.summary = data; this.loading = false; },
            error: (err) => { this.error = err?.error?.message || 'Unable to load the GST summary.'; this.loading = false; },
        });
        this.loadWorklist();
        this.refreshPeriods();
    }

    loadWorklist() {
        const status = this.statusFilter === 'ALL' ? undefined : this.statusFilter;
        this.service.worklist(this.period, status).subscribe((rows: any) => this.worklist = rows || []);
    }

    setStatusFilter(status: string) {
        this.statusFilter = status;
        this.loadWorklist();
    }

    get isLocked() {
        return this.currentPeriodRow?.status === 'LOCKED';
    }

    onFileSelected(event: any, source: '2A' | '2B') {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) {
            return;
        }
        this.message = '';
        this.error = '';
        const reader = new FileReader();
        reader.onload = () => {
            let parsed: any;
            try {
                parsed = JSON.parse(String(reader.result));
            } catch {
                this.error = `${file.name} is not valid JSON.`;
                return;
            }
            this.service.import(this.period, source, parsed).subscribe({
                next: (result: any) => {
                    this.message = `Imported ${result.imported} row(s) from ${source} for ${this.period}.`;
                    this.refresh();
                },
                error: (err) => { this.error = err?.error?.message || `Unable to import the ${source} file.`; },
            });
        };
        reader.readAsText(file);
    }

    runMatch() {
        this.message = '';
        this.error = '';
        this.service.runMatch(this.period).subscribe({
            next: (result: any) => {
                this.message = `Matched ${result.matched}, probable ${result.probable}, mismatch ${result.mismatch}, `
                    + `missing in 2B ${result.missingIn2b}, missing in books ${result.missingInBooks}.`;
                this.refresh();
            },
            error: (err) => { this.error = err?.error?.message || 'Unable to run the match.'; },
        });
    }

    lockPeriod() {
        this.message = '';
        this.error = '';
        this.service.lockPeriod(this.period).subscribe({
            next: () => { this.message = `Period ${this.period} locked.`; this.refresh(); },
            error: (err) => { this.error = err?.error?.message || 'Unable to lock the period.'; },
        });
    }

    openAction(row: any, action: string) {
        this.dialogRow = row;
        this.dialogAction = action;
        this.dialogNote = '';
        this.showDialog = true;
    }

    closeAction() {
        this.showDialog = false;
        this.dialogRow = null;
        this.dialogAction = '';
    }

    confirmAction() {
        if (!this.dialogRow) {
            return;
        }
        const id = this.dialogRow.id;
        const note = this.dialogNote || undefined;
        const obs = this.dialogAction === 'accept' ? this.service.accept(id, note)
            : this.dialogAction === 'dispute' ? this.service.dispute(id, this.dialogNote)
            : this.dialogAction === 'exclude' ? this.service.exclude(id, note)
            : this.service.carryForward(id, note);

        obs.subscribe({
            next: () => { this.closeAction(); this.refresh(); },
            error: (err: any) => { this.error = err?.error?.message || 'Unable to update this row.'; },
        });
    }

    createInvoice(row: any) {
        this.error = '';
        this.service.createInvoice(row.id).subscribe({
            next: () => { this.message = 'Draft invoice created from the portal row.'; this.refresh(); },
            error: (err) => { this.error = err?.error?.message || 'Unable to create an invoice from this row.'; },
        });
    }

    statusBadgeClass(status: string) {
        switch (status) {
            case 'MATCHED': case 'ACCEPTED': return 'bg-success';
            case 'PROBABLE': return 'bg-info text-dark';
            case 'MISMATCH': return 'bg-danger';
            case 'MISSING_IN_2B': return 'bg-warning text-dark';
            case 'MISSING_IN_BOOKS': return 'bg-secondary';
            case 'DISPUTED': return 'bg-danger';
            case 'EXCLUDED': return 'bg-light text-dark border';
            case 'CARRIED_FORWARD': return 'bg-info text-dark';
            default: return 'bg-light text-dark border';
        }
    }
}
