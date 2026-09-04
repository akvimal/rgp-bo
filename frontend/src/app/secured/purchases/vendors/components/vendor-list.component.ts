import { Component } from "@angular/core";
import { VendorsService } from "../vendors.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    templateUrl: 'vendor-list.component.html'
})
export class VendorListComponent {

    vendors:any;

    constructor(private service:VendorsService, private confirm:ConfirmService){}

    ngOnInit(){
        this.fetchList()
    }

    delete(vendor:any){
        this.confirm.confirmDelete(vendor?.name, () => {
            this.service.remove(vendor.id).subscribe(() => this.fetchList());
        }, { entity: 'vendor', consequence: 'It will no longer be available for new purchase orders.' });
    }

    fetchList(){
        this.service.findAll().subscribe(data => this.vendors = data);
    }
}