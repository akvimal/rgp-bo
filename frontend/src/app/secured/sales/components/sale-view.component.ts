import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Sale } from "../sale.model";
import { SaleService } from "../sales.service";

@Component({
    selector: 'app2-sale-view',
    templateUrl: 'sale-view.component.html'
})
export class SaleViewComponent {

    sale:Sale = {}

    constructor(private route: ActivatedRoute,
      private router: Router, 
      private service:SaleService){}

    async ngOnInit(){

      const saleId = this.route.snapshot.paramMap.get('id'); 
      
      this.service.find(saleId).subscribe((data:any) => {

          this.sale.items = data.items.map((i:any) => {
            return {
              title: i.purchaseitem.product.title,
              props: i.purchaseitem.product.props,
              batch: i.purchaseitem.batch,
              expdate: i.purchaseitem.expdate,
              qty: i.qty,
              mrp:i.purchaseitem.mrpcost,
              price:i.price,
              taxpcnt:i.purchaseitem.taxpcnt,
              total: i.total
            }
          });
          
          this.sale.id = data.id;
          this.sale.billdate = data.billdate;
          const {mobile,name,email} = data.customer;
          this.sale.customer = {mobile,name,email};
          this.sale.total = data.total;
        });
    }

    cancel(){
      this.router.navigateByUrl('/secure/sales/list')
    }
}
