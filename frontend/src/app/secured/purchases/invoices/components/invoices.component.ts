import { Component } from "@angular/core";
import { InvoiceService } from "../invoices.service";
import { Invoice } from "../invoice.model";

@Component({
    selector: 'app2-invoices',
    templateUrl: 'invoices.component.html'
})
export class InvoicesComponent {

    invoices:any = [];
    
    constructor(private service:InvoiceService){}

    ngOnInit(){
        this.fetchInvoices()
    }

    fetchInvoices(){
      this.service.findAll().subscribe((data:any) => {
        this.invoices = data.map((i:any) => {
          return {...i, received:i.status==='RECEIVED'}
        });
      });
    }


    delete(id:any) {
      this.service.remove(id).subscribe((data:any) => { 
        if(data.status && data.status === 'ERROR'){
          console.log('ERROR:',data.message);
          
        }
        else
          this.fetchInvoices() 
      });
    }

   
}