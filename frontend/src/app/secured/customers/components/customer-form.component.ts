import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, SimpleChanges, ViewChild } from "@angular/core";
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

/** the same rule the API applies: capitals or all lower case become Title Case, mixed case is left alone */
export function tidyName(v: any): string {
  const t = String(v ?? '').trim().replace(/\s+/g, ' ');
  const noLower = !/[a-z]/.test(t) && /[A-Z]/.test(t);
  const noUpper = !/[A-Z]/.test(t) && /[a-z]/.test(t);
  return noLower || noUpper ? t.toLowerCase().replace(/(^|[^A-Za-z0-9])([a-z])/g, (_m, p, c) => p + c.toUpperCase()) : t;
}

/** Angular's required lets "   " through; a name or number of only spaces is empty */
function requiredTrim(c: AbstractControl): ValidationErrors | null {
  return String(c.value ?? '').trim() ? null : { required: true };
}

function nameValidator(c: AbstractControl): ValidationErrors | null {
  return String(c.value ?? '').trim().length >= 2 ? null : { name: true };
}

function mobileValidator(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '').trim();
  return !v || normaliseMobile(v) ? null : { mobile: true };
}

@Component({
    selector: 'app-customer-form',
    templateUrl: './customer-form.component.html'
})
export class CustomerFormComponent implements AfterViewInit {

  @ViewChild('nameInput') nameInput?: ElementRef<HTMLInputElement>;

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
        name: new FormControl('',[requiredTrim, nameValidator]),
        mobile: new FormControl('',[requiredTrim, mobileValidator]),
        altmobile: new FormControl('', mobileValidator),
        email: new FormControl('', Validators.email),
        address: new FormControl(''),
        locality: new FormControl(''),
        // area: new FormControl(''),
        srctype: new FormControl(''),
        srcdesc: new FormControl('')
    });

    originalMobile: string | null = null;   // the saved number: no warning while it is unchanged
    sameNumber: any[] = [];                 // other customers on the typed number
    confirmDuplicate = false;
    saveError = '';
    saveNote = '';
    attempted = false;   // Save was pressed: show every problem, not only the fields already touched
    saving = false;

    constructor(
      private route: ActivatedRoute,
      private service:CustomersService,
      private router:Router){}

    get isNew(): boolean { return !this.form.value.id; }

    /** the source text only means something for a referral or "other" */
    get sourceNeedsText(): boolean { return ['Referral', 'Other'].includes(this.form.value.srctype); }

    ngAfterViewInit() {
      setTimeout(() => this.isNew && this.nameInput?.nativeElement.focus());
    }

    onNameBlur() {
      const c = this.form.controls['name'];
      const t = tidyName(c.value);
      if (t !== c.value) c.setValue(t);
    }

    ngOnInit(){
      const id = this.route.snapshot.paramMap.get('id');

      id && this.service.find(id).subscribe((data:any) => {
        this.customer = data;
            this.originalMobile = data.mobile || null;
            this.form.controls['id'].setValue(data.id);
            this.form.controls['name'].setValue(data.name);
            this.form.controls['mobile'].setValue(data.mobile);
            this.form.controls['altmobile'].setValue(data.altmobile);
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

    /** the message under a field, once it has been touched or Save was pressed */
    fieldError(name: 'name' | 'mobile'): string {
      const c = this.form.controls[name];
      if (!c.invalid || !(c.dirty || c.touched || this.attempted)) return '';
      const empty = !String(c.value ?? '').trim();
      if (name === 'name') return empty ? 'Name is required.' : 'Enter the customer name (at least 2 letters).';
      return empty ? 'Mobile number is required.' : 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
    }

    get altInvalid(): boolean {
      const c = this.form.controls['altmobile'];
      return c.invalid && (c.dirty || c.touched) && !!c.value;
    }

    get altSameAsMobile(): boolean {
      const a = normaliseMobile(this.form.value.altmobile);
      return !!a && a === normaliseMobile(this.form.value.mobile);
    }

    onAltBlur() {
      const c = this.form.controls['altmobile'];
      const n = normaliseMobile(c.value);
      if (n && n !== '0000000000') c.setValue(n);
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
      return this.form.valid && !this.altSameAsMobile && !this.saving && (!this.sameNumber.length || this.confirmDuplicate);
    }

    /** why Save is off, in words */
    get blockedReason(): string {
      const f = this.form.controls;
      if (this.saving || this.canSave) return '';
      const noName = !String(f['name'].value ?? '').trim();
      const noMobile = !String(f['mobile'].value ?? '').trim();
      if (noName && noMobile) return 'The customer name and mobile number are required.';
      if (f['name'].invalid) return noName ? 'The customer name is required.' : 'Enter the customer name (at least 2 letters).';
      if (f['mobile'].invalid) return noMobile ? 'The mobile number is required.' : 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
      if (f['email'].invalid) return 'The email address is not valid.';
      if (f['altmobile'].invalid) return 'The alternate number must be a 10-digit mobile starting with 6, 7, 8 or 9, or left blank.';
      if (this.altSameAsMobile) return 'The alternate number is the same as the mobile number.';
      if (this.sameNumber.length && !this.confirmDuplicate) return 'Tick the box above to confirm this is a different person on the same number.';
      return '';
    }

    onSave(addAnother = false){
        // Save is always clickable: pressing it with something missing says what, and sends nothing
        this.attempted = true;
        this.form.markAllAsTouched();
        if (!this.canSave) {
          this.saveNote = '';
          return;
        }
        const obj: any = {
          name: this.form.value.name,
          mobile: normaliseMobile(this.form.value.mobile) || this.form.value.mobile,
          altmobile: normaliseMobile(this.form.value.altmobile) || this.form.value.altmobile || '',
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
          this.service.save(id ? {id, ...obj} : obj).subscribe((data: any) => {
            this.saving = false;
            this.saved.emit(data);
            if (addAnother && !id) {
              this.form.reset({ id: '', name: '', mobile: '', altmobile: '', email: '', address: '', locality: '', srctype: '', srcdesc: '' });
              this.sameNumber = [];
              this.confirmDuplicate = false;
              this.attempted = false;
              this.saveNote = `${data.name} saved. Add the next customer.`;
              setTimeout(() => this.nameInput?.nativeElement.focus());
              return;
            }
            this.form.reset();
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


  }
