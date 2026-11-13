import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { PurchaseIntentService } from "src/app/secured/store/intent/purchase-intent.service";
import { VendorsService } from "../../vendors/vendors.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { StoreContextService } from "src/app/@core/store-context.service";

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
    historyProduct:{id:number,title:string} | null = null;

    /** the products collected for a new request (several can be asked for together), and the store that is asking */
    lines:any[] = [];
    stores:any[] = [];
    storeid:any = '';
    /** the slip that more products are being added to (the shared fields are the slip's own) */
    addingTo:number | null = null;
    /** the list can be narrowed to one store or one slip */
    storeFilter:any = '';
    slipFilter:number | null = null;

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
        private storeContext: StoreContextService,
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
        this.vendorService.options(true).subscribe((data:any) => this.vendors = data || []);
        this.storeContext.stores$.subscribe((stores:any) => this.stores = stores || []);
    }

    get multiStore(): boolean { return this.stores.length > 1; }

    /** the requests on show: all, or one store's, or one slip's */
    get shown(): any[] {
        return this.requests.filter(r =>
            (!this.storeFilter || (this.storeFilter === 'none' ? !r.storeid : r.storeid === +this.storeFilter)) &&
            (!this.slipFilter || r.groupid === this.slipFilter));
    }

    /** how many of the requests on show belong to the same slip as this one */
    slipSize(request:any): number { return request.groupid ? this.requests.filter(r => r.groupid === request.groupid).length : 0; }

    showSlip(groupid:number | null){ this.slipFilter = groupid; }

    fetchRequests(){
        this.requestService.findAll().subscribe((data:any) => this.requests = data || []);
    }

    add(){
        this.displayForm = true;
        this.lines = [];
        this.addingTo = null;
        this.errorMessage = '';
        this.storeid = this.storeContext.effectiveStoreId() ?? (this.stores.length === 1 ? this.stores[0].id : '');
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
            neededby: this.twoDaysAhead(),
            status: 'Open',
            comments: '',
            sourceref: ''
        });
        this.typed = false;
        setTimeout(() => this.productReset = false);
    }

    /** a new request is needed in two days unless the buyer says otherwise (yyyy-mm-dd, as the date box wants) */
    private twoDaysAhead(): string {
        const d = new Date(); d.setDate(d.getDate() + 2);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /** more products for a slip that is still open: its shared fields are not asked again */
    addMore(request:any){
        this.add();
        this.addingTo = request.groupid;
        this.storeid = request.storeid || this.storeid;
    }

    edit(request:any){
        this.lines = [];
        this.addingTo = null;
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

    /** something is typed or chosen in the product box and has not been added to the list yet */
    get hasEntry(): boolean { return !!this.form.value.productid || !!(this.form.value.requestedname || '').trim(); }

    /** puts the product in the box (with the quantity) on the list and clears the box for the next one */
    addLine(): boolean {
        const typedName = (this.form.value.requestedname || '').trim();
        const qty = Number(this.form.value.qty);
        if(!this.form.value.productid && !typedName){
            this.errorMessage = 'Choose the product, or type its name if it is not in the product list.';
            return false;
        }
        if(!Number.isInteger(qty) || qty < 1){
            this.errorMessage = 'The quantity must be a whole number, at least 1.';
            return false;
        }
        this.errorMessage = '';
        const productid = this.form.value.productid ? +this.form.value.productid : null;
        const same = this.lines.find(l => productid ? l.productid === productid : (!l.productid && (l.requestedname || '').toLowerCase() === typedName.toLowerCase()));
        if(same) same.qty += qty;
        else this.lines.push({ productid, requestedname: productid ? null : typedName, title: productid ? this.selectedProduct?.title : typedName, qty });
        this.selectedProduct = null;
        this.productReset = true;
        this.typed = false;
        this.form.patchValue({ productid: '', requestedname: '', qty: 1 });
        setTimeout(() => this.productReset = false);
        return true;
    }

    removeLine(i:number){ this.lines.splice(i, 1); }

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

    /** the stock has come in and whoever asked has been told */
    markClosed(request:any){
        this.requestService.update(request.id, { status: 'Closed' }).subscribe(() => this.fetchRequests());
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
        const editing = !!this.form.value.id;
        // a new request is the list of products; what is still in the box goes on the list first
        if(!editing){
            if(this.hasEntry || this.lines.length === 0){
                if(!this.addLine()) return;
            }
        } else if(!this.form.value.productid && !(this.form.value.requestedname || '').trim()){
            this.errorMessage = 'Choose the product, or type its name if it is not in the product list.';
            return;
        }
        const typedName = (this.form.value.requestedname || '').trim();

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
        if(!id){
            const done = {
                next: () => { this.errorMessage = ''; this.displayForm = false; this.lines = []; this.fetchRequests(); },
                error: (err:any) => { this.errorMessage = err?.error?.message || 'Unable to save purchase request.'; }
            };
            const lines = this.lines.map(l => ({ productid: l.productid || undefined, requestedname: l.productid ? undefined : l.requestedname, qty: l.qty }));
            if(this.addingTo){
                this.requestService.addToSlip(this.addingTo, lines).subscribe(done);
            } else if(lines.length === 1){
                // one product is an ordinary request
                this.requestService.save({ ...payload, ...lines[0], productid: lines[0].productid ?? null, requestedname: lines[0].requestedname ?? null, qty: lines[0].qty, storeid: this.storeid ? +this.storeid : undefined }).subscribe(done);
            } else {
                const { id: _i, productid: _p, requestedname: _r, qty: _q, status: _s, ...shared } = payload;
                this.requestService.saveSlip({ ...shared, storeid: this.storeid ? +this.storeid : undefined, lines }).subscribe(done);
            }
            return;
        }
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
