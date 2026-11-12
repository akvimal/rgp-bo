import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { saveAs as importedSaveAs } from "file-saver";

import { AuthService } from "src/app/@core/auth/auth.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { PurchaseOrderService } from "../purchase-order.service";
import { PurchaseIntentService } from "src/app/secured/store/intent/purchase-intent.service";
import { poStatus } from "../po-status";

@Component({
    selector: 'app-purchase-order-view',
    templateUrl: 'purchase-order-view.component.html'
})
export class PurchaseOrderViewComponent {
    historyProduct:{id:number,title:string} | null = null;

    order:any;
    availrequests:any[] = [];
    displayForm:boolean = false;
    displayReject:boolean = false;
    displayEdit:boolean = false;
    rejectReason:string = '';
    error:string = '';

    /** the requests ticked in the Add items table */
    picked:{[id:number]:boolean} = {};
    pickFilter = '';
    adding = false;

    editForm:FormGroup = new FormGroup({
        expecteddate: new FormControl(''),
        comments: new FormControl('')
    });

    constructor(private route:ActivatedRoute,
        private router:Router,
        private service:PurchaseOrderService,
        private reqService:PurchaseIntentService,
        private confirm:ConfirmService,
        public authService:AuthService) {}

    ngOnInit() {
        this.route.params.pipe(map(p => p.id)).subscribe(id => {
            this.error = '';
            this.fetchOrder(+id);
            this.fetchAvailRequests();
        });
    }

    get status() { return poStatus(this.order); }

    fetchOrder(id:number){
        this.service.findById(id).subscribe(data => this.order = data);
    }

    fetchAvailRequests(){
        this.reqService.findAllByCriteria({status:'Reviewed'}).subscribe((data:any) => {
            this.availrequests = (data || []).filter((r:any) => !!r.product);        // one still waiting for a product cannot be ordered
        });
    }

    /** the order changed: show it, and let the list beside it catch up */
    private changed(order?:any){
        if(order) this.order = order; else this.fetchOrder(this.order.id);
        this.service.notifyChanged();
    }

    private failed(err:any, fallback:string){
        const m = err?.error?.message;
        this.error = Array.isArray(m) ? m.join(' ') : (m || fallback);
    }

    onAdd() {
        this.picked = {}; this.pickFilter = ''; this.adding = false;
        this.fetchAvailRequests();
        this.displayForm = true;
    }

    onProceed() {
        this.error = '';
        this.service.submit(this.order.id).subscribe({
            next: (data:any) => this.changed(data),
            error: (e) => this.failed(e, 'The order could not be submitted.')
        });
    }

    onApprove() {
        this.service.approve(this.order.id).subscribe((data:any) => this.changed(data));
    }

    onReject() {
        this.service.reject(this.order.id, this.rejectReason).subscribe((data:any) => {
            this.displayReject = false;
            this.rejectReason = '';
            this.changed(data);
        });
    }

    /** takes an item off this order (the request goes back to Reviewed) */
    delete(id:number){
        this.reqService.removeOrder(id).subscribe(() => this.changed());
    }

    /** the requests that can be added, this vendor's first, narrowed by what was typed */
    get pickable():any[] {
        const f = this.pickFilter.trim().toLowerCase();
        const vid = this.order?.vendorid;
        const own = (r:any) => (vid && r.vendorid && String(r.vendorid) === String(vid)) ? 0 : (r.vendorid ? 2 : 1);   // this vendor, then no vendor named, then another vendor
        return this.availrequests
            .filter((r:any) => !f || `${r.product?.title || ''} ${r.customername || ''}`.toLowerCase().includes(f))
            .sort((a:any, b:any) => own(a) - own(b));
    }

    get pickedIds():number[] { return this.availrequests.filter((r:any) => this.picked[r.id]).map((r:any) => r.id); }

    otherVendor(r:any):boolean { return !!(r.vendorid && this.order?.vendorid && String(r.vendorid) !== String(this.order.vendorid)); }

    get allPicked():boolean { const l = this.pickable; return l.length > 0 && l.every((r:any) => this.picked[r.id]); }

