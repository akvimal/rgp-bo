import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RolesService } from "../../roles/roles.service";
import { BusinessesService } from "../../businesses/businesses.service";
import { UsersService } from "../users.service";
import { AuthService } from "src/app/@core/auth/auth.service";
import { blankStaffDetails, staffDetailsBody, staffDetailsModel } from "./staff-details-fields.component";

const ADMIN_ROLE_NAMES = ['Site Admin', 'Business Head', 'Owner-operator'];

@Component({
    templateUrl: 'user-edit-form.component.html'
})
export class UserEditFormComponent {

  roles:any = []
  allRoles:any = []
  stores:any[] = []
  businesses:any[] = []
  selectedStoreIds:number[] = []
  isSiteAdmin = false;
  isBusinessHead = false;
  /** a manager (the Store Head): adds and edits the staff of their own stores, with the rights the owner gave the role */
  isManager = false;
  currentUserBusinessName = '';
  details:any = blankStaffDetails();
  detailsError = '';

  /** the registration is for someone who works at a pharmacy store: one of the stores ticked (or, with none ticked, any store of the business) is a pharmacy */
  get pharmacistApplies():boolean {
    const chosen = (this.stores || []).filter((s:any) => (this.selectedStoreIds || []).includes(Number(s.id)));
    const pool = chosen.length ? chosen : (this.stores || []);
    if (!this.auth.packOn('pharmacy')) return false;      // the registration is a pharmacy's: another kind of business has no pharmacist
    return !pool.length || pool.some((s:any) => s.storetype !== 'other');
  }

  get showDetails():boolean {
    const role = (this.roles || []).find((r:any) => String(r.id) === String(this.form.value.roleid)) || (this.allRoles || []).find((r:any) => String(r.id) === String(this.form.value.roleid));
    return this.isBusinessHead && !this.auth.moduleOn('hr') && !!role && role.name !== 'Counter' && role.name !== 'Business Head';
  }

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        roleid: new FormControl('',Validators.required),
        businessid: new FormControl(''),
        fullname: new FormControl('',Validators.required),
        email: new FormControl('',Validators.required),
        phone: new FormControl(''),
        location: new FormControl(''),
        storeids: new FormControl([])
      });

      constructor(private service:UsersService,
        private roleService:RolesService,
        private businessesService:BusinessesService,
        private router:Router,
        private route:ActivatedRoute,
        private auth:AuthService){}

      ngOnInit(){
        const id = this.route.snapshot.paramMap.get('id');
        id && this.service.findById(id).subscribe((data:any) => {
          this.form.controls['id'].setValue(id);
          this.form.controls['roleid'].setValue(data.roleid);
          this.form.controls['businessid'].setValue(data.businessid || '');
          this.form.controls['fullname'].setValue(data.fullname);
          this.form.controls['email'].setValue(data.email);
          this.form.controls['phone'].setValue(data.phone);
          this.form.controls['location'].setValue(data.location);
          this.selectedStoreIds = (data.storeassignments || []).map((row:any) => Number(row.store?.id)).filter((id:any) => !!id);
          this.form.controls['storeids'].setValue(this.selectedStoreIds);
        });

        this.service.getCurrentUser().subscribe((current:any) => {
          this.isSiteAdmin = current?.rolename === 'Site Admin';
          this.isBusinessHead = current?.rolename === 'Business Head';
          this.isManager = !this.isSiteAdmin && !this.isBusinessHead;
          this.currentUserBusinessName = current?.businessname || '';

          this.roleService.findAll().subscribe((data:any) => {
            this.allRoles = data || [];
            this.roles = this.isSiteAdmin
              ? this.allRoles.filter((r:any) => r.name === 'Business Head')
              : this.allRoles.filter((r:any) => !ADMIN_ROLE_NAMES.includes(r.name) && !(this.isManager && r.name === 'Store Head'));
          });

          if (this.isSiteAdmin) {
            this.businessesService.getBusinesses().subscribe((data:any) => this.businesses = data || []);
          } else if (this.isManager) {
            this.service.myStores().subscribe((data:any) => this.stores = data || []);
          } else if (this.isBusinessHead) {
            this.service.getStores().subscribe((data:any) => {
              this.stores = (data || []).filter((store:any) => store.business?.id === current?.businessid);
            });
            if (!this.auth.moduleOn('hr') && id) {
              this.service.staffDetails().subscribe((r:any) => {
                const d = (r.people || []).find((p:any) => String(p.user_id) === String(id));
                if (d) this.details = staffDetailsModel(d);
              }, () => {});
            }
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
          phone: this.form.value.phone,
          location: this.form.value.location,
        };

        if (this.isSiteAdmin) {
          obj.businessid = this.form.value.businessid;
        } else if (this.isBusinessHead || this.isManager) {
          obj.storeids = this.selectedStoreIds || [];
        }

        const id = this.form.value.id;
        this.service.update(id, obj).subscribe(data => {
          const body = this.showDetails ? staffDetailsBody(this.details, this.pharmacistApplies) : null;
          if (!body) { this.gotoList(); return; }
          this.service.saveStaffDetails(id, body).subscribe(() => this.gotoList(), (err:any) => {
            const m = err?.error?.message;
            this.detailsError = 'The user was saved, but the staff details were not: ' + (Array.isArray(m) ? m.join(' ') : (m || 'try again.'));
          });
        });

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
        this.router.navigate(['/secure/settings/users/list'])
      }
}
