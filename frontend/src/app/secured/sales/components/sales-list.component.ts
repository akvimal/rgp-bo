import { Component } from "@angular/core";
import { DateUtilService } from "../../date-util.service";
import { Sale } from "../sale.model";
import { SaleService } from "../sales.service";

@Component({
    templateUrl: './sales-list.component.html'
})
export class SalesListComponent {
    
    sales:Sale[] = [];
    criteria = {date:'',seller:'',status:'',customer:''}

    openH1DrugsTab = false;
    constructor(private service:SaleService, private dateService:DateUtilService){}

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

      isActionAllowed(action:string,sale:any){
      
        let allowed = false;
        if(action === 'Print' && sale.status === 'COMPLETE'){
          allowed = true;
        }
        else if(action === 'Edit' && (sale.status === 'PENDING' || this.dateService.isSameDay(sale.createdon))){
          allowed = true;
        }
        else if(action === 'Return' 
        && (sale.status === 'COMPLETE' && !this.dateService.isSameDay(sale.createdon))
        ){ // return allowed for sale completed within specified period
          allowed = true;
        }
        else if(action === 'Cancel' && sale.status !== 'LOCKED'){ // the sale will be locked on filing GST
          allowed = true;
        }
        return allowed;
      }
}