import { Component } from "@angular/core";
import { VendorsService } from "../vendors.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { stateName } from "../gst-util";

@Component({
    templateUrl: 'vendor-list.component.html'
})
export class VendorListComponent {

    vendors:any;
    expiring:any[] = [];
    readonly stateName = stateName;

    readonly views = [
        { key: 'active', label: 'Active' },
        { key: 'blocked', label: 'Blocked' },
        { key: 'disabled', label: 'Disabled' },
        { key: 'all', label: 'All' },
    ];
    view = 'active';

    // block form (one vendor at a time)
    blocking:any = null;
    blockReason = '';
    blockError = '';
    actionError = '';

    private readonly licenseNames:any = {
        WHOLESALE_20B_21B: 'wholesale licence', RETAIL_20_21: 'retail licence', MANUFACTURING: 'manufacturing licence', FSSAI: 'FSSAI', OTHER: 'licence',
    };

    constructor(private service:VendorsService, private confirm:ConfirmService){}

    ngOnInit(){
        this.fetchList()
    }

    pick(view:string){
        this.view = view;
        this.blocking = null;
        this.fetchList();
    }

    /** Disable = retire the vendor. History and dues stay; it can be enabled again. */
    disable(vendor:any){
        this.confirm.confirmDelete(vendor?.name, () => {
            this.service.remove(vendor.id).subscribe(() => this.fetchList(), err => this.fail(err));
        }, { entity: 'vendor', verb: 'Disable', reversible: true,
             consequence: 'It will no longer be offered on new purchase requests, orders or invoices. Its history and any unpaid invoices stay, and you can enable it again.' });
    }

    enable(vendor:any){
        this.actionError = '';
        this.service.enable(vendor.id).subscribe(() => this.fetchList(), err => this.fail(err));
    }

    openBlock(vendor:any){
        this.blocking = vendor;
        this.blockReason = '';
        this.blockError = '';
    }

    cancelBlock(){ this.blocking = null; }

    block(){
        const reason = (this.blockReason || '').trim();
        if (reason.length < 5) { this.blockError = 'Give a reason of at least 5 characters.'; return; }
        this.service.block(this.blocking.id, reason).subscribe(
            () => { this.blocking = null; this.fetchList(); },
            err => { this.blockError = this.message(err, 'Could not block the vendor.'); });
    }

    unblock(vendor:any){
        this.actionError = '';
        this.service.unblock(vendor.id).subscribe(() => this.fetchList(), err => this.fail(err));
    }

    fetchList(){
        this.service.findAll(this.view).subscribe(data => this.vendors = data);
        this.service.expiringLicenses(60).subscribe(rows => this.expiring = rows || [], () => this.expiring = []);
    }

    licenseLabel(type:string){ return this.licenseNames[type] || 'licence'; }

    licenseText(status:string){
        return status === 'VALID' ? 'Valid' : status === 'EXPIRING' ? 'Expiring' : status === 'EXPIRED' ? 'Expired' : 'None recorded';
    }

    licenseClass(status:string){
        return status === 'VALID' ? 'bg-success' : status === 'EXPIRING' ? 'bg-warning text-dark' : status === 'EXPIRED' ? 'bg-danger' : 'bg-secondary';
    }

    private fail(err:any){ this.actionError = this.message(err, 'That did not work.'); }

    private message(err:any, fallback:string): string {
        const m = err?.error?.message;
        return Array.isArray(m) ? m.join(' ') : (m || fallback);
    }
}
