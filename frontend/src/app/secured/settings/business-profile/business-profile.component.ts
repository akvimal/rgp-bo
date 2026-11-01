import { Component, OnInit } from "@angular/core";
import { BusinessesService } from "../businesses/businesses.service";

@Component({
    templateUrl: './business-profile.component.html'
})
export class BusinessProfileComponent implements OnInit {

    form: any = { name: '', legalname: '', gstin: '', statecode: '', address: '', pincode: '', phone: '', grievancephone: '', website: '', showmrp: false, showsaving: true, showreturnnote: true, returnnote: '' };
    logo: string | null = null;        // the logo as shown (the saved one, or a new pick)
    logoChanged = false;
    logoError = '';
    loaded = false;
    saving = false;
    message = '';
    error = '';

    constructor(private service: BusinessesService) {}

    ngOnInit() {
        this.service.getMine().subscribe((b: any) => this.fill(b), err => { this.loaded = true; this.error = this.msg(err, 'Could not load the business details.'); });
    }

    private fill(b: any) {
        this.form = {
            name: b.name || '', legalname: b.legalname || '', gstin: b.gstin || '',
            statecode: b.statecode || '', address: b.address || '', pincode: b.pincode || '', phone: b.phone || '', grievancephone: b.grievancephone || '', website: b.website || '',
            showmrp: !!b.showmrp, showsaving: b.showsaving !== false, showreturnnote: b.showreturnnote !== false, returnnote: b.returnnote || '',
        };
        this.logo = b.logo || null;
        this.logoChanged = false;
        this.loaded = true;
    }

    /** The first two characters of a GSTIN are the state: show it as it is typed. */
    get stateFromGstin(): string {
        const g = (this.form.gstin || '').trim();
        return /^[0-9]{2}/.test(g) ? g.substring(0, 2) : '';
    }

    save() {
        this.message = '';
        this.error = '';
        this.saving = true;
        const body: any = { ...this.form, gstin: (this.form.gstin || '').trim().toUpperCase() };
        if (this.stateFromGstin) body.statecode = this.stateFromGstin;
        if (this.logoChanged) body.logo = this.logo;
        this.service.updateMine(body).subscribe(
            (b: any) => { this.saving = false; this.fill(b); this.message = 'Business details saved.'; window.dispatchEvent(new CustomEvent('rgp-brand-changed', { detail: { logo: b.logo || null, name: b.name } })); },
            err => { this.saving = false; this.error = this.msg(err, 'Could not save the business details.'); });
    }

    /** A picked picture is scaled to fit a header (at most 320 x 100) in the browser, so what is kept is small; PNG keeps a transparent background. */
    pickLogo(event: Event) {
        this.logoError = '';
        const file = (event.target as HTMLInputElement).files?.[0];
        (event.target as HTMLInputElement).value = '';
        if (!file) return;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { this.logoError = 'Use a PNG, JPEG or WebP picture.'; return; }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, 320 / img.width, 100 / img.height);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            let data = canvas.toDataURL('image/png');
            if (data.length > 78000) data = canvas.toDataURL('image/jpeg', 0.85);       // a photo-like logo is smaller as JPEG
            if (data.length > 78000) { this.logoError = 'That picture is too detailed for a logo. Use a simpler or smaller one.'; return; }
            this.logo = data; this.logoChanged = true;
        };
        img.onerror = () => { URL.revokeObjectURL(url); this.logoError = 'That file could not be read as a picture.'; };
        img.src = url;
    }

    removeLogo() { this.logo = null; this.logoChanged = true; this.logoError = ''; }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return Array.isArray(m) ? m.join(' ') : (m || fallback);
    }
}
