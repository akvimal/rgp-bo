import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { InvoiceService } from "../invoices.service";

@Component({
    templateUrl: 'invoice-list.component.html'
})
export class InvoiceListComponent {

    invoices:any = [];
    totalRecords = 0;
    loading = false;
    displayError:boolean = false;
    errorMessage:string = '';
    isOutstanding:boolean = false;

    constructor(private service:InvoiceService, private route:ActivatedRoute){}

    ngOnInit(){
        this.route.url.subscribe(segments => {
          this.isOutstanding = segments?.[0]?.path === 'outstanding';
          if(this.isOutstanding){
            this.fetchOutstanding();
          }
          // the invoices tab loads lazily via the table's (onLazyLoad)
        });
    }

    private mapRow(i:any){
      return {...i, received:i.status==='RECEIVED'};
    }

    fetchOutstanding(){
      this.loading = true;
      this.service.findOutstanding().subscribe((data:any) => {
        this.invoices = (data || []).map((i:any) => this.mapRow(i));
        this.totalRecords = this.invoices.length;
        this.loading = false;
      }, () => this.loading = false);
    }

    /** p-table [lazy] page event: {first, rows} */
    loadInvoices(event:any){
      if(this.isOutstanding){
        return;
      }
      this.loading = true;
      const rows = event?.rows || 10;
      const page = Math.floor((event?.first || 0) / rows) + 1;
      this.service.findAll(page, rows).subscribe((resp:any) => {
        this.invoices = (resp?.data || []).map((i:any) => this.mapRow(i));
        this.totalRecords = resp?.total || 0;
        this.loading = false;
      }, () => this.loading = false);
    }

    delete(id:any) {
      this.service.remove(id).subscribe((data:any) => {
        if(data.status && data.status === 'ERROR'){
          this.displayError = true;
          this.errorMessage = `Items sold, unable to delete`;
        }
        else if(this.isOutstanding){
          this.fetchOutstanding();
        }
        else {
          this.loadInvoices({ first: 0, rows: 10 });
        }
      });
    }
    closeDeleteWarn(){
      this.displayError = false;
      this.errorMessage = '';
    }
   
}
