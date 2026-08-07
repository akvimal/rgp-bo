import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RolesService } from "../../roles/roles.service";
import { BusinessesService } from "../../businesses/businesses.service";
import { UsersService } from "../users.service";

const ADMIN_ROLE_NAMES = ['Site Admin', 'Business Head'];

@Component({
    templateUrl: 'user-form.component.html'
})
export class UserFormComponent {

  roles:any = []
  allRoles:any = []
  stores:any[] = []
  businesses:any[] = []
  selectedStoreIds:number[] = []
  isSiteAdmin = false;
  isBusinessHead = false;
  currentUserBusinessName = '';

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        roleid: new FormControl('',Validators.required),
        businessid: new FormControl(''),
        fullname: new FormControl('',Validators.required),
        email: new FormControl('',Validators.required),
        password: new FormControl('',Validators.required),
        confirmpassword: new FormControl('',Validators.required),
        phone: new FormControl(''),
        location: new FormControl(''),
        storeids: new FormControl([])
      });

      constructor(private service:UsersService,
        private roleService:RolesService,
        private businessesService:BusinessesService,
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
          this.selectedStoreIds = (data.storeassignments || []).map((row:any) => Number(row.store?.id)).filter((id:any) => !!id);
          this.form.controls['storeids'].setValue(this.selectedStoreIds);
        });

        this.service.getCurrentUser().subscribe((current:any) => {
          this.isSiteAdmin = current?.rolename === 'Site Admin';
          this.isBusinessHead = current?.rolename === 'Business Head';
          this.currentUserBusinessName = current?.businessname || '';

          this.roleService.findAll().subscribe((data:any) => {
            this.allRoles = data || [];
            this.roles = this.isSiteAdmin
              ? this.allRoles.filter((r:any) => r.name === 'Business Head')
              : this.allRoles.filter((r:any) => !ADMIN_ROLE_NAMES.includes(r.name));
            if (this.isSiteAdmin) {
              const businessHeadRole = this.allRoles.find((r:any) => r.name === 'Business Head');
              businessHeadRole && this.form.controls['roleid'].setValue(businessHeadRole.id);
            }
          });

          if (this.isSiteAdmin) {
            this.businessesService.getBusinesses().subscribe((data:any) => this.businesses = data || []);
          } else if (this.isBusinessHead) {
            this.service.getStores().subscribe((data:any) => {
              this.stores = (data || []).filter((store:any) => store.business?.id === current?.businessid);
            });
          }
        });
      }

      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        const obj:any = {
          fullname: this.form.value.fullname,
          roleid: this.form.value.roleid,
          email: this.form.value.email,
          password: this.form.value.password,
          phone: this.form.value.phone,
          location: this.form.value.location,
        };

        if (this.isSiteAdmin) {
          obj.businessid = this.form.value.businessid;
        } else if (this.isBusinessHead) {
          obj.storeids = this.selectedStoreIds || [];
        }

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
        this.selectedStoreIds = [];
      }

      isStoreSelected(storeId:any) {
        return this.selectedStoreIds.includes(Number(storeId));
      }

      toggleStore(storeId:any, checked:boolean) {
        const id = Number(storeId);
        if (checked && !this.selectedStoreIds.includes(id)) {
          this.selectedStoreIds = [...this.selectedStoreIds, id];
        } else if (!checked) {
          this.selectedStoreIds = this.selectedStoreIds.filter((value:number) => value !== id);
        }
        this.form.controls['storeids'].setValue(this.selectedStoreIds);
      }

      selectAllStores() {
        this.selectedStoreIds = this.stores.map((store:any) => Number(store.id)).filter((id:number) => !!id);
        this.form.controls['storeids'].setValue(this.selectedStoreIds);
      }

      clearAllStores() {
        this.selectedStoreIds = [];
        this.form.controls['storeids'].setValue([]);
      }

      gotoList() {
        this.router.navigate(['/secure//settings/users']);
      }
}
