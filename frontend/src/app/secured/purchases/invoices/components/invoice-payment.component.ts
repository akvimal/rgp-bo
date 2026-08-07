import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { InvoiceService } from "../invoices.service";

@Component({
    selector: 'app-invoice-payment',
    templateUrl: "./invoice-payment.component.html"
})
export class InvoicePaymentComponent {

    @Input() invoiceid:any;
    @Input() vendorid:any;
    @Input() invoiceamt:any;
    @Input() balanceamount:any;
    @Input() paymentstatus:any;
    @Output() payUpdated = new EventEmitter();

    payments:any[] = [];
    communicationStatuses = ['Not Sent', 'Sent', 'Acknowledged', 'Disputed'];
    communicationChannels = ['WhatsApp', 'SMS', 'Email', 'Call', 'Other'];
    paymentModes = ['Cash', 'Transfer', 'Cheque', 'UPI', 'Card', 'Other'];

    form:FormGroup = new FormGroup({
        paydate: new FormControl('',Validators.required),
        paymode: new FormControl('',Validators.required),
        payrefno: new FormControl(''),
        payamount: new FormControl('',Validators.required),
        communicationstatus: new FormControl('Not Sent', Validators.required),
        communicationchannel: new FormControl('WhatsApp'),
        paycomments: new FormControl('')
      });

      constructor(private invService:InvoiceService){}

      ngOnInit(){
        this.form.controls['paydate'].setValue(this.getCurrentDateStr());
        this.form.controls['payamount'].setValue(this.balanceamount || this.invoiceamt || 0);
        this.fetchPayments();
      }

      ngOnChanges(){
        this.form.controls['payamount'].setValue(this.balanceamount || this.invoiceamt || 0);
      }

      getCurrentDateStr(){
        const dt = new Date();
        const mon = dt.getMonth()+1;
        const date = dt.getDate();
        return dt.getFullYear()+'-'+(mon < 10 ? '0'+mon : ''+mon)+'-'+(date < 10 ? '0'+date : date);
      }

      fetchPayments(){
        if(!this.invoiceid){
          return;
        }
        this.invService.findPayments(this.invoiceid).subscribe((data:any) => this.payments = data || []);
      }

      submit(){
        this.invService.savePayment({
            invoiceid: this.invoiceid,
            vendorid: this.vendorid,
            paydate:this.form.value.paydate,
            paymode:this.form.value.paymode,
            transref:this.form.value.payrefno,
            amount:+this.form.value.payamount,
            communicationstatus: this.form.value.communicationstatus,
            communicationchannel: this.form.value.communicationchannel,
            remarks:this.form.value.paycomments
        }).subscribe(() => {
            this.form.controls['payamount'].setValue(this.balanceamount || this.invoiceamt || 0);
            this.form.controls['payrefno'].setValue('');
            this.form.controls['paycomments'].setValue('');
            this.form.controls['communicationstatus'].setValue('Not Sent');
            this.form.controls['communicationchannel'].setValue('WhatsApp');
            this.fetchPayments();
            this.payUpdated.emit(this.invoiceid)
        });
      }
}
