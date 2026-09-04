import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { PurchaseIntentService } from "src/app/secured/store/intent/purchase-intent.service";
import { VendorsService } from "../../vendors/vendors.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    selector: 'app-purchase-request',
    templateUrl: './purchase-request.component.html'
})
export class PurchaseRequestComponent {
    requests:any[] = [];
    vendors:any[] = [];
    selectedProduct:any;
    displayForm:boolean = false;
    productReset:boolean = false;
    errorMessage:string = '';

    sources = ['Customer', 'Staff', 'Doctor', 'System'];
    requestTypes = ['Ad Hoc', 'Refill', 'Stockout', 'Special Order'];
    priorities = ['Low', 'Normal', 'High', 'Urgent'];
    statuses = ['Open', 'Reviewed', 'Ordered', 'Received', 'Closed', 'Cancelled'];

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        productid: new FormControl('', Validators.required),
        vendorid: new FormControl(''),
        qty: new FormControl(1, Validators.required),
        source: new FormControl('Customer', Validators.required),
        requesttype: new FormControl('Ad Hoc', Validators.required),
        priority: new FormControl('Normal', Validators.required),
        customername: new FormControl(''),
        customerphone: new FormControl(''),
        neededby: new FormControl(''),
        status: new FormControl('Open', Validators.required),
        comments: new FormControl(''),
        notes: new FormControl(''),
        sourceref: new FormControl('')
    });

    constructor(
        private requestService: PurchaseIntentService,
        private vendorService: VendorsService,
        private confirm: ConfirmService
    ) {}

    ngOnInit(){
        this.fetchRequests();
        this.vendorService.findAll().subscribe((data:any) => this.vendors = data || []);
    }

    fetchRequests(){
        this.requestService.findAll().subscribe((data:any) => this.requests = data || []);
    }

    add(){
        this.displayForm = true;
        this.selectedProduct = null;
        this.productReset = true;
        this.form.reset({
            id: '',
            productid: '',
            vendorid: '',
            qty: 1,
            source: 'Customer',
            requesttype: 'Ad Hoc',
            priority: 'Normal',
            customername: '',
            customerphone: '',
            neededby: '',
            status: 'Open',
            comments: '',
            notes: '',
            sourceref: ''
        });
        setTimeout(() => this.productReset = false);
    }

    edit(request:any){
        this.displayForm = true;
        this.selectedProduct = request.product;
        this.form.patchValue({
            id: request.id,
            productid: request.productid,
            vendorid: request.vendorid,
            qty: request.qty,
            source: request.source,
            requesttype: request.requesttype,
            priority: request.priority,
            customername: request.customername,
            customerphone: request.customerphone,
            neededby: request.neededby,
            status: request.status,
            comments: request.comments,
            notes: request.notes,
            sourceref: request.sourceref
        });
    }

    onProductSelect(event:any){
        this.selectedProduct = event;
        this.form.controls['productid'].setValue(event?.id ?? null);
    }

    markReviewed(request:any){
        this.requestService.update(request.id, { status: 'Reviewed' }).subscribe(() => this.fetchRequests());
    }

    remove(request:any){
        this.confirm.confirmDelete(request?.product?.title, () => {
            this.requestService.remove(request.id).subscribe(() => this.fetchRequests());
        }, { entity: 'purchase request' });
    }

    onSave(){
        if(!this.form.valid){
            this.form.markAllAsTouched();
            this.errorMessage = 'Select a product and complete the required fields before saving.';
            return;
        }

        const neededby = this.form.value.neededby || null;
        const customername = (this.form.value.customername || '').trim() || null;
        const customerphone = (this.form.value.customerphone || '').trim() || null;
        const sourceref = (this.form.value.sourceref || '').trim() || null;
        const comments = (this.form.value.comments || '').trim() || null;
        const notes = (this.form.value.notes || '').trim() || null;
        const payload = {
            ...this.form.value,
            productid: this.form.value.productid ? +this.form.value.productid : null,
            vendorid: this.form.value.vendorid ? +this.form.value.vendorid : null,
            qty: this.form.value.qty ? +this.form.value.qty : 0,
            neededby,
            customername,
            customerphone,
            sourceref,
            comments,
            notes
        };
        const id = payload.id;
        if(id){
            this.requestService.update(id, payload).subscribe({
                next: () => {
                    this.errorMessage = '';
                    this.displayForm = false;
                    this.fetchRequests();
                },
                error: (err) => {
                    this.errorMessage = err?.error?.message || 'Unable to save purchase request.';
                }
            });
            return;
        }

        this.requestService.save(payload).subscribe({
            next: () => {
                this.errorMessage = '';
                this.displayForm = false;
                this.fetchRequests();
            },
            error: (err) => {
                this.errorMessage = err?.error?.message || 'Unable to save purchase request.';
            }
        });
    }
}
