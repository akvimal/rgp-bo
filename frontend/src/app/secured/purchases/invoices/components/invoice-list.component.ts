import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { InvoiceService } from "../invoices.service";

@Component({
    templateUrl: 'invoice-list.component.html'
})
export class InvoiceListComponent {

    invoices:any = [];
    displayError:boolean = false;
    errorMessage:string = '';
    isOutstanding:boolean = false;
    
    constructor(private service:InvoiceService, private route:ActivatedRoute){}

    ngOnInit(){
        this.route.url.subscribe(segments => {
          this.isOutstanding = segments?.[0]?.path === 'outstanding';
          this.fetchInvoices();
        });
    }

    fetchInvoices(){
      const request = this.isOutstanding ? this.service.findOutstanding() : this.service.findAll();
      request.subscribe((data:any) => {
        this.invoices = (data || []).map((i:any) => {
          return {...i, received:i.status==='RECEIVED'}
        });
      });
    }

    delete(id:any) {
      this.service.remove(id).subscribe((data:any) => { 
        if(data.status && data.status === 'ERROR'){
          this.displayError = true;
          this.errorMessage = `Items sold, unable to delete`;
        }
        else
          this.fetchInvoices() 
      });
    }
    closeDeleteWarn(){
      this.displayError = false;
      this.errorMessage = '';
    }
   
}
