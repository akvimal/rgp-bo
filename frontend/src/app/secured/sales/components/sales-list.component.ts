import { Component } from "@angular/core";
import { DateUtilService } from "../../date-util.service";
import { Sale } from "../sale.model";
import { SaleService } from "../sales.service";

@Component({
    templateUrl: './sales-list.component.html'
})
export class SalesListComponent {
    
    sales:Sale[] = [];
    // criteria = {billno:'',date:'',self:true,status:'',customer:''}
    date:string = '';
    self:boolean = true;

    openH1DrugsTab = false;

    constructor(private service:SaleService, private dateService:DateUtilService){}

    ngOnInit(){
      this.date = this.dateService.getFormatDate(new Date());
      this.fetchSales({date:this.date,
        self:this.self});
    }

    openH1Drugs(event:any){
      this.openH1DrugsTab = true;
    }

    fetchSales(filter:any){
        this.service.findAll(filter).subscribe((data:any) => {
          
          data.forEach((sale:any) => {
            //round the decimals of total
            sale['total'] = Math.round(sale['total'])
          });
          this.sales = data;
        });
    }

    filterDateSales(input:any, event:any){
      if(event === 'date')
      this.fetchSales({date:input.target.value,self:this.self});
      else if(event === 'self')
      this.fetchSales({date:this.date,self:input.target.checked});
    }

    filterBillSales(input:any){
      this.fetchSales({billno:input.target.value});
    }

    filterCustomerSales(customer:any){
        const {id} = customer;
        // this.criteria.customer = id || 0;
        this.fetchSales({customer:id});
      }

      // clearFilter(){
      //   this.criteria.billno = ''
      //   this.criteria.date = ''
      //   this.criteria.customer = ''
      //   this.criteria.status = ''
      //   this.criteria.self = true
      // }

      isActionAllowed(action:string,sale:any){
      
        let allowed = false;
        if(action === 'Print' && sale.status === 'COMPLETE'){
          allowed = true;
        }
        else if(action === 'Edit' && (sale.status === 'PENDING' || this.dateService.isSameDay(sale.billdate))){
          allowed = true;
        }
        else if(action === 'Return' 
        && (sale.status === 'COMPLETE' && !this.dateService.isSameDay(sale.billdate))
        ){ // return allowed for sale completed within specified period
          allowed = true;
        }
        else if(action === 'Cancel' && sale.status !== 'LOCKED'){ // the sale will be locked on filing GST
          allowed = true;
        }
        return allowed;
      }
}