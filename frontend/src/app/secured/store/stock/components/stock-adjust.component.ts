import { StoreContextService } from "src/app/@core/store-context.service";
import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { StockService } from "../stock.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { STOCK_ADJUSTMENT_REASONS, directionOfQty, reasonLabel, reasonsFor } from "../reason-codes";

@Component({
    templateUrl: './stock-adjust.component.html',
    styles: [
        `
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        `
    ]
})
export class StockAdjustComponent {

    quantities:any[] = [];
    reasonOptions = STOCK_ADJUSTMENT_REASONS;
    readonly reasonLabel = reasonLabel;

    displayEditDialog = false;
    editForm:any = { id: null, direction: 'REMOVE', qty: 0, reasoncode: '', comments: '' };
    message = '';

    /** the audit whose adjustments are shown (from the Done list), if any */
    auditFilter:number|null = null;

    constructor(private stockService:StockService, private confirm:ConfirmService, private storeContext:StoreContextService, private route:ActivatedRoute, private router:Router) {}

    ngOnInit() {
       this.route.queryParamMap.subscribe(p => {
           this.auditFilter = Number(p.get('audit')) || null;
           this.fetchAdjustments();
       });
    }

    /** SA-0012 */
    auditNo(n:number):string { return n ? `SA-${String(n).padStart(4, '0')}` : ''; }

    showAudit(item:any){ this.router.navigate([], { queryParams: { audit: item.auditid }, queryParamsHandling: 'merge' }); }
    showAll(){ this.router.navigate([], { queryParams: { audit: null }, queryParamsHandling: 'merge' }); }

    get auditLabel():string {
        const row = this.quantities.find((q:any) => q.auditno);
        return row ? this.auditNo(row.auditno) : 'this audit';
    }

    // ------------------------------------------------------------ settling with a reason
    /** the adjustment being approved, rejected or deleted, with the reason asked for */
    settle:any = null;
    settleError = '';
    readonly settleReasons = STOCK_ADJUSTMENT_REASONS;
    /** a count difference is explained with reasons that fit it: a shortage with the loss reasons, a surplus with the gain reasons */
    settleReasonsFor(item:any){ const d = directionOfQty(item?.qty); return d ? reasonsFor(d) : this.settleReasons; }

    /** a difference found by a count is approved with the reason it arose; any other adjustment already carries its reason */
    private askSettle(item:any, action:'APPROVE'|'REJECT'|'DELETE'){
        this.message = ''; this.settleError = '';
        this.settle = { item, action, reasoncode: '', note: '' };
    }

    get settleNeedsReason():boolean { return !!this.settle && this.settle.action === 'APPROVE'; }
    get settleNeedsNote():boolean {
        if(!this.settle) return false;
        return this.settle.action !== 'APPROVE' || this.settle.reasoncode === 'OTHER';
    }
    get settleReady():boolean {
        if(!this.settle) return false;
        if(this.settleNeedsReason && !this.settle.reasoncode) return false;
        return !this.settleNeedsNote || String(this.settle.note || '').trim().length >= 3;
    }

    confirmSettle(){
        const s = this.settle; if(!s || !this.settleReady) return;
        this.settleError = '';
        const done = () => { this.settle = null; this.fetchAdjustments(); };
        const fail = (err:any) => { const m = err?.error?.message; this.settleError = (Array.isArray(m) ? m.join(' ') : m) || 'Could not save.'; };
        if(s.action === 'APPROVE') this.stockService.approveAdjustment(s.item.id, { reasoncode: s.reasoncode, note: s.note }).subscribe(done, fail);
        else if(s.action === 'REJECT') this.stockService.rejectAdjustment(s.item.id, s.note).subscribe(done, fail);
        else this.stockService.deleteQtyAdjustment(s.item.id, s.note).subscribe(done, fail);
    }

    /** batches that are in a count right now */
    countingNow: number[] = [];

    loadCounting(){
        this.stockService.openCountItems(this.storeContext.selectedStoreId).subscribe((r:any) => this.countingNow = r?.itemids || [], () => this.countingNow = []);
    }

    isCounting(item:any): boolean { return this.countingNow.includes(Number(item.itemid)); }

    fetchAdjustments(){
        this.loadCounting();
        this.stockService.findAllQtyAdjustments(this.auditFilter).subscribe((data:any) => {
            this.quantities = data;
        });
    }

    edit(item:any){
        this.message = '';
        this.editForm = {
            id: item.id,
            direction: directionOfQty(item.qty) || 'REMOVE',
            qty: Math.abs(Number(item.qty) || 0),
            reasoncode: item.reasoncode || item.reason || '',
            comments: item.comments || ''
        };
        this.displayEditDialog = true;
    }

    /** the reasons for the direction being edited; a stored reason that is not one of them (a transfer, a count) is kept as it is */
    get editReasons(){ return reasonsFor(this.editForm.direction); }
    get editReasonExtra():boolean { const c = this.editForm.reasoncode; return !!c && !this.editReasons.some(r => r.value === c); }

    setEditDirection(d:'REMOVE'|'ADD'){
        this.editForm.direction = d;
        // a reason of the other direction is cleared, so it cannot contradict the change
        if(this.editForm.reasoncode && !this.editReasons.some(r => r.value === this.editForm.reasoncode) && ['DAMAGED','EXPIRED','RETURNED_TO_VENDOR','SHRINKAGE','FOUND','NOT_ENTERED','CUSTOMER_RETURN'].includes(this.editForm.reasoncode)) this.editForm.reasoncode = '';
    }

    saveEdit(){
        this.message = '';
        const n = Number(this.editForm.qty);
        if(!(n > 0) || !Number.isInteger(n)){ this.message = 'Enter how many units, as a whole number.'; return; }
        const body = { ...this.editForm, qty: this.editForm.direction === 'REMOVE' ? -n : n };
        this.stockService.updateQtyAdjustment(this.editForm.id, body).subscribe(() => {
            this.displayEditDialog = false;
            this.fetchAdjustments();
        }, (err:any) => this.message = err?.error?.message || 'Unable to update this adjustment.');
    }

    approve(item:any){
        this.message = '';
        // stock changed under a count is taken into account, but the counter should know first
        if (this.isCounting(item) && !item._warned) {
            item._warned = true;
            this.message = 'This batch is being counted right now. Approving moves the stock while the count is open: it is taken into account when the count is submitted. Press Approve again to go ahead.';
            return;
        }
        // a count difference is approved with the reason it arose; any other adjustment already has its reason
        if(item.countid){ this.askSettle(item, 'APPROVE'); return; }
        this.stockService.approveAdjustment(item.id).subscribe(() => this.fetchAdjustments(), (err:any) => this.message = err?.error?.message || 'Unable to approve this adjustment.');
    }

    /** the second count of a large difference, by someone other than the first counter */
    recount(item:any){
        this.message = '';
        this.stockService.recountAdjustment(item.id, Number(item._recount)).subscribe(() => this.fetchAdjustments(), (err:any) => this.message = err?.error?.message || 'Unable to save the recount.');
    }

    reject(item:any){
        this.askSettle(item, 'REJECT');
    }

    /** only a draft that never moved the stock can be deleted; the reason is recorded */
    canDelete(item:any):boolean { return !item.countid && (item.status === 'PENDING' || item.status === 'REJECTED'); }

    delete(item:any){
        this.askSettle(item, 'DELETE');
    }
}
