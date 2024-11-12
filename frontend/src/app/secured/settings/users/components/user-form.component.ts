import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RolesService } from "../../roles/roles.service";
import { UsersService } from "../users.service";

@Component({
    templateUrl: 'user-form.component.html'
})
export class UserFormComponent {

  roles:any = []

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        roleid: new FormControl('',Validators.required),
        fullname: new FormControl('',Validators.required),
        email: new FormControl('',Validators.required),
        password: new FormControl('',Validators.required),
        confirmpassword: new FormControl('',Validators.required),
        phone: new FormControl(''),
        location: new FormControl('')
      });

      constructor(private service:UsersService, 
        private roleService:RolesService,
        private router:Router,
        private route:ActivatedRoute){}

      ngOnInit(){
        const id = this.route.snapshot.paramMap.get('id'); 
        id && this.service.findById(id).subscribe((data:any) => {
          this.form.controls['id'].setValue(id);
          this.form.controls['roleid'].setValue(data.roleid);
          this.form.controls['fullname'].setValue(data.fullname);
          this.form.controls['email'].setValue(data.email);
          this.form.controls['password'].setValue(data.password);
          this.form.controls['phone'].setValue(data.phone);
          this.form.controls['location'].setValue(data.location);
        });

        this.roleService.findAll().subscribe((data:any) => this.roles = data)
      }
  
      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        const obj = { 
          fullname: this.form.value.fullname, 
          roleid: this.form.value.roleid,  
          email: this.form.value.email, 
          password: this.form.value.password, 
          phone: this.form.value.phone, 
          location: this.form.value.location,  }
  
        const id = this.form.value.id;
        if(id) {
          this.service.update(id, obj).subscribe(data => this.gotoList());
        }
        else {
          this.service.save(obj).subscribe(data => this.gotoList());
        }
  
      }
  
      reset(){
        this.form.reset();
      }

      gotoList() {
        this.router.navigate(['/secure//settings/users']);
      }
}