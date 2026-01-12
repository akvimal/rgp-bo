import { Component } from "@angular/core";
import { InvoiceService } from "../invoices.service";

@Component({
    templateUrl: 'invoice-list.component.html'
})
export class InvoiceListComponent {

    invoices:any = [];
    displayError:boolean = false;
    errorMessage:string = '';

    // Quick Payment Dialog (Issue #61)
    showQuickPaymentDialog: boolean = false;
    selectedInvoice: any = null;
    quickPaymentMode: string = 'CASH';
    quickPaymentDate: string = '';
    todayDate: string = '';

    constructor(private service:InvoiceService){}

    ngOnInit(){
        this.fetchInvoices();
        // Set today's date for date picker max value
        const today = new Date();
        this.todayDate = today.toISOString().split('T')[0];
        this.quickPaymentDate = this.todayDate;
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

    /**
     * Open quick payment dialog (Issue #61)
     */
    openQuickPayment(invoice: any) {
      this.selectedInvoice = invoice;
      this.quickPaymentMode = 'CASH';
      this.quickPaymentDate = this.todayDate;
      this.showQuickPaymentDialog = true;
    }

    /**
     * Confirm and create quick payment (Issue #61)
     */
    confirmQuickPayment() {
      if (!this.selectedInvoice || !this.quickPaymentMode) {
        return;
      }

      const paymentDate = this.quickPaymentDate ? new Date(this.quickPaymentDate) : new Date();

      this.service.createQuickPayment(
        this.selectedInvoice.id,
        this.quickPaymentMode,
        paymentDate
      ).subscribe({
        next: (result: any) => {
          // Close dialog
          this.showQuickPaymentDialog = false;
          this.selectedInvoice = null;

          // Refresh invoice list to show updated payment status
          this.fetchInvoices();
        },
        error: (error: any) => {
          // Show error message
          this.displayError = true;
          this.errorMessage = error.error?.message || 'Failed to create payment. Please try again.';
          this.showQuickPaymentDialog = false;
        }
      });
    }

}