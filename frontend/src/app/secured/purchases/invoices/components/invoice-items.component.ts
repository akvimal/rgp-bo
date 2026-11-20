import { quickPrices } from "../../../products/quick-price";
import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Invoice } from "../invoice.model";
import { InvoiceService } from "../invoices.service";
import { FileUploadService } from "../../../documents/file-upload.service";
import { stateName } from "../../vendors/gst-util";
import { VendorsService } from "../../vendors/vendors.service";

@Component({
    templateUrl: './invoice-items.component.html'
})
export class InvoiceItemsComponent {

    invoice: Invoice = {};
    items:any;
    itemid:any;
    displayEditItem:boolean = false;
    itemSelected:boolean = false;
    allVerified:boolean = false;
    feedback:string = '';
    // grn:string = '';
    grosstotal:number = 0;
    taxtotal:number = 0;
    disctotal:number = 0;
    nettotal:number = 0;
    /** returns the vendor credited on this invoice (they come off what it comes to) */
    creditTotal:number = 0;
    returnsReload:number = 0;
    outstandingBalance:number = 0;
    importFeedback:string = '';
    completeError:string = '';
    // the step after completing: marked ready for payment
    readyNote:string = '';
    readyError:string = '';
    readyBusy:boolean = false;
    priceByItem:{[itemid:number]:any} = {};
    impactByItem:{[itemid:number]:any} = {};
    impactSummary:any = null;
    // new products on a received invoice that still have no sale price, with the price the rules suggest
    newPrices:any = null;
    typedPrices:{[productid:number]:any} = {};
    pricingNew:boolean = false;
    pricedNewMessage:string = '';
    pricedNewError:string = '';
    priceTolerance:number = 0.5;
    priceApproval:number = 5;
    readonly priceReasons = [
        { value: 'PRICE_REVISED', label: 'Price revised' },
        { value: 'NEW_BATCH', label: 'New batch' },
        { value: 'SCHEME_ENDED', label: 'Scheme ended' },
        { value: 'VENDOR_ERROR', label: 'Vendor error' },
        { value: 'UNIT_CHANGED', label: 'Unit / pack changed' },
    ];

    confirmingDelete:boolean = false;
    deleteError:string = '';

    constructor(private route:ActivatedRoute, private router:Router, private invService: InvoiceService, private files: FileUploadService, private vendorsService: VendorsService){}

    // ---------------------------------------------------------------- order lines the vendor did not deliver
    undel:any = null;
    undelVendors:any[] = [];
    /** the decision on each undelivered line: { action, qty, vendorid, orderid } */
    undelPick:{[requestid:number]:any} = {};
    undelBusy:boolean = false;
    undelError:string = '';
    undelMessage:string = '';

    loadUndelivered(){
        if(!this.invoice?.id || this.invoice.status !== 'NEW' || !this.invoice.purchaseorderid){ this.undel = null; return; }
        this.invService.undelivered(this.invoice.id).subscribe((u:any) => {
            this.undel = u;
            const keep = this.undelPick;
            this.undelPick = {};
            (u.lines || []).forEach((l:any) => {
                this.undelPick[l.request_id] = keep[l.request_id] && keep[l.request_id].qty <= l.undelivered ? keep[l.request_id] : { action: 'wait', qty: l.undelivered, vendorid: l.po_vendor_id, orderid: null };
            });
            if(!this.undelVendors.length) this.vendorsService.options(true).subscribe((v:any) => this.undelVendors = v || [], () => {});
        }, () => { this.undel = null; });
    }

    /** lines with a decision other than waiting, that still lack what the decision needs (a quantity, a vendor, an order) */
    get undelProblem():string {
        for(const l of (this.undel?.lines || [])){
            const p = this.undelPick[l.request_id];
            if(!p || p.action === 'wait') continue;
            if(!(+p.qty >= 1) || +p.qty > l.undelivered) return `${l.title}: the quantity must be between 1 and ${l.undelivered}.`;
            if(p.action === 'new' && !p.vendorid) return `${l.title}: choose the vendor for the new order.`;
            if(p.action === 'existing' && !p.orderid) return `${l.title}: choose the order to add it to.`;
        }
        return '';
    }

