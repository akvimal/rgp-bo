import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import { StoreContextService } from "src/app/@core/store-context.service";
import { FileUploadService } from "src/app/secured/documents/file-upload.service";
import { DisposalService } from "../disposal.service";

/**
 * Stock > Expiry: the batches of a store that are expired or near expiry, by band. A batch is returned to its vendor (only when the vendor takes it back),
 * moved to another store, or discarded through an out-pass: several can go on one pass. Held is the quantity in an approved pass not yet handed over.
 */
@Component({ templateUrl: 'stock-expiry.component.html' })
export class StockExpiryComponent implements OnInit, OnDestroy {
    readonly bands = [{ key: 'EXPIRED', label: 'Expired' }, { key: 'D30', label: 'In 30 days' }, { key: 'D90', label: '31-90 days' }, { key: 'D180', label: '91-180 days' }];
    band = 'EXPIRED';
    data: any = null;
    error = '';
    message = '';
    needStore = false;
    picked: { [itemid: number]: boolean } = {};
    private storeId: number | null = null;
    private sub?: Subscription;

    displayReturn = false;
    returnItem: any = {};

    displayPass = false;
    pass: any = null;
    passError = '';
    passBusy = false;

    constructor(private service: DisposalService, private storeContext: StoreContextService, private files: FileUploadService, private router: Router) {}

    ngOnInit() {
        this.sub = this.storeContext.selectedStoreId$.subscribe((id: any) => { this.storeId = id || null; this.load(); });
    }
    ngOnDestroy() { this.sub?.unsubscribe(); }

    private seq = 0;

    load() {
        this.error = ''; this.needStore = false;
        const mine = ++this.seq;                                    // the store can change while a request is on its way: only the latest answer counts
        this.service.expiry(this.storeId).subscribe((d: any) => { if (mine !== this.seq) return; this.data = d; this.picked = {}; }, (e: any) => {
            if (mine !== this.seq) return;
            this.data = null;
            if (e?.status === 400 && /Choose a store/i.test(this.service.msg(e, ''))) this.needStore = true; else this.error = this.service.msg(e, 'The expiry list could not be loaded.');
        });
    }

    setBand(b: string) { this.band = b; this.picked = {}; }
    get shown(): any[] { return (this.data?.items || []).filter((i: any) => i.band === this.band); }
    get selectedItems(): any[] { return this.shown.filter((i: any) => this.picked[i.itemid] && i.sellable > 0); }
    get allSelected(): boolean { const s = this.shown.filter((i: any) => i.sellable > 0); return s.length > 0 && s.every((i: any) => this.picked[i.itemid]); }
    selectAll(on: boolean) { this.shown.forEach((i: any) => { if (i.sellable > 0) this.picked[i.itemid] = on; }); }

    startReturn(i: any) {
        this.returnItem = { id: i.itemid, item_id: i.itemid, title: i.title, batch: i.batch, exp_date: i.expdate, balance: i.balance };
        this.displayReturn = true;
    }
    returned() { this.displayReturn = false; this.message = 'Return recorded.'; this.load(); }

    startPass(items: any[]) {
        if (!items.length) return;
        this.passError = '';
        this.pass = {
            reason: items.every((i: any) => i.band === 'EXPIRED') ? 'EXPIRED' : 'NEAR_EXPIRY', method: 'DESTROYED', agency: '', notes: '', evidence_path: '',
            lines: items.map((i: any) => ({ itemid: i.itemid, title: i.title, batch: i.batch, expdate: i.expdate, schedule: i.schedule, max: i.sellable, qty: i.sellable })),
        };
        this.displayPass = true;
    }

    // ------------------------------------------------------------ the backlog: expired stock the books still hold
    displayBacklog = false;
    backlog: any = null;
    backlogError = '';
    backlogBusy = false;
    readonly today = new Date().toISOString().slice(0, 10);

    /** what goes on the backlog pass: the ticked expired batches, else every expired batch that still has stock */
    get backlogItems(): any[] {
        const expired = (this.data?.items || []).filter((i: any) => i.band === 'EXPIRED' && i.sellable > 0);
        const ticked = expired.filter((i: any) => this.picked[i.itemid]);
        return ticked.length ? ticked : expired;
    }
    get backlogUnits(): number { return this.backlogItems.reduce((t: number, i: any) => t + i.sellable, 0); }
    get backlogValue(): number { return this.backlogItems.reduce((t: number, i: any) => t + (i.balance ? i.value * i.sellable / i.balance : 0), 0); }

    startBacklog() { this.backlogError = ''; this.backlog = { handed_on: '', method: 'OTHER', agency: '', notes: '' }; this.displayBacklog = true; }

    saveBacklog() {
        this.backlogBusy = true; this.backlogError = '';
        const body: any = { storeid: this.data.storeid, handed_on: this.backlog.handed_on, method: this.backlog.method, agency: this.backlog.agency, notes: this.backlog.notes,
            lines: this.backlogItems.map((i: any) => ({ itemid: i.itemid, qty: i.sellable })) };
        this.service.backlog(body).subscribe((p: any) => { this.backlogBusy = false; this.displayBacklog = false; this.router.navigate(['/secure/store/stock/passes', p.id]); },
            (e: any) => { this.backlogBusy = false; this.backlogError = this.service.msg(e, 'It could not be recorded.'); });
    }

    uploadEvidence(event: any) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        this.files.upload(file, `disposal=${this.data?.storeid || 'x'}-${Date.now()}`).subscribe((r: any) => this.pass.evidence_path = r?.path || '', () => this.passError = 'Could not upload the file.');
    }

    savePass() {
        this.passError = '';
        this.passBusy = true;
        const body = { storeid: this.data.storeid, reason: this.pass.reason, method: this.pass.method, agency: this.pass.agency, notes: this.pass.notes, evidence_path: this.pass.evidence_path,
            lines: this.pass.lines.map((l: any) => ({ itemid: l.itemid, qty: Number(l.qty) })) };
        this.service.create(body).subscribe((p: any) => { this.passBusy = false; this.displayPass = false; this.router.navigate(['/secure/store/stock/passes', p.id]); },
            (e: any) => { this.passBusy = false; this.passError = this.service.msg(e, 'The out-pass could not be made.'); });
    }
}
