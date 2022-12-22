import { Component } from "@angular/core";
import { Sale } from "../sale.model";
import { SaleService } from "../sales.service";

@Component({
    templateUrl: './sales-list.component.html'
})
export class SalesListComponent {
    
    sales:Sale[] = [];
    criteria = {date:'',seller:'',status:'',customer:''}

    openH1DrugsTab = false;
    constructor(private service:SaleService){}

    ngOnInit(){
       this.fetchSales();
    }

    openH1Drugs(event:any){
      this.openH1DrugsTab = true;
    }
    fetchSales(){
        this.service.findAll(this.criteria).subscribe((data:any) => this.sales = data);
    }

    selectCustomer(customer:any){
        const {id} = customer;
        this.criteria.customer = id || 0;
        this.fetchSales();
      }

      clearFilter(){
        this.criteria.date = ''
        this.criteria.customer = ''
        this.criteria.status = ''
        
        this.fetchSales();
      }
}