    get undelMoving():number { return (this.undel?.lines || []).filter((l:any) => (this.undelPick[l.request_id]?.action || 'wait') !== 'wait').length; }

    saveUndelivered(){
        if(this.undelBusy || this.undelProblem) return;
        this.undelBusy = true; this.undelError = ''; this.undelMessage = '';
        const moves = (this.undel?.lines || []).map((l:any) => {
            const p = this.undelPick[l.request_id] || { action: 'wait' };
            return { requestid: l.request_id, action: p.action, qty: +p.qty, vendorid: p.action === 'new' ? +p.vendorid : undefined, orderid: p.action === 'existing' ? +p.orderid : undefined };
        });
        this.invService.decideUndelivered(this.invoice.id, moves).subscribe((r:any) => {
            this.undelBusy = false;
            const parts = (r.results || []).map((x:any) => x.action === 'new' ? `${x.lines} line${x.lines === 1 ? '' : 's'} on new order ${x.order_id}`
                : x.action === 'existing' ? `${x.lines} line${x.lines === 1 ? '' : 's'} added to order ${x.order_id}${x.sent_for_approval ? ' (sent back for approval)' : ''}`
                : `${x.lines} line${x.lines === 1 ? '' : 's'} kept as a request`);
            this.undelMessage = (parts.length ? 'Moved: ' + parts.join('; ') + '. ' : '') + (r.waiting_qty ? `${r.waiting_qty} still to come on this order.` : 'Nothing is left waiting.');
            this.loadUndelivered();
        }, (err:any) => {
            this.undelBusy = false;
            this.undelError = (Array.isArray(err?.error?.message) ? err.error.message.join(' ') : err?.error?.message) || 'Could not save the decisions.';
        });
    }

    /** the lines with their tax (the Net total below), after a cash discount printed at the foot of the invoice, against the printed total */
    get expectedTotal(): number {
        const goods = this.grosstotal - this.disctotal;
        const cd = +(this.invoice.cashdiscount || 0);
        return (cd > 0 && goods > cd ? this.nettotal * ((goods - cd) / goods) : this.nettotal) - this.creditTotal;
    }
    get printedDiff(): number | null {
        return this.invoice.printedtotal ? +(this.expectedTotal - +this.invoice.printedtotal).toFixed(2) : null;
    }
    get totalsAgree(): boolean { return this.printedDiff === null || Math.abs(this.printedDiff) <= 1; }

    get allSelected(): boolean {
        const open = (this.items || []).filter((i:any) => i.status === 'NEW');
        return open.length > 0 && open.every((i:any) => i.selected);
    }

    selectAll(event:any){
        (this.items || []).forEach((i:any) => { if(i.status === 'NEW') i.selected = event.target.checked; });
        this.itemSelected = (this.items || []).some((i:any) => i.selected);
    }

    viewChallan(){
        this.files.view(this.invoice.challanpath).subscribe((b:any) => window.open(URL.createObjectURL(b), '_blank'), () => this.deleteError = 'Could not open the attached challan.');
    }

    viewDocument(){
        this.files.view(this.invoice.documentpath).subscribe((b:any) => window.open(URL.createObjectURL(b), '_blank'), () => this.deleteError = 'Could not open the attached invoice copy.');
    }

    /** a draft (status NEW) can be thrown away with its lines; the server refuses anything else */
    deleteDraft(){
        this.invService.remove(this.invoice.id as number).subscribe(
            () => this.router.navigate(['/secure/purchases/invoices/list']),
            (err:any) => { this.deleteError = (Array.isArray(err?.error?.message) ? err.error.message.join(' ') : err?.error?.message) || 'Could not delete the invoice.'; });
    }

    ngOnInit(){
        this.fetchItems(this.route.snapshot.paramMap.get('id'));
    }

