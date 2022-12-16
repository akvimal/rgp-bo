import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { VendorsService } from "../vendors.service";

@Component({
    templateUrl: 'vendor-form.component.html'
})
export class VendorFormComponent{

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        name: new FormControl('',Validators.required),
        contactname: new FormControl(''),
        contactphone: new FormControl(''),
        gstn: new FormControl(''),
        address: new FormControl(''),
        comments: new FormControl('')
      });

      constructor(private service:VendorsService, private router:Router,
        private route:ActivatedRoute){}

      ngOnInit(){
        const id = this.route.snapshot.paramMap.get('id'); 
        id && this.service.findById(id).subscribe((data:any) => {
          this.form.controls['id'].setValue(id);
          this.form.controls['name'].setValue(data.name);
          this.form.controls['contactname'].setValue(data.contactname);
          this.form.controls['contactphone'].setValue(data.contactphone);
          this.form.controls['address'].setValue(data.address);
          this.form.controls['comments'].setValue(data.comments);
          this.form.controls['gstn'].setValue(data.gstn);
        })
      }
  
      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        const obj = { 
          name: this.form.value.name,
          contactname: this.form.value.contactname,
          contactphone: this.form.value.contactphone,
          gstn: this.form.value.gstn,
          address: this.form.value.address,
          comments: this.form.value.comments,
         }
  
        const id = this.form.value.id;
        if(id) {
          this.service.update(id, obj).subscribe(data => {
            // console.log('data: ',data);
            // console.log('redirecting ,,');
            this.gotoList()
          });
        }
        else {
          this.service.save(obj).subscribe((data:any) => {
            if(data.status === 'ERROR') {
              console.log(data);
              //TODO: display error
            }
            this.gotoList();
          });
        }
      }
  
      reset(){
        this.form.reset();
      }

      gotoList() {
        this.router.navigate(['/secure/vendors/list'],{relativeTo:this.route})
      }
}