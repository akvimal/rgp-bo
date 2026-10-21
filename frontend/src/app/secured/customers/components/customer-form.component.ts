import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";

/** The mobile as the API will read it: spaces, dashes, +91, 91 and a leading 0 stripped. null when it is not a mobile. */
export function normaliseMobile(value: any): string | null {
  let d = String(value ?? '').replace(/[^0-9]/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9][0-9]{9}$/.test(d) || d === '0000000000' ? d : null;
}

function mobileValidator(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '').trim();
  return !v || normaliseMobile(v) ? null : { mobile: true };
}

@Component({
    selector: 'app-customer-form',
    templateUrl: './customer-form.component.html'
})
export class CustomerFormComponent {

  customer:Customer = {name:''}
  @Output() saved = new EventEmitter();

  custLeadTypes:any[] = [
    { value: 'Walkin', label: 'Walk in' },
    // { value: 'Online', label: 'Online Search' },
    // { value: 'Banner', label: 'Banner' },
    // { value: 'PaperAd', label: 'Paper Ad' },
    { value: 'Referral', label: 'Referral' },
    // { value: 'Campaign', label: 'Campaign' },
    { value: 'Other', label: 'Other' },
    // { value: 'Unknown', label: 'Unknown' },
  ]

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        name: new FormControl('',[Validators.required, Validators.minLength(2)]),
        mobile: new FormControl('',[Validators.required, mobileValidator]),
        email: new FormControl('', Validators.email),
        address: new FormControl(''),
        locality: new FormControl(''),
        // area: new FormControl(''),
        srctype: new FormControl('',Validators.required),
        srcdesc: new FormControl('')
    });

    originalMobile: string | null = null;   // the saved number: no warning while it is unchanged
    sameNumber: any[] = [];                 // other customers on the typed number
    confirmDuplicate = false;
    saveError = '';
    saving = false;

    constructor(
      private route: ActivatedRoute,
      private service:CustomersService,
      private router:Router){}

    ngOnInit(){
      const id = this.route.snapshot.paramMap.get('id');

      id && this.service.find(id).subscribe((data:any) => {
        this.customer = data;
            this.originalMobile = data.mobile || null;
            this.form.controls['id'].setValue(data.id);
            this.form.controls['name'].setValue(data.name);
            this.form.controls['mobile'].setValue(data.mobile);
            this.form.controls['email'].setValue(data.email);
            // this.form.controls['area'].setValue(data.area);
            this.form.controls['locality'].setValue(data.locality);
            this.form.controls['address'].setValue(data.address);
            this.form.controls['srctype'].setValue(data.srctype);
            this.form.controls['srcdesc'].setValue(data.srcdesc);
      })
    }

    get mobileInvalid(): boolean {
      const c = this.form.controls['mobile'];
      return c.invalid && (c.dirty || c.touched) && !!c.value;
    }

    /** tidy the number as typed and look for other customers on it */
    onMobileBlur() {
      const c = this.form.controls['mobile'];
      const n = normaliseMobile(c.value);
      if (n) c.setValue(n);
      this.confirmDuplicate = false;
      this.sameNumber = [];
      if (!n || n === '0000000000' || n === this.originalMobile) return;
      const myId = this.form.value.id ? Number(this.form.value.id) : 0;
      this.service.byMobile(n).subscribe(rows => this.sameNumber = (rows || []).filter(r => r.id !== myId), () => this.sameNumber = []);
    }

    get canSave(): boolean {
      return this.form.valid && !this.saving && (!this.sameNumber.length || this.confirmDuplicate);
    }

    onSave(){
        const obj: any = {
          name: this.form.value.name,
          mobile: normaliseMobile(this.form.value.mobile) || this.form.value.mobile,
          email: this.form.value.email,
          address: this.form.value.address,
          locality: this.form.value.locality,
          area: this.form.value.area,
          srctype: this.form.value.srctype,
          srcdesc: this.form.value.srcdesc,
          confirmduplicate: this.confirmDuplicate
        }

        const id = this.form.value.id;
        this.saveError = '';
        this.saving = true;
          this.service.save(id ? {id, ...obj} : obj).subscribe(data => {
            this.saving = false;
            this.form.reset();
            this.saved.emit(data);
            this.router.navigate(['/secure/customers/cust/list'])
          }, err => {
            this.saving = false;
            const m = err?.error?.message;
            this.saveError = Array.isArray(m) ? m.join(' ') : (m || 'Could not save the customer.');
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