    /** a completed invoice whose amount payable is not what its lines come to (only a Business Head is told: the check is theirs) */
    totalIssue:any = null;
    fixingTotal = false;
    fixTotalError = '';

    private checkTotal(inv:any){
        this.totalIssue = null;
        if(inv?.status !== 'COMPLETE') return;
        this.invService.totalCheck(inv.id).subscribe((r:any) => { this.totalIssue = (r?.rows || [])[0] || null; }, () => { this.totalIssue = null; });
    }

    fixTotal(){
        if(!this.totalIssue || this.fixingTotal) return;
        this.fixingTotal = true; this.fixTotalError = '';
        this.invService.totalFix([this.totalIssue.id], true).subscribe((r:any) => {
            this.fixingTotal = false;
            const res = (r?.results || [])[0];
            if(res?.action === 'skipped'){ this.fixTotalError = res.reason || 'It could not be corrected.'; return; }
            this.fetchItems(this.route.snapshot.paramMap.get('id'));
        }, (err:any) => { this.fixingTotal = false; this.fixTotalError = (Array.isArray(err?.error?.message) ? err.error.message.join(' ') : err?.error?.message) || 'It could not be corrected.'; });
    }

    fetchItems(id:any){
        this.nettotal = 0;
        this.grosstotal = 0;
        this.disctotal = 0;
        this.taxtotal = 0;

        this.invService.find(id).subscribe((inv:any) => {
            this.invoice = inv;
            this.loadUndelivered();
            this.checkTotal(inv);
            // lines of a scanned copy still to check against it keep the invoice from being completed
            if(inv.status === 'NEW'){
                this.invService.scan(inv.id).subscribe((r:any) => { this.scanOpen = r?.counts?.open || 0; this.scanChecked = r?.counts?.verified || 0; }, () => {});
            } else { this.scanOpen = 0; this.scanChecked = 0; }
            this.items = inv.items.map((i:any) => {
                // a line in dispute or rejected is not part of the invoice: it is left out of the totals
                if(!this.outside(i)){
                    this.grosstotal += i.ptrvalue*i.qty;
                    this.disctotal += i.ptrvalue*i.qty*(i.discpcnt/100);
                    this.taxtotal += ((i.ptrvalue*i.qty)-(i.ptrvalue*i.qty*(i.discpcnt/100))) *(i.taxpcnt/100);
                }
                return {...i, selected:false}
            });
            this.nettotal = this.grosstotal - this.disctotal + this.taxtotal;
            this.outstandingBalance = +(inv.balanceamount || 0);
            this.loadPriceCheck();
            this.loadImpact();
            this.loadNewPrices();

            if(this.items) {
                this.itemSelected =  this.items.filter((i:any) => i.selected).length > 0;
                // every line still part of the invoice is verified (lines in dispute or rejected are not counted: disputes are settled first)
                const live = this.items.filter((i:any) => !this.outside(i));
                this.allVerified = live.length > 0 && live.every((i:any) => i.status === 'VERIFIED');
            }
        });
    }

    scanOpen = 0;
    scanChecked = 0;

    /** how many of the lines still part of the invoice are verified */
    /** how a line differs from what the purchase order led us to expect (any difference counts); empty when it agrees or there was no order */
    orderFlags(i:any): {label:string, was:any, now:any, over?:boolean}[] {
        const e = i?.poexpect;
        if(!e || this.outside(i)) return [];
        const out:{label:string, was:any, now:any, over?:boolean}[] = [];
        const differs = (a:any, b:any) => a !== null && a !== undefined && Math.abs(Number(a) - Number(b)) > 0.0049;
        if(differs(e.qty, i.qty)) out.push({ label: Number(i.qty) > Number(e.qty) ? 'More than ordered' : 'Qty', was: e.qty, now: i.qty, over: Number(i.qty) > Number(e.qty) });
        if(differs(e.rate, i.ptrvalue)) out.push({ label: 'Rate', was: e.rate, now: i.ptrvalue });
        if(differs(e.mrp, i.mrpcost)) out.push({ label: 'MRP', was: e.mrp, now: i.mrpcost });
        if(differs(e.disc, i.discpcnt)) out.push({ label: 'Disc %', was: e.disc, now: i.discpcnt });
        if(differs(e.tax, i.taxpcnt)) out.push({ label: 'GST %', was: e.tax, now: i.taxpcnt });
        return out;
    }

