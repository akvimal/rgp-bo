import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { StoreContextService } from "src/app/@core/store-context.service";
import { InvoiceService } from "src/app/secured/purchases/invoices/invoices.service";
import { TransferService } from "../transfer.service";

@Component({
    templateUrl: './transfers.component.html'
})
export class TransfersComponent implements OnInit {

    stores: any[] = [];
    selectedStoreId: number | null = null;

    transfers: any[] = [];
    loading = false;
    message = '';

    displayDialog = false;
    batches: any[] = [];
    available: number | null = null;

    form: any = {
        fromstoreid: '',
        tostoreid: '',
        purchaseitemid: '',
        qty: 0,
        notes: ''
    };
    selectedProduct: any = null;
    /** a batch sent here from the Expiry screen ("Move"): the transfer opens with it chosen */
    private preselect: { itemid: number; productid: number; title: string; qty: number } | null = null;

    constructor(
        private service: TransferService,
        private invoiceService: InvoiceService,
        private storeContext: StoreContextService,
        private route: ActivatedRoute,
    ) {}

    ngOnInit(): void {
        const q = this.route.snapshot.queryParamMap;
        if (+(q.get('itemid') || 0) > 0 && +(q.get('productid') || 0) > 0) {
            this.preselect = { itemid: +(q.get('itemid') as string), productid: +(q.get('productid') as string), title: q.get('title') || '', qty: Math.max(0, +(q.get('qty') || 0)) };
        }
        this.storeContext.stores$.subscribe((stores: any) => {
            this.stores = stores || [];
        });
        this.storeContext.selectedStoreId$.subscribe((selected: any) => {
            this.selectedStoreId = selected;
            this.refresh();
            this.applyPreselect();
        });
    }

    refresh() {
        this.loading = true;
        const criteria: any = {};
        if (this.selectedStoreId) {
            criteria.storeid = this.selectedStoreId;
        }
        this.service.findAll(criteria).subscribe((data: any) => {
            this.transfers = data || [];
            this.loading = false;
        }, () => this.loading = false);
    }

    openDialog() {
        this.message = '';
        this.selectedProduct = null;
        this.batches = [];
        this.available = null;
        this.form = {
            fromstoreid: this.selectedStoreId || '',
            tostoreid: '',
            purchaseitemid: '',
            qty: 0,
            notes: ''
        };
        this.displayDialog = true;
    }

    /** opens the new transfer with the batch chosen on the Expiry screen, from the store selected in the header */
    private applyPreselect() {
        const p = this.preselect;
        if (!p) return;
        this.preselect = null;
        this.openDialog();
        this.selectedProduct = { id: p.productid, title: p.title };
        this.invoiceService.findItemsByProduct(p.productid).subscribe((items: any) => {
            this.batches = items || [];
            this.form.purchaseitemid = String(p.itemid);
            this.form.qty = p.qty;
            this.onBatchOrStoreChange();
        });
    }

    selectProduct(event: any) {
        this.selectedProduct = event;
        this.form.purchaseitemid = '';
        this.available = null;
        this.invoiceService.findItemsByProduct(event.id).subscribe((items: any) => {
            this.batches = items || [];
        });
    }

    onBatchOrStoreChange() {
        this.available = null;
        if (this.form.purchaseitemid && this.form.fromstoreid) {
            this.service.available(this.form.purchaseitemid, this.form.fromstoreid).subscribe((qty: any) => {
                this.available = Number(qty || 0);
            });
        }
    }

    dispatch() {
        this.message = '';
        if (!this.form.fromstoreid || !this.form.tostoreid || !this.form.purchaseitemid || !(this.form.qty > 0)) {
            this.message = 'From store, to store, a batch, and a positive quantity are required.';
            return;
        }
        if (this.form.fromstoreid === this.form.tostoreid) {
            this.message = 'Source and destination stores must be different.';
            return;
        }
        this.service.dispatch(this.form).subscribe(() => {
            this.displayDialog = false;
            this.refresh();
        }, (err: any) => this.message = err?.error?.message || 'Unable to dispatch transfer.');
    }

    receive(transfer: any) {
        this.service.receive(transfer.id).subscribe(() => this.refresh(),
            (err: any) => this.message = err?.error?.message || 'Unable to receive transfer.');
    }

    cancel(transfer: any) {
        this.service.cancel(transfer.id).subscribe(() => this.refresh(),
            (err: any) => this.message = err?.error?.message || 'Unable to cancel transfer.');
    }

    canReceive(transfer: any) {
        return transfer.status === 'IN_TRANSIT' && Number(transfer.tostoreid) === Number(this.selectedStoreId);
    }
}
