import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { DeliveryPartnersService } from "../delivery-partners.service";

@Component({
    templateUrl: 'delivery-partner-form.component.html'
})
export class DeliveryPartnerFormComponent {
    form: FormGroup = new FormGroup({
        id: new FormControl(''),
        name: new FormControl('', Validators.required),
        contactname: new FormControl(''),
        contactphone: new FormControl(''),
        address: new FormControl(''),
        comments: new FormControl(''),
    });

    constructor(
        private service: DeliveryPartnersService,
        private router: Router,
        private route: ActivatedRoute
    ) {}

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        id && this.service.findById(id).subscribe((data: any) => {
            this.form.patchValue({
                id,
                name: data.name,
                contactname: data.contactname,
                contactphone: data.contactphone,
                address: data.address,
                comments: data.comments,
            });
        });
    }

    onSave() {
        const obj = {
            name: this.form.value.name,
            contactname: this.form.value.contactname,
            contactphone: this.form.value.contactphone,
            address: this.form.value.address,
            comments: this.form.value.comments,
        };

        const id = this.form.value.id;
        if (id) {
            this.service.update(id, obj).subscribe(() => this.gotoList());
        } else {
            this.service.save(obj).subscribe(() => this.gotoList());
        }
    }

    reset() {
        this.form.reset();
    }

    gotoList() {
        this.router.navigate(['/secure/settings/delivery-partners']);
    }
}
