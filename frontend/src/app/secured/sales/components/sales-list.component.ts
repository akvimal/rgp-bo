import { Component } from "@angular/core";
import { DateUtilService } from "../../date-util.service";
import { Sale } from "../models/sale.model";
import { SaleService } from "../sales.service";

@Component({
    templateUrl: './sales-list.component.html'
})
export class SalesListComponent {
    
    sales:Sale[] = [];
    // criteria = {billno:'',date:'',self:true,status:'',customer:''}
    date:string = '';
    self:boolean = true;
    returnSaleId = '';

    openH1DrugsTab = false;
    showReturnForm = false;
    
    totals = {digital:0,cash:0,net:0};

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
      this.totals['digital'] = 0;
      this.totals['cash'] = 0;
      this.totals['net'] = 0;

        this.service.findAll({...filter,status:'COMPLETE'}).subscribe((data:any) => {
          data.forEach((sale:any) => {
            if(sale['customer']){
              sale['custinfo'] = `${sale['customer']['name']} (${sale['customer']['mobile']})`
            }
            //round the decimals of total
            sale['total'] = Math.round(sale['total']);
            this.totals['digital'] += sale['digiamt'];
            this.totals['cash'] += sale['cashamt'];
            this.totals['net'] += +sale['total'];
          });
          this.sales = data;
        });
    }

    showReturn(saleid:any){
      this.returnSaleId = saleid;
      this.showReturnForm = true;
    }

    showDelivery(saleid:any){

    }

    onReturnSubmitSuccess(event:any){
      this.showReturnForm = false;
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
        else if(action === 'Delivery' && sale.deliverytype === 'Delivery'){
          allowed = true;
        }
        return allowed;
      }
}