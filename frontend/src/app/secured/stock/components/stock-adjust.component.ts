import { Component } from "@angular/core";
import { StockService } from "../stock.service";

@Component({
    templateUrl: './stock-adjust.component.html',
    styles: [
        `
        .batch {color:blue;font-style:italic;font-size:smaller}
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        `
    ]
})
export class StockAdjustComponent {

    prices:[] = []
    quantities:[] = []

    constructor(private stockService:StockService) {}

    ngOnInit() {
        this.stockService.findAllPriceAdjustments().subscribe((data:any) => {
            this.prices = data;
        });
        this.stockService.findAllQtyAdjustments().subscribe((data:any) => {
            this.quantities = data;
        });
    }
}