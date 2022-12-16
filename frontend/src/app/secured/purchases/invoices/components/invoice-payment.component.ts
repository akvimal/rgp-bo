import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { InvoiceService } from "../invoices.service";

@Component({
    selector: 'app-invoice-payment',
    templateUrl: "./invoice-payment.component.html"
})
export class InvoicePaymentComponent {

    @Input() invoiceid:any;
    @Input() invoiceamt:any;
    @Output() payUpdated = new EventEmitter();

    form:FormGroup = new FormGroup({
        paydate: new FormControl('',Validators.required),
        paymode: new FormControl('',Validators.required),
        payrefno: new FormControl(''),
        payamount: new FormControl('',Validators.required),
        paycomments: new FormControl('')
      });

      constructor(private invService:InvoiceService){}

      ngOnInit(){
        this.form.controls['payamount'].setValue(this.invoiceamt);
      }

      submit(){
        this.invService.update([this.invoiceid],
            {
                status: 'PAID',
                paydate:this.form.value.paydate,
                paymode:this.form.value.paymode,
                payrefno:this.form.value.payrefno,
                payamount:this.form.value.payamount,
                paycomments:this.form.value.paycomments
            }).subscribe(data => {
                this.payUpdated.emit(this.invoiceid)
            })
      }
}