    /** the lines that differ from the order, and the ones received off it, for the note above the table */
    get orderDiffCount(): number { return (this.items || []).filter((i:any) => this.orderFlags(i).length).length; }
    get offOrderCount(): number { return (this.items || []).filter((i:any) => i.offpo && !this.outside(i)).length; }

    get liveCount(): number { return (this.items || []).filter((i:any) => !this.outside(i)).length; }
    get verifiedLiveCount(): number { return (this.items || []).filter((i:any) => !this.outside(i) && i.status === 'VERIFIED').length; }

    /** a line the invoice does not count: in dispute with the vendor, or rejected */
    outside(i:any):boolean { return i.status === 'DISPUTED' || i.status === 'REJECTED'; }

    get disputedCount():number { return (this.items || []).filter((i:any) => i.status === 'DISPUTED').length; }
    get rejectedCount():number { return (this.items || []).filter((i:any) => i.status === 'REJECTED').length; }

    // ------------------------------------------------------------ lines in dispute
    disputing:boolean = false;
    disputeNote:string = '';
    disputeError:string = '';

    /** the lines selected that can still be moved into dispute: new or verified (the server allows both) */
    private selectedNew():any[] { return (this.items || []).filter((i:any) => i.selected && (i.status === 'NEW' || i.status === 'VERIFIED')); }

    /** a line of a draft invoice that is still part of it: its price reason can be given and it can be disputed, verified or not (a verified line used to hide both) */
    inDraft(i:any): boolean { return !!this.invoice && this.invoice.status === 'NEW' && (i.status === 'NEW' || i.status === 'VERIFIED'); }

    openDispute(){
        this.disputing = true; this.disputeError = '';
    }

    /** the price flag's shortcut: the line is picked and the note starts with what is wrong with the rate */
    disputeFromPrice(i:any, pc:any){
        (this.items || []).forEach((x:any) => x.selected = x.id === i.id);
        this.itemSelected = true;
        this.disputeNote = pc && pc.pcnt !== null ? `Rate ${pc.pcnt > 0 ? '+' : ''}${(Math.round(pc.pcnt * 100) / 100)}% against the last purchase (was ${pc.prevrate}). Vendor to confirm.` : '';
        this.openDispute();
    }

    confirmDispute(){
        this.disputeError = '';
        const ids = this.selectedNew().map((i:any) => i.id);
        if(!ids.length){ this.disputeError = 'Select the lines first.'; return; }
        if(this.disputeNote.trim().length < 3){ this.disputeError = 'Say in a few words what to clarify with the vendor.'; return; }
        this.invService.dispute(ids, this.disputeNote).subscribe(() => {
            this.disputing = false; this.disputeNote = '';
            this.fetchItems(this.invoice.id);
        }, (err:any) => this.disputeError = this.say(err, 'Could not move the lines into dispute.'));
    }

    openReject(i:any){ i.rejecting = !i.rejecting; i.rejectNote = i.rejectNote || ''; i.resolveError = ''; }

    acceptLine(i:any){
        i.resolveError = '';
        this.invService.resolveDispute([i.id], 'ACCEPT').subscribe(() => this.fetchItems(this.invoice.id), (err:any) => i.resolveError = this.say(err, 'Could not accept the line.'));
    }

    rejectLine(i:any){
        i.resolveError = '';
        if(String(i.rejectNote || '').trim().length < 3){ i.resolveError = 'Say in a few words why it is rejected.'; return; }
        this.invService.resolveDispute([i.id], 'REJECT', i.rejectNote).subscribe(() => this.fetchItems(this.invoice.id), (err:any) => i.resolveError = this.say(err, 'Could not reject the line.'));
    }

