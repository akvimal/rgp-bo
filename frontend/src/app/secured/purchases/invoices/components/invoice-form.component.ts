import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { VendorsService } from "../../vendors/vendors.service";
import { Invoice } from "../invoice.model";
import { InvoiceService } from "../invoices.service";
import { PurchaseOrderService } from "../../requests/purchase-order.service";
import { StoreContextService } from "src/app/@core/store-context.service";
import { FileUploadService } from "../../../documents/file-upload.service";
import { isValidGstin } from "../../vendors/gst-util";

/**
 * The invoice header: what is printed at the top of the vendor's invoice. Lines are added on the next page. The date the
 * money is due follows the vendor's payment terms unless changed, and the printed total is kept so the lines can be checked
 * against it before the stock is received.
 */
@Component({
    templateUrl: './invoice-form.component.html'
})
export class InvoiceFormComponent implements OnInit {

    invoice:Invoice = {}
    orders:any[] = [];
    vendors:any[] = [];
    stores:any[] = [];
    errorMessage:string = '';
    saving = false;
    showMore = false;
    changingDue = false;
    duplicate:any = null;
    uploading = false;

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        vendorid: new FormControl('',Validators.required),
        storeid: new FormControl('',Validators.required),
        invoiceno: new FormControl('',[Validators.required, Validators.maxLength(40)]),
        invoicedate: new FormControl(this.today(),Validators.required),
        printedtotal: new FormControl(null),
        duedate: new FormControl(''),
        referenceno: new FormControl(''),
        notes: new FormControl(''),
        purchaseorderid: new FormControl(''),
        documentpath: new FormControl(''),
        suppliergstin: new FormControl(''),
        supplytype: new FormControl(''),
        itceligibility: new FormControl(''),
        reversecharge: new FormControl(false)
      });

    constructor(
      private route: ActivatedRoute,
      private router: Router,
      private service:InvoiceService,
      private vendorService:VendorsService,
      private poService:PurchaseOrderService,
      private files:FileUploadService,
      private storeContext:StoreContextService){}

    get id(): any { return this.route.snapshot.paramMap.get('id'); }
    /** a received invoice keeps what was received: only the due date, reference and notes change */
    get locked(): boolean { return !!this.id && !!this.invoice.status && this.invoice.status !== 'NEW'; }
    get vendor(): any { return this.vendors.find(v => +v.id === +this.form.value.vendorid) || null; }
    get terms(): number { return +(this.vendor?.paymenttermsdays || 0); }

    ngOnInit(){
      this.storeContext.stores$.subscribe((stores:any) => {
        this.stores = stores || [];
        if(!this.id && !this.form.controls['storeid'].value){
          this.form.controls['storeid'].setValue(this.storeContext.selectedStoreId || (this.stores[0] && this.stores[0].id) || '');
        }
      });

      this.vendorService.findUsable().subscribe((data:any) => {
        this.vendors = data;
        this.setDue();
      });

      const id = this.id;
      id && this.service.find(id).subscribe((data:any) => {
        this.invoice = data;
        const day = (d:any) => d ? String(d).slice(0, 10) : '';
        this.form.patchValue({
          id: data.id, vendorid: data.vendorid, storeid: data.storeid, invoiceno: data.invoiceno,
          invoicedate: day(data.invoicedate), duedate: day(data.duedate || data.invoicedate), printedtotal: data.printedtotal ?? null,
          referenceno: data.referenceno || '', notes: data.notes || '', purchaseorderid: data.purchaseorderid || '', documentpath: data.documentpath || '',
          suppliergstin: data.suppliergstin || '', supplytype: data.supplytype || '', itceligibility: data.itceligibility || '', reversecharge: !!data.reversecharge
        });
        this.showMore = !!(data.referenceno || data.notes);
        this.form.controls['vendorid'].disable();
        if(this.locked) ['storeid','invoiceno','invoicedate','printedtotal','purchaseorderid','suppliergstin','supplytype','itceligibility','reversecharge'].forEach(k => this.form.controls[k].disable());
        this.loadOrders(data.vendorid);
      });
    }

    today(){
      const dt = new Date();
      return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    /** the due date follows the invoice date and the vendor's terms until the person sets one */
    setDue(){
      if(this.id || this.changingDue || !this.form.value.invoicedate) return;
      const d = new Date(this.form.value.invoicedate + 'T00:00:00');
      d.setDate(d.getDate() + this.terms);
      this.form.controls['duedate'].setValue(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
    }

    dueText(): string {
      const due = this.form.value.duedate;
      if(!due) return '';
      return new Date(due + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        + (this.terms ? ` (${this.terms}-day terms)` : ' (no payment terms set for this vendor)');
    }

    vendorChanged(){
      this.form.controls['purchaseorderid'].setValue('');
      this.setDue();
      this.loadOrders(this.form.value.vendorid);
      this.checkDuplicate();
    }

    loadOrders(vendorid:any){
      this.orders = [];
      if(!vendorid) return;
      this.poService.findAllByCriteria({status:'SUBMITTED', approvalstatus:'Approved', vendorid}).subscribe((data:any) => this.orders = data || []);
    }

    poLabel(o:any): string {
      const when = o.createdon ? new Date(o.createdon).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
      const lines = o.linecount ? ` · ${o.linecount} line${o.linecount === 1 ? '' : 's'}` : '';
      const amount = o.estimatedtotal ? ` · about ₹${Math.round(o.estimatedtotal).toLocaleString('en-IN')}` : '';
      return `PO ${o.id} · ${when}${lines}${amount}`;
    }

    /** the same number from the same vendor is a double entry: say so while the person is still typing */
    checkDuplicate(){
      this.duplicate = null;
      const no = String(this.form.value.invoiceno || '').trim();
      const vendor = this.form.value.vendorid;
      if(!no || !vendor) return;
      this.service.search({ view: 'all', vendor, q: no, limit: 10 }).subscribe((r:any) => {
        const hit = (r?.data || []).find((i:any) => String(i.invoice_no).toUpperCase() === no.toUpperCase() && i.id !== this.invoice.id);
        this.duplicate = hit || null;
      });
    }

    upload(event:any){
      const file = event?.target?.files?.[0];
      if(!file) return;
      this.uploading = true;
      this.files.upload(file, `invoice=${this.form.value.vendorid || 'new'}-${Date.now()}`).subscribe(
        (res:any) => { this.form.controls['documentpath'].setValue(res?.path || ''); this.uploading = false; },
        () => { this.errorMessage = 'Could not attach the file. Use a PDF or photo under 10 MB.'; this.uploading = false; });
    }

    viewDocument(){
      this.files.view(this.form.value.documentpath).subscribe((b:any) => window.open(URL.createObjectURL(b), '_blank'), () => this.errorMessage = 'Could not open the attached file.');
    }

    removeDocument(){ this.form.controls['documentpath'].setValue(''); }

    /** a GSTIN typed here overrides the vendor's: it must be a real one */
    get gstinBad(): boolean {
        const g = String(this.form.getRawValue().suppliergstin || '').trim();
        return !!g && !isValidGstin(g);
    }

    /** what still has to be filled in, in the order the page asks for it */
    get missing(): string[] {
      const v = this.form.getRawValue();
      const out: string[] = [];
      if(!v.vendorid) out.push('vendor');
      if(!String(v.invoiceno || '').trim()) out.push('invoice number');
      if(!v.invoicedate) out.push('invoice date');
      if(!this.id && !(+v.printedtotal > 0)) out.push('invoice total');
      if(!v.storeid) out.push('receiving store');
      if(this.gstinBad) out.push('a valid supplier GSTIN');
      return out;
    }

    submit(){
      if(this.missing.length || this.saving) return;
      this.errorMessage = '';
      const v = this.form.getRawValue();
      const obj:any = {
        invoiceno: String(v.invoiceno).trim().toUpperCase(),
        invoicedate: v.invoicedate,
        duedate: v.duedate || v.invoicedate,
        referenceno: v.referenceno,
        notes: v.notes,
        vendorid: +v.vendorid,
        storeid: +v.storeid,
        purchaseorderid: v.purchaseorderid || null,
        printedtotal: +v.printedtotal > 0 ? +v.printedtotal : null,
        documentpath: v.documentpath || null
      };
      // GST: the server fills these in from the vendor and the business's state; only what was set here goes across
      const gstin = String(v.suppliergstin || '').trim().toUpperCase();
      if(gstin){ obj.suppliergstin = gstin; obj.placeofsupply = gstin.substring(0, 2); }
      if(v.supplytype) obj.supplytype = v.supplytype;
      if(v.itceligibility) obj.itceligibility = v.itceligibility;
      obj.reversecharge = !!v.reversecharge;
      this.saving = true;
      const id = v.id;
      this.service.save(id ? { id, ...obj } : obj).subscribe(
        (data:any) => {
          this.saving = false;
          if(data?.status === 'ERROR') this.errorMessage = data.message;
          else this.gotoEdit(id || data.id);
        },
        (err:any) => {
          this.saving = false;
          const m = err?.error?.message;
          this.errorMessage = (Array.isArray(m) ? m.join(' ') : m) || 'The invoice could not be saved.';
        });
    }

    gotoList() {
      this.router.navigate(['/secure/purchases/invoices']);
    }

    cancel() {
      this.id ? this.gotoEdit(this.id) : this.gotoList();
    }

    gotoEdit(id:any){
      this.router.navigate([`/secure/purchases/invoices/items/${id}`])
    }
}
