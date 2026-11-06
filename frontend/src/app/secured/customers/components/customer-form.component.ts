import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, SimpleChanges, ViewChild } from "@angular/core";
import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";
import { ConfirmService } from "src/app/shared/confirm.service";

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
        mobile: new FormControl('', mobileValidator),     // optional: with no number, the name and the location tell the customer apart
        altmobile: new FormControl('', mobileValidator),
        email: new FormControl('', Validators.email),
        address: new FormControl(''),
        locality: new FormControl(''),
        // area: new FormControl(''),
        srctype: new FormControl(''),
        srcdesc: new FormControl(''),
        consent: new FormControl(''),
        preferredchannel: new FormControl(''),
        donotcontact: new FormControl(false),
        reviewoptout: new FormControl(false)
    });

    originalMobile: string | null = null;   // the saved number: no warning while it is unchanged
    sameNumber: any[] = [];                 // other customers on the typed number
    confirmDuplicate = false;
    saveError = '';
    saveNote = '';
    attempted = false;   // Save was pressed: show every problem, not only the fields already touched
    saving = false;

    /** contact details arrive masked for a login that may not read them all: they stay read-only (and are never sent back) until revealed */
    masked = false;
    revealing = false;
    revealError = '';
    privacy:any = null;
    /** the saved values, to show exactly what a save changes */
    private baseline:any = {};
    private readonly contactFields = ['mobile', 'altmobile', 'email', 'address'];

    constructor(
      private route: ActivatedRoute,
      private service:CustomersService,
      private confirm:ConfirmService,
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

      this.service.privacy().subscribe(p => this.privacy = p, () => this.privacy = null);
      id && this.service.find(id).subscribe((data:any) => {
        this.customer = data;
            this.originalMobile = data.masked ? null : (data.mobile || null);
            this.form.controls['id'].setValue(data.id);
            this.fill(data);
            if (data.masked) {
              this.masked = true;
              this.contactFields.forEach(f => this.form.controls[f].disable());
            }
      })
    }

    private fill(data:any){
            this.form.controls['name'].setValue(data.name);
            this.form.controls['mobile'].setValue(data.mobile);
            this.form.controls['altmobile'].setValue(data.altmobile);
            this.form.controls['email'].setValue(data.email);
            this.form.controls['locality'].setValue(data.locality);
            this.form.controls['address'].setValue(data.address);
            this.form.controls['srctype'].setValue(data.srctype);
            this.form.controls['srcdesc'].setValue(data.srcdesc);
            this.form.controls['consent'].setValue(data.consent || '');
            this.form.controls['preferredchannel'].setValue(data.preferredChannel || '');
            this.form.controls['donotcontact'].setValue(!!data.doNotContact);
            this.form.controls['reviewoptout'].setValue(!!data.reviewOptOut);
            this.baseline = { ...this.form.getRawValue() };
    }

    get dailyLimitReached():boolean{
        return !!this.privacy && this.privacy.left === 0;
    }

    /** shows this customer's real contact details (counted and kept), and lets them be edited */
    reveal(){
      this.revealError = '';
      this.revealing = true;
      this.service.reveal(+this.form.value.id).subscribe(d => {
        this.revealing = false;
        this.masked = false;
        this.originalMobile = d.mobile || null;
        this.contactFields.forEach(f => { this.form.controls[f].setValue(d[f] ?? ''); this.form.controls[f].enable(); this.baseline[f] = d[f] ?? ''; });
        this.service.privacy().subscribe(p => this.privacy = p, () => undefined);
      }, err => {
        this.revealing = false;
        const m = err?.error?.message;
        this.revealError = Array.isArray(m) ? m.join(' ') : (m || 'Could not show the details.');
      });
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
      return empty ? '' : 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
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

    /** no mobile typed: the location is then needed (with a name of 3 letters) to tell this customer from another of the same name */
    get noMobile(): boolean { return !String(this.form.controls['mobile'].value ?? '').trim(); }

    /** what a customer without a mobile still needs, or '' */
    get identityMissing(): string {
      if (!this.noMobile) return '';
      if (String(this.form.controls['name'].value ?? '').trim().length < 3) return 'Without a mobile number the name needs at least 3 letters.';
      if (!String(this.form.controls['locality'].value ?? '').trim()) return 'Without a mobile number, enter the location so two people with the same name can be told apart.';
      return '';
    }

    get canSave(): boolean {
      return this.form.valid && !this.identityMissing && !this.altSameAsMobile && !this.saving && (!this.sameNumber.length || this.confirmDuplicate);
    }

    /** why Save is off, in words */
    get blockedReason(): string {
      const f = this.form.controls;
      if (this.saving || this.canSave) return '';
      const noName = !String(f['name'].value ?? '').trim();
      if (f['name'].invalid) return noName ? 'The customer name is required.' : 'Enter the customer name (at least 2 letters).';
      if (f['mobile'].invalid) return 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9, or leave it blank.';
      if (this.identityMissing) return this.identityMissing;
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
        const v = this.form.getRawValue();
        const obj: any = {
          name: v.name,
          locality: v.locality,
          area: v.area,
          srctype: v.srctype,
          srcdesc: v.srcdesc,
          consent: v.consent || '',
          preferredchannel: v.preferredchannel || '',
          donotcontact: !!v.donotcontact,
          reviewoptout: !!v.reviewoptout,
          confirmduplicate: this.confirmDuplicate
        }
        // masked contact details are left out: the saved ones stay exactly as they are
        if (!this.masked) {
          obj.mobile = normaliseMobile(v.mobile) || v.mobile;
          obj.altmobile = normaliseMobile(v.altmobile) || v.altmobile || '';
          obj.email = v.email;
          obj.address = v.address;
        }

        const id = this.form.value.id;
        if (!id) { this.submit(obj, addAnother); return; }

        // changing someone's record asks first, and says what changes
        const changes = this.changes(v);
        if (!changes.length) {
          this.saveNote = '';
          this.saveError = 'Nothing has changed.';
          return;
        }
        this.saveError = '';
        this.confirm.confirmAction(`Save changes to ${String(v.name || '').trim() || 'this customer'}`, changes, 'Save changes', () => this.submit({ id, ...obj }, false), 'This will change:');
    }

    /** what differs from the saved record, in words */
    private changes(now:any): string[] {
      const labels: Record<string, string> = { name: 'Name', mobile: 'Mobile', altmobile: 'Alternate number', email: 'Email', address: 'Address', locality: 'Location',
        srctype: 'How they found us', srcdesc: 'Referral details', consent: 'Offers consent', preferredchannel: 'Preferred channel', donotcontact: 'Do not contact', reviewoptout: 'No review invitations' };
      const show = (k: string, x: any) => (k === 'donotcontact' || k === 'reviewoptout') ? (x ? 'yes' : 'no') : (String(x ?? '').trim() || '(blank)');
      return Object.keys(labels)
        .filter(k => !(this.masked && this.contactFields.includes(k)))
        .filter(k => (k === 'donotcontact' || k === 'reviewoptout') ? !!now[k] !== !!this.baseline[k] : String(now[k] ?? '').trim() !== String(this.baseline[k] ?? '').trim())
        .map(k => `${labels[k]}: ${show(k, this.baseline[k])} to ${show(k, now[k])}`);
    }

    private submit(obj:any, addAnother:boolean){
        const id = obj.id;
        this.saveError = '';
        this.saving = true;
          this.service.save(obj).subscribe((data: any) => {
            this.saving = false;
            this.saved.emit(data);
            if (addAnother && !id) {
              this.form.reset({ id: '', name: '', mobile: '', altmobile: '', email: '', address: '', locality: '', srctype: '', srcdesc: '', consent: '', preferredchannel: '', donotcontact: false, reviewoptout: false });
              this.sameNumber = [];
              this.confirmDuplicate = false;
              this.attempted = false;
              this.saveNote = `${data.name} saved. Add the next customer.`;
              setTimeout(() => this.nameInput?.nativeElement.focus());
              return;
            }
            this.form.reset();
            this.router.navigate(id ? ['/secure/customers/cust/view', id] : ['/secure/customers/cust/list'])
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
