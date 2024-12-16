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
        this.service.findAll({criteria:this.criteria});
        this.service.getProducts().subscribe((data:any) => {
            this.products = data.map(d => {
                // console.log(d);  
                return {...d, highest_customers: +d['highest_customers']}
            });
        })
    }

    fetch(){
        this.service.findAll({criteria:this.criteria});
    }

    openData(id){
        this.router.navigate(['items',id],{relativeTo:this.activatedRoute});
    }
    

}