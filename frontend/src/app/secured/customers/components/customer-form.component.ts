import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";

@Component({
    selector: 'app-customer-form',
    templateUrl: './customer-form.component.html'
})
export class CustomerFormComponent {

  customer:Customer = {name:''}
  @Output() saved = new EventEmitter();

  custLeadTypes:any[] = [
    { value: 'Walkin', label: 'Walk in' },
    { value: 'Online', label: 'Online Search' },
    { value: 'Banner', label: 'Banner' },
    { value: 'PaperAd', label: 'Paper Ad' },
    { value: 'Referral', label: 'Referral' },
    { value: 'Campaign', label: 'Campaign' },
    { value: 'Other', label: 'Other' },
    { value: 'Unknown', label: 'Unknown' },
  ]

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        name: new FormControl('',Validators.required),
        mobile: new FormControl('',Validators.required),
        email: new FormControl(''),
        address: new FormControl(''),
        locality: new FormControl(''),
        area: new FormControl(''),
        srctype: new FormControl('',Validators.required),
        srcdesc: new FormControl('')
    });

    constructor(
      private route: ActivatedRoute,
      private service:CustomersService,
      private router:Router){}

    ngOnInit(){
      const id = this.route.snapshot.paramMap.get('id');

      id && this.service.find(id).subscribe((data:any) => {
        this.customer = data;
            this.form.controls['id'].setValue(data.id);
            this.form.controls['name'].setValue(data.name);
            this.form.controls['mobile'].setValue(data.mobile);
            this.form.controls['email'].setValue(data.email);
            this.form.controls['area'].setValue(data.area);
            this.form.controls['locality'].setValue(data.locality);
            this.form.controls['address'].setValue(data.address);
            this.form.controls['srctype'].setValue(data.srctype);
            this.form.controls['srcdesc'].setValue(data.srcdesc);
      })
    }

    onSave(){
      
        const obj = { 
          name: this.form.value.name, 
          mobile: this.form.value.mobile, 
          email: this.form.value.email, 
          address: this.form.value.address, 
          locality: this.form.value.locality,
          area: this.form.value.area,
          srctype: this.form.value.srctype,
          srcdesc: this.form.value.srcdesc
        }
  
        const id = this.form.value.id;
        
          this.service.save(id ? {id, ...obj} : obj).subscribe(data => {
            this.form.reset();
            this.saved.emit(data);
            this.router.navigate(['/secure/customers'])
          });
  
      }

    onEdit(id:any) {
        const cust:any = this.service.find(id);
        
        this.form.controls['id'].setValue(cust.id);
        this.form.controls['name'].setValue(cust.name);
        this.form.controls['mobile'].setValue(cust.mobile);
        this.form.controls['email'].setValue(cust.email);
        this.form.controls['locality'].setValue(cust.locality);
        this.form.controls['address'].setValue(cust.address);
        this.form.controls['area'].setValue(cust.area);
        this.form.controls['srctype'].setValue(cust.scrtype);
        this.form.controls['srcdesc'].setValue(cust.srcdesc);
        
      }

      reset(){
        this.form.reset();
      }

  }
