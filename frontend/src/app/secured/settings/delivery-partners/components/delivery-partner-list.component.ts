import { Component } from "@angular/core";
import { DeliveryPartnersService } from "../delivery-partners.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    templateUrl: 'delivery-partner-list.component.html'
})
export class DeliveryPartnerListComponent {
    partners: any;

    constructor(private service: DeliveryPartnersService, private confirm: ConfirmService) {}

    ngOnInit() {
        this.fetchList();
    }

    fetchList() {
        this.service.findAll().subscribe(data => this.partners = data);
    }

    delete(partner: any) {
        this.confirm.confirmDelete(partner?.name, () => {
            this.service.remove(partner.id).subscribe(() => this.fetchList());
        }, { entity: 'delivery partner' });
    }
}
