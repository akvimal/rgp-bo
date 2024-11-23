import { Component } from "@angular/core";
import { StockService } from "../stock.service";

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

    constructor(private stockService:StockService) {}

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

    delete(id:number){
        this.stockService.deleteQtyAdjustment(id).subscribe(result => {
            this.fetchAdjustments();
        })
    }
}