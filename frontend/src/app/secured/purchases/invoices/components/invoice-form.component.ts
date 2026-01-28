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

    // Delete Invoice Confirmation
    showDeleteInvoiceConfirm: boolean = false;

    // Quick Add Vendor (for OCR workflow)
    showQuickAddVendor:boolean = false;
    ocrExtractedVendorName:string = '';
    ocrExtractedVendorGstin:string = '';
    vendorNotFound:boolean = false;

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
      console.log('=== SUBMIT CALLED ===');
      console.log('Form valid?', this.form.valid);
      console.log('Form value:', this.form.value);
      console.log('Form errors:', this.form.errors);

      // Check for validation errors
      if (!this.form.valid) {
        console.error('Form is invalid. Errors:');
        Object.keys(this.form.controls).forEach(key => {
          const control = this.form.controls[key];
          if (control.invalid) {
            console.error(`  - ${key}: invalid`, control.errors);
          }
        });
        this.errorMessage = 'Please fill all required fields correctly.';
        return;
      }

      const obj = {
        invoiceno: this.form.value.invoiceno.toUpperCase(),
        invoicedate: this.form.value.invoicedate,
        vendorid: this.form.value.vendorid,
        purchaseorderid: this.form.value.purchaseorderid,
        grno: this.form.value.grno,
        // Phase 3 fields
        doctype: this.form.value.doctype
      }

      console.log('Saving invoice with data:', obj);

      const id = this.form.value.id;
      if(id) {
        console.log('Updating existing invoice:', id);
        this.service.save({id, ...obj}).subscribe({
          next: (data) => {
            console.log('Invoice updated successfully:', data);
            this.gotoEdit(id);
          },
          error: (error) => {
            console.error('Error updating invoice:', error);
            this.errorMessage = error.error?.message || 'Failed to update invoice. Please try again.';
          }
        });
      } else {
        console.log('Creating new invoice');
        this.service.save(obj).subscribe({
          next: (data:any) => {
            console.log('Invoice save response:', data);
            if(data.status === 'ERROR') {
              console.error('Invoice save returned ERROR:', data.message);
              this.errorMessage = data.message;
            } else {
              console.log('Invoice created successfully with ID:', data.id);
              console.log('Navigating to items page...');
              this.gotoEdit(data.id);
            }
          },
          error: (error) => {
            console.error('Error saving invoice:', error);

            // Handle specific error types
            const errorMsg = error.error?.message || error.message || 'Failed to save invoice. Please try again.';

            if (errorMsg.toLowerCase().includes('duplicate') && errorMsg.toLowerCase().includes('invoice')) {
              this.errorMessage = `⚠️ Invoice Number "${this.form.value.invoiceno}" already exists in the system.\n\nPlease check if this invoice was already entered, or modify the invoice number to make it unique.`;
            } else {
              this.errorMessage = errorMsg;
            }

            // Scroll to top to show error message
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      }
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

    /**
     * Show delete invoice confirmation dialog
     */
    confirmDeleteInvoice() {
      this.showDeleteInvoiceConfirm = true;
    }

    /**
     * Cancel invoice deletion
     */
    cancelDeleteInvoice() {
      this.showDeleteInvoiceConfirm = false;
    }

    /**
     * Delete the invoice
     */
    deleteInvoice() {
      if (!this.invoice.id) return;

      this.service.remove(this.invoice.id).subscribe({
        next: (data: any) => {
          this.showDeleteInvoiceConfirm = false;

          if (data.status && data.status === 'ERROR') {
            this.errorMessage = `Items sold, unable to delete`;
          } else {
            // Navigate back to list after successful deletion
            this.router.navigate(['/secure/purchases/invoices']);
          }
        },
        error: (error) => {
          this.showDeleteInvoiceConfirm = false;
          this.errorMessage = error.error?.message || 'Cannot delete invoice. It may have associated items or payments.';
        }
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
      console.log('=== handleExtractedData CALLED ===');
      console.log('Full extracted data received:', extractedData);
      console.log('Has extractedData?', !!extractedData);
      console.log('Has extractedData.invoice?', !!extractedData?.invoice);
      console.log('Form controls available?', !!this.form);
      console.log('Form controls:', this.form?.controls);

      if (!extractedData || !extractedData.invoice) {
        console.error('handleExtractedData: Missing required data structure. Expected extractedData.invoice');
        console.error('Received:', JSON.stringify(extractedData, null, 2));
        alert('Error: The extracted data is missing invoice information. Please try uploading the document again.');
        return;
      }

      const invoiceData = extractedData.invoice;
      console.log('Invoice data to populate:', invoiceData);

      // Populate invoice number (document no)
      if (invoiceData.invoiceNumber) {
        this.form.controls['invoiceno'].setValue(invoiceData.invoiceNumber);
        console.log('Set invoiceno to:', invoiceData.invoiceNumber);
      } else {
        console.log('No invoiceNumber in extracted data');
      }

      // Populate invoice date (document date)
      if (invoiceData.invoiceDate) {
        this.form.controls['invoicedate'].setValue(invoiceData.invoiceDate);
        console.log('Set invoicedate to:', invoiceData.invoiceDate);
      } else {
        console.log('No invoiceDate in extracted data');
      }

      // Populate GR number if available
      if (invoiceData.grNumber) {
        this.form.controls['grno'].setValue(invoiceData.grNumber);
        console.log('Set grno to:', invoiceData.grNumber);
      } else {
        console.log('No grNumber in extracted data');
      }

      // Try to match vendor by name if provided
      let vendorMatched = false;
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
          vendorMatched = true;
          this.vendorNotFound = false;
          console.log('Vendor matched:', matchedVendor.name);
        }
      }

      // Store OCR extracted vendor info for Quick Add
      if (!vendorMatched && invoiceData.vendorName) {
        this.ocrExtractedVendorName = invoiceData.vendorName;
        this.ocrExtractedVendorGstin = invoiceData.vendorGstin || '';
        this.vendorNotFound = true;
        console.log('Vendor NOT found. Quick Add will be available:', {
          name: this.ocrExtractedVendorName,
          gstin: this.ocrExtractedVendorGstin
        });

        alert(`Invoice data extracted successfully!\n\nVendor "${invoiceData.vendorName}" was not found in your vendor list.\n\n✅ Use the "Quick Add Vendor" button below to add this vendor quickly.\n\nExtracted data:\n- Invoice No: ${invoiceData.invoiceNumber || 'N/A'}\n- Date: ${invoiceData.invoiceDate || 'N/A'}\n- Vendor: ${invoiceData.vendorName}\n- GSTIN: ${invoiceData.vendorGstin || 'Not provided'}`);
      } else if (vendorMatched) {
        alert('Invoice data has been populated from the uploaded document.\n\n✅ Vendor matched and auto-selected.\n\nPlease review all fields and click "Save Invoice" to continue.');
      } else {
        alert('Invoice data has been populated from the uploaded document. Please review and complete any missing fields.');
      }

      // Mark form as touched to show validation
      this.form.markAllAsTouched();

      // Store extracted data for later use (e.g., for populating line items after invoice is saved)
      if (extractedData.items && extractedData.items.length > 0) {
        // Store in session storage to retrieve after invoice creation
        sessionStorage.setItem('pendingInvoiceItems', JSON.stringify(extractedData.items));
      }
    }

    /**
     * Open Quick Add Vendor dialog
     */
    openQuickAddVendor() {
      console.log('Opening Quick Add Vendor dialog');
      this.showQuickAddVendor = true;
    }

    /**
     * Handle vendor created from Quick Add dialog
     */
    onVendorCreated(vendor: any) {
      console.log('Vendor created successfully:', vendor);

      // Add new vendor to the vendors list
      this.vendors.push(vendor);

      // Auto-select the newly created vendor
      this.form.controls['vendorid'].setValue(vendor.id);

      // Load purchase orders for this vendor
      this.poService.findAllByCriteria({status:'SUBMITTED', vendorid:vendor.id})
        .subscribe(data => this.orders = data);

      // Clear vendor not found state
      this.vendorNotFound = false;
      this.ocrExtractedVendorName = '';
      this.ocrExtractedVendorGstin = '';

      // Show success message
      alert(`✅ Vendor "${vendor.name}" has been created successfully!\n\nThe vendor is now selected in the invoice form.\n\nYou can now click "Save Invoice" to continue.`);
    }

    /**
     * Handle Quick Add dialog cancelled
     */
    onQuickAddCancelled() {
      console.log('Quick Add Vendor cancelled');
      // User can still manually select a vendor from dropdown
    }
}