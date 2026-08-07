import { Component } from "@angular/core";
import { DeliveryPartnersService } from "../delivery-partners.service";

@Component({
    templateUrl: 'delivery-partner-list.component.html'
})
export class DeliveryPartnerListComponent {
    partners: any;

    constructor(private service: DeliveryPartnersService) {}

    ngOnInit() {
        this.fetchList();
    }

    fetchList() {
        this.service.findAll().subscribe(data => this.partners = data);
    }

    delete(id: number) {
        this.service.remove(id).subscribe(() => this.fetchList());
    }
}
