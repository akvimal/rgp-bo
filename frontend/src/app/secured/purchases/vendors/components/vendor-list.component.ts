import { Component } from "@angular/core";
import { VendorsService } from "../vendors.service";

@Component({
    templateUrl: 'vendor-list.component.html'
})
export class VendorListComponent {

    vendors:any;

    constructor(private service:VendorsService){}

    ngOnInit(){ 
        this.fetchList()
    }

    delete(id:number){
        this.service.remove(id).subscribe(data => this.fetchList() )
    }

    fetchList(){
        this.service.findAll().subscribe(data => this.vendors = data);
    }
}