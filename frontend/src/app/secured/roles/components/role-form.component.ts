import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RolesService } from "../roles.service";

@Component({
    templateUrl: 'role-form.component.html'
})
export class RoleFormComponent{

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        name: new FormControl('',Validators.required),
        permissions: new FormControl('')
      });

      constructor(private service:RolesService, private router:Router,
        private route:ActivatedRoute){}

      ngOnInit(){
        const id = this.route.snapshot.paramMap.get('id'); 
        id && this.service.findById(id).subscribe((data:any) => {
          this.form.controls['id'].setValue(id);
          this.form.controls['name'].setValue(data.name);
          this.form.controls['permissions'].setValue(JSON.stringify(data.permissions));
        })
      }
  
      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        const obj = { 
          name: this.form.value.name, 
          permissions: JSON.parse(this.form.value.permissions) }
  
        const id = this.form.value.id;
        if(id) {
          this.service.update(id, obj).subscribe(data => {
            // console.log('data: ',data);
            // console.log('redirecting ,,');
            this.gotoList()
          });
        }
        else {
          this.service.save(obj).subscribe(data => this.gotoList());
        }
  
      }
  
      reset(){
        this.form.reset();
      }

      gotoList() {
        this.router.navigate(['/secure/roles/list'],{relativeTo:this.route})
      }
}