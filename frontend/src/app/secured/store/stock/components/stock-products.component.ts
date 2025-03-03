import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { StockService } from "../stock.service";
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';

@Component({
    templateUrl: 'stock-products.component.html'
})
export class StockProductsComponent {

    criteria = {active:true, available:false, expired:false, starts:true}
    products:any = []
   
    // items: MenuItem[] | undefined;

    constructor(private router:Router, private activatedRoute: ActivatedRoute, private service: StockService){}

    ngOnInit(){
        this.service.findAll({criteria:this.criteria});
        this.service.getProducts().subscribe((data:any) => {
            this.products = data.map(d => {
                return {...d, highest_customers: +d['highest_customers']}
            });
        });
    }

    fetch(){
        this.service.findAll({criteria:this.criteria});
    }

    openData(id){
        this.router.navigate(['items',id],{relativeTo:this.activatedRoute});
    }
    
}