    private say(err:any, fallback:string):string {
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    selectItem(event:any,id:any){
        this.items && this.items.forEach((i:any) => {
            if(i.id === id)
                i.selected = event.target.checked;
        });

        if(this.items) {
            this.itemSelected = this.items.filter((i:any) => i.selected).length > 0;
        }
    }

    removeItems(){
        if(this.items) {
            const ids = this.items
                .filter((i:any) => i.selected)
                .map((i:any) => i.id);

            this.invService.removeItems({invoiceid: this.invoice.id, ids}).subscribe(data => this.fetchItems(this.invoice.id));
        }
    }

    /** a verified line of a draft invoice is opened again (back to "to verify") so it can be edited, then verified again */
    reopenItem(i:any){
        this.invService.updateItems([i.id], {status: 'NEW'}).subscribe(() => this.fetchItems(this.invoice.id));
    }

    verifyItems(){
        if(this.items) {
            const ids = this.items
                .filter((i:any) => i.selected)
                .map((i:any) => i.id);

            this.invService.updateItems(ids, {status: 'VERIFIED'}).subscribe(data => this.fetchItems(this.invoice.id))
        }
    }

    updateFeedback(event:any){
        this.feedback = event.target.value;
    }

    confirmInvoice(){
        this.completeError = '';
        this.invService.confirm([this.invoice.id],{status:'COMPLETE',comments:this.feedback}).subscribe(data => {
            this.fetchItems(this.invoice.id);
        }, (err:any) => {
            this.completeError = (Array.isArray(err?.error?.message) ? err.error.message.join(' ') : err?.error?.message) || 'Could not complete the invoice.';
        });
    }

    markReady(){
        this.readyError = ''; this.readyBusy = true;
        this.invService.markReady(this.invoice.id, this.readyNote).subscribe(() => {
            this.readyBusy = false; this.readyNote = '';
            this.fetchItems(this.invoice.id);
        }, (err:any) => {
            this.readyBusy = false;
            this.readyError = (Array.isArray(err?.error?.message) ? err.error.message.join(' ') : err?.error?.message) || 'Could not mark the invoice ready for payment.';
        });
    }

    unmarkReady(){
        this.readyError = '';
        this.invService.unmarkReady(this.invoice.id).subscribe(() => this.fetchItems(this.invoice.id),
            (err:any) => this.readyError = (Array.isArray(err?.error?.message) ? err.error.message.join(' ') : err?.error?.message) || 'Could not take the mark back.');
    }

    /** the vendor's previous rate for each line, so a rise is seen (and explained) before the invoice is completed */
    loadPriceCheck(){
        this.invService.priceCheck(this.invoice.id).subscribe((r:any) => {
            this.priceByItem = {};
            (r.lines || []).forEach((l:any) => this.priceByItem[l.itemid] = l);
            this.priceTolerance = r.tolerance;
            this.priceApproval = r.approval;
        }, () => this.priceByItem = {});
    }

    /** what each line's cost and MRP mean for the product's current sale price: no price yet, above this batch's MRP, below the floor markup */
    loadImpact(){
        this.invService.priceImpact(this.invoice.id).subscribe((r:any) => {
            this.impactByItem = {};
            (r.lines || []).forEach((l:any) => this.impactByItem[l.itemid] = l);
            this.impactSummary = r;
        }, () => { this.impactByItem = {}; this.impactSummary = null; });
    }

    /** a received invoice: the products on it that have no price yet, each with a box holding the suggested price */
    loadNewPrices(){
        if(!this.invoice || this.invoice.status === 'NEW'){ this.newPrices = null; return; }
        this.invService.newPrices(this.invoice.id).subscribe((r:any) => {
            this.newPrices = r.products && r.products.length ? r : null;
            this.typedPrices = {};
            (r.products || []).forEach((p:any) => this.typedPrices[p.productid] = p.shown);
        }, () => this.newPrices = null);
    }

    /** the quick pick for one new product: the MRP and each step off it, those under the class's lowest price left out of reach */
    quickFor(p:any){
        const q = this.newPrices?.quick || { step: 5, max: 4 };
        const l = quickPrices({ mrp: +p.mrp, tax: +p.tax, lower: p.lower !== null && p.lower !== undefined ? +p.lower : null, step: +q.step, max: +q.max, basis: this.newPrices?.basis === 'incl' ? 'incl' : 'excl' });
        return l;
    }

    pickQuickPrice(p:any, shown:any){ if(shown !== '' && shown !== null) this.typedPrices[p.productid] = +shown; }

    /** `only` sets the price of that one product; without it every product in the list is priced */
    setNewPrices(only?:number){
        this.pricedNewError = ''; this.pricedNewMessage = ''; this.pricingNew = true;
        this.invService.priceNew(this.invoice.id, this.typedPrices, only ? [only] : undefined).subscribe((r:any) => {
            this.pricingNew = false;
            this.pricedNewMessage = `${r.applied} product${r.applied === 1 ? '' : 's'} priced.`;
            if(r.failed && r.failed.length) this.pricedNewError = r.failed.map((f:any) => `${f.title}: ${f.message}`).join(' ');
            this.loadNewPrices(); this.loadImpact();
        }, (err:any) => {
            this.pricingNew = false;
            this.pricedNewError = (Array.isArray(err?.error?.message) ? err.error.message.join(' ') : err?.error?.message) || 'Could not set the prices.';
        });
    }

    setPriceReason(itemid:any, reason:string){
        this.invService.updateItems([itemid], { pricereason: reason || null }).subscribe(() => this.loadPriceCheck(), () => this.loadPriceCheck());
    }

    /** one reason for every line that still needs one (a vendor price list change often explains them all) */
    setReasonForAll(reason:string){
        if(!reason) return;
        const ids = (this.items || []).filter((i:any) => this.inDraft(i) && this.priceByItem[i.id] && this.priceByItem[i.id].level !== 'NONE' && !this.priceByItem[i.id].reason).map((i:any) => i.id);
        if(!ids.length) return;
        this.invService.updateItems(ids, { pricereason: reason }).subscribe(() => this.loadPriceCheck(), () => this.loadPriceCheck());
    }

    get priceLinesNeedingReason(): number {
        return Object.values(this.priceByItem).filter((l:any) => l.level !== 'NONE' && !l.reason).length;
    }

    importOrderItems(){
        this.importFeedback = '';
        this.invService.importOrderItems(this.invoice.id).subscribe((result:any) => {
            this.importFeedback = result.message || 'PO items imported.';
            this.fetchItems(this.invoice.id);
        });
    }

    onItemAdd(event:any){
        this.fetchItems(this.invoice.id);
    }

    onPaid(event:any){
        this.fetchItems(event);
    }

    /** the product whose earlier purchases are shown in the dialog (null = closed) */
    historyProduct: { id: number; title: string } | null = null;

    openHistory(item:any){
        const id = +(item?.productid ?? item?.product?.id);
        if(id) this.historyProduct = { id, title: item?.product?.title || 'Product' };
    }

    showItemEdit(itemid:any){
        this.itemid = itemid;
        this.displayEditItem = true;
    }

    closeEditItem(){
        this.fetchItems(this.invoice.id);
        this.displayEditItem = false;
    }

    get gstCheckOk(){
        const total = +(this.invoice.total || 0);
        const summed = +((this.invoice as any).taxablevalue || 0)
            + +((this.invoice as any).cgstamount || 0)
            + +((this.invoice as any).sgstamount || 0)
            + +((this.invoice as any).igstamount || 0)
            + +((this.invoice as any).roundoff || 0);
        return Math.abs(total - summed) < 0.5;
    }

    get itcLabel(): string {
        const v = (this.invoice as any).itceligibility;
        return v === 'CAPITAL_GOODS' ? 'Capital goods' : v === 'INELIGIBLE' ? 'Ineligible' : 'Inputs';
    }

    get placeText(): string {
        const code = (this.invoice as any).placeofsupply;
        return code ? `${code}${stateName(code) ? ' ' + stateName(code) : ''}` : '-';
    }
}
