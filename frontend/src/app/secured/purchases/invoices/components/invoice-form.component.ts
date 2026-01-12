import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { VendorsService } from "../../vendors/vendors.service";
import { Invoice } from "../invoice.model";
import { InvoiceService } from "../invoices.service";
import { ProductsService } from "../../../products/products.service";
import { PurchaseOrderService } from "../../requests/purchase-order.service";

@Component({
    templateUrl: './invoice-form.component.html'
})
export class InvoiceFormComponent {

    invoice:Invoice = {}
    orders:any = [];
    allOrders:any = []; // All POs for Step 1 selection
    vendors:any = [];
    products:any = [];
    total:number = 0;
    currentDate = new Date();
    errorMessage:string = '';

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        vendorid: new FormControl('',Validators.required),
        invoiceno: new FormControl('',[Validators.required,Validators.pattern('^[a-zA-Z0-9-]+$')]),
        invoicedate: new FormControl(this.getCurrentDateStr(),Validators.required),
        purchaseorderid: new FormControl(''),
        grno: new FormControl(''),
        // Phase 3 fields
        doctype: new FormControl('INVOICE',Validators.required)
      });

    constructor(
      private route: ActivatedRoute,
      private router: Router, 
      private service:InvoiceService,
      private vendorService:VendorsService,
      // private prodService:ProductsService,
      private poService:PurchaseOrderService){}

    ngOnInit(){
      const id = this.route.snapshot.paramMap.get('id');

      id && this.service.find(id).subscribe((data:any) => {
        this.invoice = data;
        this.invoice.items = data.items.map( (i:any) => {return {...i,selected:false}});

        this.form.controls['id'].setValue(data.id);
        this.form.controls['vendorid'].setValue(data.vendorid);
        this.form.controls['invoiceno'].setValue(data.invoiceno);
        this.form.controls['invoicedate'].setValue(data.invoicedate);

        this.form.controls['purchaseorderid'].setValue(data.purchaseorderid);
        this.form.controls['grno'].setValue(data.grno);
        // Phase 3 fields
        this.form.controls['doctype'].setValue(data.doctype || 'INVOICE');

        this.invoice.items && this.invoice.items.push({status:'NEW'});

        if(this.invoice.items){
          this.invoice.items.forEach(item => {
            this.total += +this.calculateTotal(item.qty, item.ptrcost, item.taxpcnt);
          })
        }
        
      });

      this.vendorService.findAll().subscribe(data => this.vendors = data);

      // Load all POs with vendor details for Step 1 selection
      this.poService.findAllByCriteria({status:'SUBMITTED'}).subscribe(data => {
        this.allOrders = data;
      });
    }

    /**
     * Handle Purchase Order selection (Step 1)
     * Auto-populate vendor from selected PO
     */
    onPurchaseOrderChange(event: any) {
      const poId = event.target.value;

      if (!poId) {
        // User cleared PO selection
        this.form.controls['vendorid'].setValue('');
        return;
      }

      // Find selected PO
      const selectedPO = this.allOrders.find((po: any) => po.id == poId);

      if (selectedPO && selectedPO.vendorid) {
        // Auto-populate vendor from PO
        this.form.controls['vendorid'].setValue(selectedPO.vendorid);
      }
    }

    fetchOrders(event:any){
      this.form.controls['purchaseorderid'].setValue('')
      this.poService.findAllByCriteria({status:'SUBMITTED', vendorid:event.target.value}).subscribe(data => this.orders = data);
    }

    getCurrentDateStr(){
      const dt = new Date();
      const mon = dt.getMonth()+1;
      const date = dt.getDate();
      const str = dt.getFullYear()+'-'+(mon < 10 ? '0'+mon : ''+mon)+'-'+(date < 10 ? '0'+date : date);
      return str;
    }

    calculateTotal(qty?:number,price?:number,tax?:number){
      const total = (qty||0) * ((price||0) * (1 + ((tax||0) / 100)));
      return isNaN(total) ? 0 : Math.round(total);
    }

    saveInvoiceItem(item:any){
      const newItem = this.invoice.items?.find(i => i.prodid === null)
      !newItem && this.invoice.items?.push({status:'NEW'});
    }

    submit(){
      const obj = {
        invoiceno: this.form.value.invoiceno.toUpperCase(),
        invoicedate: this.form.value.invoicedate,
        vendorid: this.form.value.vendorid,
        purchaseorderid: this.form.value.purchaseorderid,
        grno: this.form.value.grno,
        // Phase 3 fields
        doctype: this.form.value.doctype
      }
        
      const id = this.form.value.id;
      if(id)
        this.service.save({id, ...obj}).subscribe(data => this.gotoEdit(id));
      else
        this.service.save(obj).subscribe((data:any) => {
          if(data.status === 'ERROR')
            this.errorMessage = data.message;
          else
            this.gotoEdit(data.id);
        });
    }

    verify(){
      const s = this.invoice.items?.filter((i:any) => i.selected);
      const idsSelected = s?.map(i => {return i.id});

      this.service.updateItems(idsSelected, {status:'Verified'}).subscribe(data => {
        this.service.find(this.invoice.id).subscribe(data => this.invoice = data)
      });
    }

    delete(){
      const s = this.invoice.items?.filter((i:any) => i.selected);
      const idsSelected = s?.map(i => {return i.id});

      this.service.removeItems(idsSelected).subscribe(data => {
        this.invoice.items = this.invoice.items?.filter(i => !idsSelected?.includes(i.id) )  
      });
    }

    reset(){
      this.form.reset();
    }
    
    gotoList() {
      this.router.navigate(['/secure/purchases/invoices']);
    }
    
    gotoEdit(id:any){
      this.router.navigate([`/secure/purchases/invoices/items/${id}`])
    }

    /**
     * Handle extracted data from document upload
     * Populate the form with extracted invoice data
     */
    handleExtractedData(extractedData: any) {
      console.log('Extracted data received:', extractedData);

      if (!extractedData || !extractedData.invoice) {
        return;
      }

      const invoiceData = extractedData.invoice;

      // Populate invoice number (document no)
      if (invoiceData.invoiceNumber) {
        this.form.controls['invoiceno'].setValue(invoiceData.invoiceNumber);
      }

      // Populate invoice date (document date)
      if (invoiceData.invoiceDate) {
        this.form.controls['invoicedate'].setValue(invoiceData.invoiceDate);
      }

      // Populate GR number if available
      if (invoiceData.grNumber) {
        this.form.controls['grno'].setValue(invoiceData.grNumber);
      }

      // Try to match vendor by name if provided
      if (invoiceData.vendorName && this.vendors && this.vendors.length > 0) {
        const matchedVendor = this.vendors.find((v: any) =>
          v.name.toLowerCase().includes(invoiceData.vendorName.toLowerCase()) ||
          invoiceData.vendorName.toLowerCase().includes(v.name.toLowerCase())
        );

        if (matchedVendor) {
          this.form.controls['vendorid'].setValue(matchedVendor.id);
          // Fetch orders for the matched vendor
          this.poService.findAllByCriteria({status:'SUBMITTED', vendorid:matchedVendor.id})
            .subscribe(data => this.orders = data);
        } else {
          // Show message that vendor needs to be selected manually
          alert(`Vendor "${invoiceData.vendorName}" was detected but not found in the system. Please select the vendor manually.`);
        }
      }

      // Show success message
      alert('Invoice data has been populated from the uploaded document. Please review and complete any missing fields.');

      // Mark form as touched to show validation
      this.form.markAllAsTouched();

      // Store extracted data for later use (e.g., for populating line items after invoice is saved)
      if (extractedData.items && extractedData.items.length > 0) {
        // Store in session storage to retrieve after invoice creation
        sessionStorage.setItem('pendingInvoiceItems', JSON.stringify(extractedData.items));
      }
    }
}