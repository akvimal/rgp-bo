import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RolesService } from "../../roles/roles.service";
import { UsersService } from "../users.service";

@Component({
    templateUrl: 'user-edit-form.component.html'
})
export class UserEditFormComponent {

  roles:any = []
  userRoles:any = []  // User's assigned roles
  availableRoles:any = []  // Roles not yet assigned
  userId:any

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        roleid: new FormControl('',Validators.required),
        fullname: new FormControl('',Validators.required),
        email: new FormControl('',Validators.required),
        phone: new FormControl(''),
        location: new FormControl('')
      });

      constructor(private service:UsersService, 
        private roleService:RolesService,
        private router:Router,
        private route:ActivatedRoute){}

      ngOnInit(){
        const id = this.route.snapshot.paramMap.get('id');
        this.userId = id;

        if(id) {
          // Load user details
          this.service.findById(id).subscribe((data:any) => {
            this.form.controls['id'].setValue(id);
            this.form.controls['roleid'].setValue(data.roleid);
            this.form.controls['fullname'].setValue(data.fullname);
            this.form.controls['email'].setValue(data.email);
            this.form.controls['phone'].setValue(data.phone);
            this.form.controls['location'].setValue(data.location);
          });

          // Load user's assigned roles
          this.loadUserRoles();
        }

        // Load all available roles
        this.roleService.findAll().subscribe((data:any) => {
          this.roles = data;
          this.updateAvailableRoles();
        });
      }

      loadUserRoles() {
        this.service.getUserRoles(this.userId).subscribe((data:any) => {
          this.userRoles = data;
          this.updateAvailableRoles();
        });
      }

      updateAvailableRoles() {
        // Filter out roles already assigned to user
        const assignedRoleIds = this.userRoles.map((ur:any) => ur.role_id);
        this.availableRoles = this.roles.filter((r:any) => !assignedRoleIds.includes(r.id));
      }

      onAssignRole(roleId: number) {
        if(!roleId) return;

        this.service.assignRole(this.userId, roleId).subscribe({
          next: (data:any) => {
            console.log('Role assigned successfully');
            this.loadUserRoles();  // Reload to show new assignment
          },
          error: (error:any) => {
            console.error('Error assigning role:', error);
            alert(error.error?.message || 'Failed to assign role');
          }
        });
      }

      onRemoveRole(roleId: number) {
        if(confirm('Are you sure you want to remove this role?')) {
          this.service.removeRole(this.userId, roleId).subscribe({
            next: (data:any) => {
              console.log('Role removed successfully');
              this.loadUserRoles();  // Reload to show updated list
            },
            error: (error:any) => {
              console.error('Error removing role:', error);
              alert(error.error?.message || 'Failed to remove role');
            }
          });
        }
      }
  
      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        const obj = { 
          fullname: this.form.value.fullname, 
          roleid: this.form.value.roleid,  
          email: this.form.value.email, 
          phone: this.form.value.phone, 
          location: this.form.value.location,  }
  
        const id = this.form.value.id;
        // if(id) {
          this.service.update(id, obj).subscribe(data => {
            // console.log('data: ',data);
            // console.log('redirecting ,,');
            this.gotoList()
          });
        // }
        // else {
        //   this.service.save(obj).subscribe(data => this.gotoList());
        // }
  
      }
  
      reset(){
        this.form.reset();
      }

      gotoList() {
        this.router.navigate(['/secure/users/list'],{relativeTo:this.route})
      }
}