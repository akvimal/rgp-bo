import { Component, OnInit } from "@angular/core";
import { BusinessesService } from "./businesses.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
  templateUrl: "./businesses.component.html"
})
export class BusinessesComponent implements OnInit {
  businesses:any[] = [];
  businessIdsWithHead = new Set<number>();
  message = '';
  saving = false;
  form:any = {
    id: null,
    name: '',
    isActive: true
  };

  constructor(private readonly service: BusinessesService, private readonly confirm: ConfirmService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.service.getBusinesses().subscribe((data:any) => this.businesses = data || []);
    this.service.getUsers().subscribe((users:any) => {
      this.businessIdsWithHead = new Set(
        (users || [])
          .filter((u:any) => u.role === 'Business Head')
          .map((u:any) => u.business_id)
          .filter((id:any) => !!id)
      );
    });
  }

  hasBusinessHead(business:any) {
    return this.businessIdsWithHead.has(business.id);
  }

  edit(row:any) {
    this.form = {
      id: row.id,
      name: row.name,
      isActive: row.isActive !== false
    };
  }

  reset() {
    this.form = { id: null, name: '', isActive: true };
  }

  save() {
    this.message = '';
    this.saving = true;
    const payload = {
      name: this.form.name,
      isActive: this.form.isActive !== false
    };
    const req = this.form.id ? this.service.updateBusiness(this.form.id, payload) : this.service.createBusiness(payload);
    req.subscribe(() => {
      this.saving = false;
      this.reset();
      this.refresh();
    }, err => {
      this.saving = false;
      this.message = err?.error?.message || 'Unable to save business';
    });
  }

  archive(row:any) {
    this.confirm.confirmDelete(row?.name, () => {
      this.service.deleteBusiness(row.id).subscribe(() => this.refresh(), err => {
        this.message = err?.error?.message || 'Unable to archive business';
      });
    }, { entity: 'business', verb: 'Archive' });
  }
}
