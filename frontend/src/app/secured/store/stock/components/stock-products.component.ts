import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Stock2Service } from "../stock2.service";

@Component({
    templateUrl: 'stock-products.component.html'
})
export class StockProductsComponent {

    criteria = {active:true, available:false, expired:false, starts:true}
    products:any = []
   
    constructor(private router:Router, private activatedRoute: ActivatedRoute, private service: Stock2Service){}

    ngOnInit(){
        this.fetch();
    }

    fetch(){
        this.service.findAll({criteria:this.criteria}).subscribe(data => this.products = data);
    }

    openData(id){
        // console.log(event.target.checked);
        this.router.navigate(['items',id],{relativeTo:this.activatedRoute})
        // console.log(id);
        
    }
    

}