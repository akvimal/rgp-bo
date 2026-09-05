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

    constructor(private stockService:StockService, private confirm:ConfirmService) {}

    ngOnInit() {
       this.fetchAdjustments();
    }

    fetchAdjustments(){
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
        this.stockService.approveAdjustment(item.id).subscribe(() => this.fetchAdjustments());
    }

    reject(item:any){
        this.stockService.rejectAdjustment(item.id).subscribe(() => this.fetchAdjustments());
    }

    delete(item:any){
        const id = typeof item === 'object' ? item?.id : item;
        const label = typeof item === 'object' ? (item?.product?.title || item?.title || 'this adjustment') : 'this adjustment';
        this.confirm.confirmDelete(label, () => {
            this.stockService.deleteQtyAdjustment(id).subscribe(() => this.fetchAdjustments());
        }, { entity: 'stock adjustment', consequence: 'Available stock will be recalculated.' });
    }
}
