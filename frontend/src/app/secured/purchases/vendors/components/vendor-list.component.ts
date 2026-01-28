import { Component } from "@angular/core";
import { VendorsService } from "../vendors.service";

@Component({
    templateUrl: 'vendor-list.component.html'
})
export class VendorListComponent {

    vendors:any;
    showDeleteConfirm: boolean = false;
    vendorToDelete: any = null;
    deleteError: string = '';
    showDeleteError: boolean = false;

    constructor(private service:VendorsService){}

    ngOnInit(){
        this.fetchList()
    }

    confirmDelete(vendor: any) {
        this.vendorToDelete = vendor;
        this.showDeleteConfirm = true;
    }

    cancelDelete() {
        this.vendorToDelete = null;
        this.showDeleteConfirm = false;
    }

    delete(){
        if (!this.vendorToDelete) return;

        this.service.remove(this.vendorToDelete.id).subscribe({
            next: (data) => {
                this.showDeleteConfirm = false;
                this.vendorToDelete = null;
                this.fetchList();
            },
            error: (error) => {
                this.showDeleteConfirm = false;
                this.deleteError = error.error?.message || 'Cannot delete vendor. It may be referenced in invoices or purchase orders.';
                this.showDeleteError = true;
            }
        });
    }

    closeErrorDialog() {
        this.showDeleteError = false;
        this.deleteError = '';
        this.vendorToDelete = null;
    }

    fetchList(){
        this.service.findAll().subscribe(data => this.vendors = data);
    }
}