import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { StockService } from "../stock.service";

@Component({
    templateUrl: 'stock-expiry.component.html'
})
export class StockExpiryComponent {

    products:any = []

    constructor(private router:Router, private activatedRoute: ActivatedRoute, private service: StockService){}

    ngOnInit(){
        this.fetch();
    }

    fetch(){
        this.service.getMonthAvailableList().subscribe((data:any) => {
            this.products = data;
        });
    }

    openData(month){
        this.router.navigate(['expiry',month],{relativeTo:this.activatedRoute});
    }
    
}