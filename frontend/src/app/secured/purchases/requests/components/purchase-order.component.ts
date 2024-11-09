import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { VendorsService } from "src/app/secured/purchases/vendors/vendors.service";
import { PurchaseOrderService } from "../purchase-order.service";

@Component({
    selector: 'app-purchase-order',
    templateUrl: './purchase-order.component.html',
    styles: [
        `
        .batch {color:blue;font-style:italic;font-size:smaller}
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        `
    ]
})
export class PurchaseOrderComponent {

    orders: any[] = [];
    vendors: any = [];
    displayForm: boolean = false;

    form: FormGroup = new FormGroup({
        id: new FormControl(''),
        vendorid: new FormControl('', Validators.required),
        ponumber: new FormControl(''),
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

    delete(id: number) {
        this.service.remove(id).subscribe(data => this.filter());
    }
}