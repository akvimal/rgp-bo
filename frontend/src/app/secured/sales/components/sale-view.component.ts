import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { DateUtilService } from "../../date-util.service";
import { ProductUtilService } from "../../product-util.service";
import { Sale } from "../models/sale.model";
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
      private dateUtilService: DateUtilService,
      private prodUtilService: ProductUtilService){}

    async ngOnInit(){

      const saleId = this.route.snapshot.paramMap.get('id'); 
      
      this.service.find(saleId).subscribe((data:any) => {
        
          this.sale.items = data.items.map((i:any) => {
            // console.log(i);
            // const pack = i.product.pack;
            const unitmrp = i.mrpcost;
            this.mrpTotal += +(unitmrp * i.qty);
            this.itemsTotal += +i.total;
            
            return {
              title: i.product.title,
              props: i.product.props,
              batch: i.batch,
              expdate: this.dateUtilService.getOtherDate(new Date(i.expdate), 1),
              qty: i.qty,
              mrp: unitmrp,
              price:i.price,
              taxpcnt:i.taxpcnt,
              total: i.total
            }
          });
          
          this.sale.id = data.id;
          this.sale.billno = data.billno;
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
          this.sale.digiamt = data.digiamt;
          this.sale.digimethod = data.digimethod;
          this.sale.cashamt = data.cashamt;
          
          this.finalAmt = Math.round(data.total);
          
          // this.saving = Math.round( (data.total / this.mrpTotal) * 100);
          this.saving = this.prodUtilService.getSaving(this.mrpTotal, data.total);
        });
    }

}
