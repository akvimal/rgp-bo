import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";

@Component({
    selector: 'app2-customers',
    templateUrl: 'customers.component.html'
})
export class CustomersComponent {

    customers:Customer[] = []
    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        name: new FormControl('',Validators.required),
        mobile: new FormControl('',Validators.required),
        email: new FormControl(''),
        address: new FormControl(''),
        location: new FormControl(''),
        city: new FormControl(''),
        state: new FormControl(''),
        pincode: new FormControl(''),
        srctype: new FormControl(''),
        srcdesc: new FormControl('')
      });

    constructor(private service:CustomersService){}

    ngOnInit(){
        this.service.findAll()

        this.service.state.subscribe((data:any) => {
            this.customers = data
        })
    }

    onEdit(id:any) {
      const cust:any = this.service.find(id);
      
      this.form.controls['id'].setValue(cust.id);
      this.form.controls['name'].setValue(cust.name);
      this.form.controls['mobile'].setValue(cust.mobile);
      this.form.controls['email'].setValue(cust.email);
      this.form.controls['location'].setValue(cust.location);
      this.form.controls['address'].setValue(cust.address);
      this.form.controls['city'].setValue(cust.city);
      this.form.controls['state'].setValue(cust.state);
      this.form.controls['pincode'].setValue(cust.pincode);
      this.form.controls['srctype'].setValue(cust.scrtype);
      this.form.controls['srcdesc'].setValue(cust.srcdesc);
      
    }

    onRemove(id:any) {
      this.service.remove(id);
    }

    onSave(){
      
      const obj = { 
        name: this.form.value.name, 
        mobile: this.form.value.mobile, 
        email: this.form.value.email, 
        address: this.form.value.address, 
        location: this.form.value.location,
        city: this.form.value.city,
        state: this.form.value.state,
        pincode: this.form.value.pincode,
        srctype: this.form.value.srctype,
        srcdesc: this.form.value.srcdesc, }

      const id = this.form.value.id;
      if(id)
        this.service.save({id, ...obj});
      else
        this.service.save(obj);

      this.form.reset();
    }

    reset(){
      this.form.reset();
    }
}