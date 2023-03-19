import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { CalculatorService } from "../../calculator.service";
import { Sale } from "../sale.model";
import { SaleService } from "../sales.service";

@Component({
    selector: 'app2-sale-view',
    templateUrl: 'sale-view.component.html',
    styleUrls: ['sale-view.component.css']
})
export class SaleViewComponent {

    sale:Sale = {}
    saving:number = 0;
    mrpTotal:number = 0;
    finalAmt:number = 0;
    itemsCount:number = 0;
    itemsTotal:number = 0;

    constructor(private route: ActivatedRoute,
      private router: Router, 
      private service:SaleService,
      private calc: CalculatorService){}

    async ngOnInit(){

      const saleId = this.route.snapshot.paramMap.get('id'); 
      
      this.service.find(saleId).subscribe((data:any) => {
        
          this.sale.items = data.items.map((i:any) => {
            this.mrpTotal += +((i.purchaseitem.mrpcost/i.purchaseitem.product.pack) * i.qty).toFixed(0);
            this.itemsTotal += +i.total;
            return {
              title: i.purchaseitem.product.title,
              props: i.purchaseitem.product.props,
              batch: i.purchaseitem.batch,
              expdate: i.purchaseitem.expdate,
              qty: i.qty,
              mrp:(i.purchaseitem.mrpcost/i.purchaseitem.product.pack).toFixed(2),
              price:i.price,
              taxpcnt:i.purchaseitem.taxpcnt,
              total: i.total
            }
          });
          
          this.sale.id = data.id;
          this.sale.billdate = data.billdate;
          if(data.customer){
            const {mobile,name,email} = data.customer;
            this.sale.customer = {mobile,name,email};
          }
          // this.roundDecimal = (data.total - Math.round(data.total)).toFixed(2); 
          this.itemsCount = this.sale.items?.length || 0;
          this.sale.total = data.total;
          this.sale.disccode = data.disccode;
          this.sale.discamount = data.discamount;
          this.finalAmt = Math.round(data.total);
          
          // this.saving = Math.round( (data.total / this.mrpTotal) * 100);
          this.saving = this.calc.getSaving(this.mrpTotal, data.total);
          console.log('saving: ',this.saving);
          
        });
    }

    cancel(){
      this.router.navigateByUrl('/secure/sales/list')
    }
}
