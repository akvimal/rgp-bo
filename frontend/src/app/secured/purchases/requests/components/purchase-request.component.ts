import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
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
        productid: new FormControl(''),
        requestedname: new FormControl(''),
        vendorid: new FormControl(''),
        qty: new FormControl(1, Validators.required),
        source: new FormControl('Staff', Validators.required),
        requesttype: new FormControl('Refill', Validators.required),
        priority: new FormControl('Normal', Validators.required),
        customername: new FormControl(''),
        customerphone: new FormControl(''),
        neededby: new FormControl(''),
        status: new FormControl('Open', Validators.required),
        comments: new FormControl(''),
        sourceref: new FormControl('')
    });

    constructor(
        private requestService: PurchaseIntentService,
        private vendorService: VendorsService,
        private confirm: ConfirmService,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    ngOnInit(){
        this.fetchRequests();
        // opened from the counter with the bill's customer: the Add form comes up already filled in
        const q = this.route.snapshot.queryParamMap;
        if (q.get('add')) {
            this.add();
            this.form.patchValue({ customername: q.get('cname') || '', customerphone: q.get('cphone') || '', source: 'Customer' });
        }
        this.vendorService.findUsable().subscribe((data:any) => this.vendors = data || []);
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
            requestedname: '',
            vendorid: '',
            qty: 1,
            source: 'Staff',
            requesttype: 'Refill',
            priority: 'Normal',
            customername: '',
            customerphone: '',
            neededby: '',
            status: 'Open',
            comments: '',
            sourceref: ''
        });
        this.typed = false;
        setTimeout(() => this.productReset = false);
    }

    edit(request:any){
        this.displayForm = true;
        this.selectedProduct = request.product;
        // one that was typed for a product not in the list opens as a typed name; the search box is cleared of whatever was looked at last
        this.typed = !request.product;
        this.productReset = true;
        setTimeout(() => this.productReset = false);
        this.form.patchValue({
            id: request.id,
            productid: request.productid,
            requestedname: request.requestedname,
            vendorid: request.vendorid,
            qty: request.qty,
            source: request.source,
            requesttype: request.requesttype,
            priority: request.priority,
            customername: request.customername,
            customerphone: request.customerphone,
            neededby: request.neededby,
            status: request.status,
            comments: request.comments || request.notes || '',
            sourceref: request.sourceref
        });
    }

    /** a request for a product that is not in the product list: its name is typed instead of looked up */
    typed = false;

    useTyped(){ this.typed = true; this.selectedProduct = null; this.form.controls['productid'].setValue(null); }
    useList(){ this.typed = false; }

    get fromCustomer(): boolean { return this.form.value.source === 'Customer'; }

    onProductSelect(event:any){
        this.selectedProduct = event;
        this.form.controls['productid'].setValue(event?.id ?? null);
    }

    /** a request that was typed for a product not in the list: it is linked to one (or one is created) before it can be ordered */
    linking:any = null;
    linkProduct:any = null;
    linkReset = false;
    linkError = '';

    openLink(request:any){
        this.linking = request;
        this.linkProduct = null;
        this.linkError = '';
        this.linkReset = true;
        setTimeout(() => this.linkReset = false);
    }

    closeLink(){ this.linking = null; }

    saveLink(){
        if(!this.linkProduct?.id){ this.linkError = 'Choose the product this request is for.'; return; }
        this.requestService.update(this.linking.id, { productid: +this.linkProduct.id }).subscribe({
            next: () => { this.linking = null; this.fetchRequests(); },
            error: (err) => { this.linkError = err?.error?.message || 'Unable to link the request.'; }
        });
    }

    /** opens the product form with the name filled in; saving there links this request to the new product */
    createProduct(request:any){
        this.linking = null;
        this.router.navigate(['/secure/products/master/new'], { queryParams: { title: request.requestedname, request: request.id } });
    }

    markReviewed(request:any){
        this.requestService.update(request.id, { status: 'Reviewed' }).subscribe(() => this.fetchRequests());
    }

    remove(request:any){
        this.confirm.confirmDelete(request?.product?.title || request?.requestedname, () => {
            this.requestService.remove(request.id).subscribe(() => this.fetchRequests());
        }, { entity: 'purchase request' });
    }

    onSave(){
        if(!this.form.valid){
            this.form.markAllAsTouched();
            this.errorMessage = 'Complete the required fields before saving.';
            return;
        }
        const typedName = (this.form.value.requestedname || '').trim();
        if(!this.form.value.productid && !typedName){
            this.errorMessage = 'Choose the product, or type its name if it is not in the product list.';
            return;
        }

        const neededby = this.form.value.neededby || null;
        // the customer's name and number are only asked for when the request is a customer's
        const customername = this.fromCustomer ? ((this.form.value.customername || '').trim() || null) : null;
        const customerphone = this.fromCustomer ? ((this.form.value.customerphone || '').trim() || null) : null;
        const sourceref = (this.form.value.sourceref || '').trim() || null;
        const comments = (this.form.value.comments || '').trim() || null;
        const payload = {
            ...this.form.value,
            productid: this.form.value.productid ? +this.form.value.productid : null,
            requestedname: this.form.value.productid ? null : typedName,
            vendorid: this.form.value.vendorid ? +this.form.value.vendorid : null,
            qty: this.form.value.qty ? +this.form.value.qty : 0,
            neededby,
            customername,
            customerphone,
            sourceref,
            comments
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
