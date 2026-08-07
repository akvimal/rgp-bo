import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { VendorsService } from "src/app/secured/purchases/vendors/vendors.service";
import { PurchaseOrderService } from "../purchase-order.service";

@Component({
    selector: 'app-purchase-order',
    templateUrl: './purchase-order.component.html'
})
export class PurchaseOrderComponent {

    orders: any[] = [];
    vendors: any = [];
    displayForm: boolean = false;
    searchTerm: string = '';
    statusFilter: string = 'ALL';
    approvalFilter: string = 'ALL';

    form: FormGroup = new FormGroup({
        id: new FormControl(''),
        vendorid: new FormControl('', Validators.required),
        ponumber: new FormControl(''),
        expecteddate: new FormControl(''),
        comments: new FormControl('')
    });

    constructor(private service: PurchaseOrderService,
        private vendorService: VendorsService) { }

    ngOnInit() {
        this.filter();
        this.vendorService.findAll().subscribe(data => this.vendors = data);
    }

    filter() {
        this.service.findAll().subscribe((data: any) => {
            this.orders = data;
        })
    }

    onProductSelect(event: any) {
        this.form.controls['productid'].setValue(event.product.id);
    }

    add() {
        this.displayForm = true;
        this.form.reset();
    }

    edit(id: number) {
        this.service.findById(id).subscribe((data: any) => {
            console.log(data);
            this.form.controls['id'].setValue(data.id);
            this.form.controls['vendorid'].setValue(data.vendorid);
            this.form.controls['expecteddate'].setValue(data.expecteddate);
            this.form.controls['comments'].setValue(data.comments);
            this.displayForm = true;
        })
    }

    onSave() {
        if (this.form.controls['id'].value !== null) {
            this.service.update(this.form.controls['id'].value, {
                vendorid: this.form.controls['vendorid'].value,
                expecteddate: this.form.controls['expecteddate'].value,
                comments: this.form.controls['comments'].value
            }).subscribe(data => {
                this.filter();
                this.displayForm = false;
            });
        }
        else {
            this.service.save(this.form.value).subscribe(data => {
                this.filter();
                this.displayForm = false;
            });
        }
    }

    delete(id: number) {
        this.service.remove(id).subscribe(data => this.filter());
    }

    get filteredOrders() {
        const search = `${this.searchTerm || ''}`.trim().toLowerCase();
        return (this.orders || []).filter((order: any) => {
            const matchesSearch = !search || [
                order?.vendor?.name,
                order?.ponumber,
                order?.status,
                order?.approvalstatus,
                order?.comments,
                order?.expecteddate
            ].some((value: any) => `${value || ''}`.toLowerCase().includes(search));
            const matchesStatus = this.statusFilter === 'ALL' || `${order?.status || ''}` === this.statusFilter;
            const matchesApproval = this.approvalFilter === 'ALL' || `${order?.approvalstatus || ''}` === this.approvalFilter;
            return matchesSearch && matchesStatus && matchesApproval;
        });
    }

    statusBadgeClass(order:any){
        const status = `${order?.status || ''}`.toUpperCase();
        if(status === 'SUBMITTED') return 'bg-success';
        if(status === 'PENDING_APPROVAL') return 'bg-warning text-dark';
        if(status === 'REJECTED') return 'bg-danger';
        if(status === 'PENDING') return 'bg-secondary';
        return 'bg-info';
    }

    approvalBadgeClass(order:any){
        const status = `${order?.approvalstatus || ''}`.toUpperCase();
        if(status === 'APPROVED') return 'bg-success';
        if(status === 'PENDING') return 'bg-warning text-dark';
        if(status === 'REJECTED') return 'bg-danger';
        return 'bg-light text-dark border';
    }
}
