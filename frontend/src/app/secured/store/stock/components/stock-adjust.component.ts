import { Component } from "@angular/core";
import { StockService } from "../stock.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    templateUrl: './stock-adjust.component.html',
    styles: [
        `
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        `
    ]
})
export class StockAdjustComponent {

    quantities:[] = [];

    constructor(private stockService:StockService, private confirm:ConfirmService) {}

    ngOnInit() {
       this.fetchAdjustments();
    }

    fetchAdjustments(){
        this.stockService.findAllQtyAdjustments().subscribe((data:any) => {
            this.quantities = data;
        });
    }

    edit(id:number){

    }

    delete(item:any){
        const id = typeof item === 'object' ? item?.id : item;
        const label = typeof item === 'object' ? (item?.product?.title || item?.title || 'this adjustment') : 'this adjustment';
        this.confirm.confirmDelete(label, () => {
            this.stockService.deleteQtyAdjustment(id).subscribe(() => this.fetchAdjustments());
        }, { entity: 'stock adjustment', consequence: 'Available stock will be recalculated.' });
    }
}