import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { VendorsService } from "src/app/secured/purchases/vendors/vendors.service";
import { PurchaseOrderService } from "../purchase-order.service";

@Component({
    selector: 'app-purchase-order',
    templateUrl: './purchase-order.component.html',
    styles: [
        `
        .batch {color:blue;font-style:italic;font-size:smaller}
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        .status-badge {
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
        }
        .search-box {
            max-width: 400px;
        }
        .confirmation-content {
            text-align: center;
            padding: 1rem;
        }
        .confirmation-content p {
            margin-bottom: 0.5rem;
        }
        `
    ]
})
export class PurchaseOrderComponent {

    orders: any[] = [];
    filteredOrders: any[] = [];
    vendors: any = [];
    displayForm: boolean = false;
    displayDeleteConfirm: boolean = false;
    orderToDelete: any = null;
    searchTerm: string = '';
    statusFilter: string = '';
    loading: boolean = false;

    form: FormGroup = new FormGroup({
        id: new FormControl(''),
        vendorid: new FormControl('', Validators.required),
        ponumber: new FormControl(''),
        comments: new FormControl('')
    });

    constructor(
        private service: PurchaseOrderService,
        private vendorService: VendorsService,
        private router: Router
    ) { }

    ngOnInit() {
        this.filter();
        this.vendorService.findAll().subscribe(data => this.vendors = data);
    }

    filter() {
        this.loading = true;
        this.service.findAll().subscribe((data: any) => {
            this.orders = data;
            this.applyFilters();
            this.loading = false;
        })
    }

    applyFilters() {
        this.filteredOrders = this.orders.filter(order => {
            const matchesSearch = !this.searchTerm ||
                order.vendor?.name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                order.ponumber?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                order.id?.toString().includes(this.searchTerm);

            const matchesStatus = !this.statusFilter || order.status === this.statusFilter;

            return matchesSearch && matchesStatus;
        });
    }

    onSearchChange() {
        this.applyFilters();
    }

    onStatusFilterChange() {
        this.applyFilters();
    }

    clearFilters() {
        this.searchTerm = '';
        this.statusFilter = '';
        this.applyFilters();
    }

    getStatusClass(status: string): string {
        const statusMap: any = {
            'NEW': 'bg-primary',
            'PENDING': 'bg-warning',
            'APPROVED': 'bg-info',
            'RECEIVED': 'bg-success',
            'CANCELLED': 'bg-danger'
        };
        return statusMap[status] || 'bg-secondary';
    }

    viewOrder(id: number) {
        this.router.navigate(['/secure/purchases/orders', id]);
    }

    confirmDelete(order: any) {
        this.orderToDelete = order;
        this.displayDeleteConfirm = true;
    }

    deleteOrder() {
        if (this.orderToDelete) {
            this.service.remove(this.orderToDelete.id).subscribe({
                next: () => {
                    this.displayDeleteConfirm = false;
                    this.orderToDelete = null;
                    this.filter(); // Refresh the list
                },
                error: (err) => {
                    console.error('Error deleting order:', err);
                    this.displayDeleteConfirm = false;
                    this.orderToDelete = null;
                }
            });
        }
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
            // this.form.controls['title'].setValue(data.product.title);
            // this.form.controls['productid'].setValue(data.product.id);
            // this.form.controls['qty'].setValue(data.qty);
            this.form.controls['comments'].setValue(data.comments);
            this.displayForm = true;
        })
    }

    onSave() {
        if (this.form.controls['id'].value !== null) {
            this.service.update(this.form.controls['id'].value, {
                // productid: this.form.controls['productid'].value,
                // qty: this.form.controls['qty'].value,
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

}