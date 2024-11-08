import { Component } from "@angular/core";
import { SaleReturn } from "../salereturn.model";
import { SaleService } from "../sales.service";

@Component({
    templateUrl: './sale-returns.component.html'
})
export class SaleReturnsComponent {
    
    returns:SaleReturn[] = [];
    adjustReturnItemId = 0;
    showReturnAdjustForm = false;
   
    constructor(private service:SaleService){}

    ngOnInit(){
      this.fetchReturns({});
    }

    fetchReturns(filter:any){
        this.service.findAllReturns(filter).subscribe((data:any) => {
          this.returns = data.map((r:any) => {
            return {
              id:r['id'],
              saleid:r['sale_id'],
              billno: r['bill_no'],
              returndate: r['created_on'],
              customer: r['name'],
              product: r['title'],
              batch: r['batch'],
              expdate: r['exp_date'],
              qty: r['qty'],
              price: r['price'],
              total: r['qty'] * r['price'],
              status: r['status'],
              reason: r['reason'],
              comments: r['comments']
            }
          });
        });
    }

    showReturnAdjust(id:any){
      this.adjustReturnItemId = id;
      this.showReturnAdjustForm = true;
    }

    onAdjustSubmitSuccess(event:any){
      this.showReturnAdjustForm = false;
      this.fetchReturns({});
    }

    removeItem(id:any){
      this.service.removeReturnItem(id).subscribe(data => {
        this.fetchReturns({});
      });
    }
}