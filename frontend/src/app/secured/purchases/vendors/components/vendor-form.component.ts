import { PropsService } from "src/app/shared/props.service";
import { Component } from "@angular/core";
import { FormArray, FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { VendorsService } from "../vendors.service";
import { GST_STATES, isValidGstin, stateName } from "../gst-util";

@Component({
    templateUrl: 'vendor-form.component.html'
})
export class VendorFormComponent{

    readonly states = GST_STATES;
    readonly vendorTypes = [
        { value: '', label: 'Not set' },
        { value: 'DISTRIBUTOR', label: 'Distributor / stockist' },
        { value: 'MANUFACTURER', label: 'Company / manufacturer' },
        { value: 'LOCAL', label: 'Local supplier' },
        { value: 'OTHER', label: 'Other' },
    ];
    readonly registrationTypes = [
        { value: 'UNKNOWN', label: 'Not known yet' },
        { value: 'REGULAR', label: 'Registered (regular)' },
        { value: 'COMPOSITION', label: 'Registered (composition)' },
        { value: 'UNREGISTERED', label: 'Not registered' },
    ];
    /** the licence types of this kind of business (the drug licences come with the pharmacy pack) */
    licenseTypes: { value: string; label: string }[] = [];

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        name: new FormControl('',[Validators.required, Validators.maxLength(40)]),
        legalname: new FormControl(''),
        vendortype: new FormControl(''),
        registrationtype: new FormControl('UNKNOWN'),
        gstn: new FormControl(''),
        pan: new FormControl(''),
        statecode: new FormControl(''),
        address: new FormControl(''),
        city: new FormControl(''),
        pincode: new FormControl('', Validators.pattern(/^([1-9][0-9]{5})?$/)),
        contactname: new FormControl(''),
        contactphone: new FormControl(''),
        mobile: new FormControl('', Validators.pattern(/^\s*(\+?91[\s-]?|0)?[6-9][0-9]{9}\s*$|^$/)),
        email: new FormControl('', Validators.email),
        repname: new FormControl(''),
        repphone: new FormControl('', Validators.pattern(/^\s*(\+?91[\s-]?|0)?[6-9][0-9]{9}\s*$|^$/)),
        paymenttermsdays: new FormControl(0, [Validators.min(0), Validators.max(365)]),
        creditlimit: new FormControl(null, Validators.min(0)),
        discountpcnt: new FormControl(null, [Validators.min(0), Validators.max(100)]),
        bankname: new FormControl(''),
        bankaccount: new FormControl('', Validators.pattern(/^([0-9A-Za-z]{6,30})?$/)),
        bankifsc: new FormControl('', Validators.pattern(/^([A-Za-z]{4}0[A-Za-z0-9]{6})?$/)),
        upiid: new FormControl('', Validators.pattern(/^([\w.\-]{2,}@[A-Za-z]{2,})?$/)),
        comments: new FormControl(''),
        licenses: new FormArray([]),
      });

      error = '';
      saving = false;
      stats:any = null;
      vendorId:any = null;
      private originalGstn = '';

      constructor(private service:VendorsService, private router:Router,
        private route:ActivatedRoute, private props: PropsService){
        this.props.licenceTypes$.subscribe((l: any[]) => this.licenseTypes = (l || []).filter((t) => t.for.includes('vendor')).map((t) => ({ value: t.code, label: t.label })));
      }

      get licenses(): FormArray { return this.form.get('licenses') as FormArray; }
      get isEdit(): boolean { return !!this.form.get('id')?.value; }

      /** live read of the GSTIN box: what it is, and what it implies */
      get gstinInfo(): { state: 'empty' | 'ok' | 'bad'; text: string } {
        const g = (this.form.value.gstn || '').trim().toUpperCase();
        if (!g) return { state: 'empty', text: '' };
        if (!isValidGstin(g)) return { state: 'bad', text: 'Not a valid GSTIN: check the letters and digits and the last character.' };
        return { state: 'ok', text: `${stateName(g.substring(0, 2))} (${g.substring(0, 2)}) · PAN ${g.substring(2, 12)}` };
      }

      /** a mistyped GSTIN blocks saving only when it was changed here; an old stored one can stay while other fields are fixed */
      get gstinBlocks(): boolean {
        return this.gstinInfo.state === 'bad' && (this.form.value.gstn || '').trim().toUpperCase() !== this.originalGstn;
      }

      ngOnInit(){
        const id = this.route.snapshot.paramMap.get('id');
        id && this.service.findById(id).subscribe((data:any) => {
          this.form.patchValue({
            id,
            name: data.name, legalname: data.legalname, vendortype: data.vendortype || '',
            registrationtype: data.registrationtype || 'UNKNOWN', gstn: data.gstn, pan: data.pan, statecode: data.statecode || '',
            address: data.address, city: data.city, pincode: data.pincode,
            contactname: data.contactname, contactphone: data.contactphone, mobile: data.mobile, email: data.email,
            repname: data.repname, repphone: data.repphone,
            paymenttermsdays: data.paymenttermsdays || 0, creditlimit: data.creditlimit, discountpcnt: data.discountpcnt,
            bankname: data.bankname, bankaccount: data.bankaccount, bankifsc: data.bankifsc, upiid: data.upiid,
            comments: data.comments,
          });
          this.originalGstn = (data.gstn || '').trim().toUpperCase();
          this.stats = data.stats || null;
          this.vendorId = id;
          (data.licenses || []).forEach((l:any) => this.addLicense(l));
        })
      }

      onGstinChange(){
        const g = (this.form.value.gstn || '').trim().toUpperCase();
        if (isValidGstin(g)) {
          this.form.patchValue({ statecode: g.substring(0, 2), pan: g.substring(2, 12) });
          if (this.form.value.registrationtype === 'UNKNOWN') this.form.patchValue({ registrationtype: 'REGULAR' });
        }
      }

      addLicense(l?:any){
        this.licenses.push(new FormGroup({
          licensetype: new FormControl(l?.licensetype || 'WHOLESALE_20B_21B'),
          number: new FormControl(l?.number || '', [Validators.required, Validators.maxLength(40)]),
          validfrom: new FormControl(l?.validfrom || ''),
          validto: new FormControl(l?.validto || ''),
          notes: new FormControl(l?.notes || ''),
        }));
      }

      removeLicense(i:number){ this.licenses.removeAt(i); }

      /** colour hint for one licence row */
      licenseHint(i:number): { cls: string; text: string } {
        const to = this.licenses.at(i).value.validto;
        if (!to) return { cls: 'text-muted', text: 'no end date' };
        const days = Math.floor((new Date(to).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86400000);
        if (days < 0) return { cls: 'text-danger', text: `expired ${-days} days ago` };
        if (days <= 60) return { cls: 'text-warning', text: `expires in ${days} days` };
        return { cls: 'text-success', text: 'valid' };
      }

      onRemove(id:any) {
        this.service.remove(id);
      }

      private num(v:any): number | null {
        return v === null || v === undefined || v === '' ? null : +v;
      }

      onSave(){
        const f = this.form.value;
        const obj:any = {
          name: f.name, legalname: f.legalname, vendortype: f.vendortype, registrationtype: f.registrationtype,
          gstn: f.gstn, pan: f.pan, statecode: f.statecode,
          address: f.address, city: f.city, pincode: f.pincode,
          contactname: f.contactname, contactphone: f.contactphone, mobile: f.mobile, email: f.email,
          repname: f.repname, repphone: f.repphone,
          paymenttermsdays: +(f.paymenttermsdays || 0), creditlimit: this.num(f.creditlimit), discountpcnt: this.num(f.discountpcnt),
          bankname: f.bankname, bankaccount: f.bankaccount, bankifsc: f.bankifsc, upiid: f.upiid,
          comments: f.comments,
          licenses: (f.licenses || []).map((l:any) => ({
            licensetype: l.licensetype, number: l.number, validfrom: l.validfrom || null, validto: l.validto || null, notes: l.notes,
          })),
        };

        this.error = '';
        this.saving = true;
        const done = () => { this.saving = false; this.gotoList(); };
        const failed = (err:any) => {
          this.saving = false;
          const m = err?.error?.message;
          this.error = Array.isArray(m) ? m.join(' ') : (m || 'Could not save the vendor.');
        };
        const id = f.id;
        if(id) {
          this.service.update(id, obj).subscribe(done, failed);
        }
        else {
          this.service.save(obj).subscribe(done, failed);
        }
      }

      reset(){
        this.form.reset({ registrationtype: 'UNKNOWN', vendortype: '', paymenttermsdays: 0 });
        this.licenses.clear();
        this.error = '';
      }

      gotoList() {
        this.router.navigate(['/secure/purchases/vendors/list'])
      }
}
