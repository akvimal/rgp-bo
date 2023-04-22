import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { PurchaseRequestService } from "../purchase-request.service";

@Component({
    templateUrl: './purchase-request.component.html',
    styles: [
        `
        .batch {color:blue;font-style:italic;font-size:smaller}
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        `
    ]
})
export class PurchaseRequestComponent {

    requests:[] = []
    displayForm:boolean = false;
    
    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        title: new FormControl(''),
        productid: new FormControl('',Validators.required),
        qty: new FormControl('1', Validators.required),
        comments: new FormControl('')
    });

    constructor(private service:PurchaseRequestService) {}

    ngOnInit() {
        this.filter();
    }

    filter(){
        this.service.findAll().subscribe((data:any) => {
            this.requests = data;
        });
    }

    onProductSelect(event:any){
        this.form.controls['productid'].setValue(event.product.id);
    }

    add(){
        this.displayForm = true;
        this.form.reset();
    }

    edit(id:number){
        this.service.findById(id).subscribe((data:any) => {
            this.form.controls['id'].setValue(data.id);
            this.form.controls['title'].setValue(data.product.title);
            this.form.controls['productid'].setValue(data.product.id);
            this.form.controls['qty'].setValue(data.qty);
            this.form.controls['comments'].setValue(data.comments);
            this.displayForm = true;
        })
    }

    onSave(){
        if(this.form.controls['id'].value !== null) {
            this.service.update(this.form.controls['id'].value, {
                // productid: this.form.controls['productid'].value,
                // qty: this.form.controls['qty'].value,
                comments: this.form.controls['comments'].value}).subscribe(data => {
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

    delete(id:number){
        this.service.remove(id).subscribe(data => this.filter() );
    }
}