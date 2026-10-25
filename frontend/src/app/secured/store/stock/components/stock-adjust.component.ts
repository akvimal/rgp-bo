import { StoreContextService } from "src/app/@core/store-context.service";
import { Component } from "@angular/core";
import { StockService } from "../stock.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { STOCK_ADJUSTMENT_REASONS } from "../reason-codes";

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

    displayEditDialog = false;
    editForm:any = { id: null, qty: 0, reasoncode: '', comments: '' };
    message = '';

    constructor(private stockService:StockService, private confirm:ConfirmService, private storeContext:StoreContextService) {}

    ngOnInit() {
       this.fetchAdjustments();
    }

    /** batches that are in a count right now */
    countingNow: number[] = [];

    loadCounting(){
        this.stockService.openCountItems(this.storeContext.selectedStoreId).subscribe((r:any) => this.countingNow = r?.itemids || [], () => this.countingNow = []);
    }

    isCounting(item:any): boolean { return this.countingNow.includes(Number(item.itemid)); }

    fetchAdjustments(){
        this.loadCounting();
        this.stockService.findAllQtyAdjustments().subscribe((data:any) => {
            this.quantities = data;
        });
    }

    edit(item:any){
        this.message = '';
        this.editForm = {
            id: item.id,
            qty: item.qty,
            reasoncode: item.reasoncode || item.reason || '',
            comments: item.comments || ''
        };
        this.displayEditDialog = true;
    }

    saveEdit(){
        this.message = '';
        this.stockService.updateQtyAdjustment(this.editForm.id, this.editForm).subscribe(() => {
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
        this.stockService.approveAdjustment(item.id).subscribe(() => this.fetchAdjustments(), (err:any) => this.message = err?.error?.message || 'Unable to approve this adjustment.');
    }

    /** the second count of a large difference, by someone other than the first counter */
    recount(item:any){
        this.message = '';
        this.stockService.recountAdjustment(item.id, Number(item._recount)).subscribe(() => this.fetchAdjustments(), (err:any) => this.message = err?.error?.message || 'Unable to save the recount.');
    }

    reject(item:any){
        this.message = '';
        this.stockService.rejectAdjustment(item.id).subscribe(() => this.fetchAdjustments(), (err:any) => this.message = err?.error?.message || 'Unable to reject this adjustment.');
    }

    delete(item:any){
        const id = typeof item === 'object' ? item?.id : item;
        const label = typeof item === 'object' ? (item?.product?.title || item?.title || 'this adjustment') : 'this adjustment';
        this.confirm.confirmDelete(label, () => {
            this.stockService.deleteQtyAdjustment(id).subscribe(() => this.fetchAdjustments());
        }, { entity: 'stock adjustment', consequence: 'Available stock will be recalculated.' });
    }
}
