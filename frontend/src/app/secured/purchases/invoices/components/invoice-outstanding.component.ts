import { Component } from "@angular/core";
import { VendorsService } from "../../vendors/vendors.service";
import { InvoiceService } from "../invoices.service";

@Component({
    templateUrl: './invoice-outstanding.component.html'
})
export class InvoiceOutstandingComponent {
    invoices:any[] = [];
    vendors:any[] = [];
    vendorid:string = '';
    totals = {
        invoices: 0,
        outstanding: 0,
        overdue: 0,
    };

    constructor(
        private invoiceService: InvoiceService,
        private vendorService: VendorsService
    ) {}

    ngOnInit(){
        this.vendorService.findAll().subscribe((data:any) => this.vendors = data || []);
        this.fetchOutstanding();
    }

    fetchOutstanding(){
        const params:any = {};
        if(this.vendorid){
            params.vendorid = this.vendorid;
        }

        this.invoiceService.findOutstanding(params).subscribe((data:any) => {
            this.invoices = data || [];
            this.totals = this.invoices.reduce((acc:any, invoice:any) => {
                acc.invoices += 1;
                acc.outstanding += +(invoice.balance_amount || 0);
                if(invoice.is_overdue){
                    acc.overdue += +(invoice.balance_amount || 0);
                }
                return acc;
            }, { invoices: 0, outstanding: 0, overdue: 0 });
        });
    }
}