    pickAll(on:boolean){ this.pickable.forEach((r:any) => this.picked[r.id] = on); }

    onSave() {
        const ids = this.pickedIds;
        if(!ids.length) return;
        this.adding = true;
        forkJoin(ids.map(id => this.reqService.update(id, { status: 'Ordered', orderid: this.order.id }))).subscribe({
            next: () => { this.adding = false; this.displayForm = false; this.changed(); },
            error: (e) => { this.adding = false; this.displayForm = false; this.failed(e, 'The items could not all be added.'); this.changed(); }
        });
    }

    /** the quantity ordered for one item, while the order can still be changed */
    setQty(req:any, event:any){
        const qty = Math.floor(Number(event.target.value));
        if(!(qty >= 1)){
            event.target.value = req.orderedqty ?? req.qty;
            this.error = 'The quantity must be at least 1.';
            return;
        }
        if(qty === +(req.orderedqty ?? req.qty)) return;
        this.error = '';
        this.reqService.update(req.id, { orderedqty: qty }).subscribe({
            next: () => this.changed(),
            error: (e) => { event.target.value = req.orderedqty ?? req.qty; this.failed(e, 'The quantity could not be changed.'); }
        });
    }

    openEdit(){
        this.editForm.reset({
            expecteddate: this.order.expecteddate ? `${this.order.expecteddate}`.slice(0, 10) : '',
            comments: this.order.comments || ''
        });
        this.displayEdit = true;
    }

    saveEdit(){
        const v = this.editForm.value;
        this.service.update(this.order.id, { expecteddate: v.expecteddate || null, comments: (v.comments || '').trim() || null }).subscribe({
            next: () => { this.displayEdit = false; this.changed(); },
            error: (e) => { this.displayEdit = false; this.failed(e, 'The order could not be changed.'); }
        });
    }

    cancelOpen = false;
    cancelReason = '';
    cancelBusy = false;
    cancelError = '';

    /** a sent order (or one waiting for approval or turned down) can be cancelled while no invoice is linked to it */
    get canCancel(): boolean {
        return ['PENDING_APPROVAL', 'SUBMITTED', 'REJECTED'].includes(this.order?.status);
    }

    openCancel(){ this.cancelOpen = true; this.cancelReason = ''; this.cancelError = ''; }

    confirmCancel(){
        this.cancelError = '';
        if(this.cancelReason.trim().length < 3){ this.cancelError = 'Say why the order is being cancelled.'; return; }
        this.cancelBusy = true;
        this.service.cancel(this.order.id, this.cancelReason.trim()).subscribe({
            next: () => { this.cancelBusy = false; this.cancelOpen = false; this.changed(); },
            error: (e) => { this.cancelBusy = false; this.cancelError = e?.error?.message || 'The order could not be cancelled.'; }
        });
    }

    /** an unsent order that is no longer wanted */
    deleteOrder(){
        this.confirm.confirmDelete(`PO ${this.order.ponumber || this.order.id}`, () => {
            this.service.remove(this.order.id).subscribe({
                next: () => { this.service.notifyChanged(); this.router.navigate(['/secure/purchases/orders']); },
                error: (e) => this.failed(e, 'The order could not be deleted.')
            });
        }, { entity: 'purchase order' });
    }

    onDownload() {
        this.service.download(this.order.id).subscribe((data: any) => {
            const blob = new Blob([data]);
            importedSaveAs(blob, `PO-${this.order.ponumber || this.order.id}.pdf`);
          });
    }

    canEdit() {
        return this.order?.status === 'PENDING' || this.order?.status === 'REJECTED';
    }

    get canApprove() {
        return this.order?.status === 'PENDING_APPROVAL' && this.authService.isActionAuthorized('purchaseorders.approve');
    }

    get totalUnits() {
        return (this.order?.requests || []).reduce((t:number, r:any) => t + (+(r.orderedqty ?? r.qty) || 0), 0);
    }

    get totalValue() {
        return (this.order?.requests || []).reduce((t:number, r:any) => t + (+r.linevalue || 0), 0);
    }
}
