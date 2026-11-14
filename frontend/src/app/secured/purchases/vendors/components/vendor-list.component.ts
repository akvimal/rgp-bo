import { Component, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { PeekAddressService } from "src/app/shared/peek-address.service";
import { VendorsService } from "../vendors.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { stateName } from "../gst-util";
import { RowAction } from "src/app/shared/components/row-actions.component";

@Component({
    templateUrl: 'vendor-list.component.html'
})
export class VendorListComponent implements OnDestroy {

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

    /** the vendor open in the side panel, kept in the address (?peek=12) so Back closes it */
    peekId: number | null = null;
    private peekSub?: Subscription;

    constructor(private service:VendorsService, private confirm:ConfirmService, private peekAddress: PeekAddressService){}

    ngOnInit(){
        this.peekSub = this.peekAddress.peek$.subscribe(v => this.peekId = v && /^\d+$/.test(v) ? Number(v) : null);
        this.fetchList()
    }
    ngOnDestroy(){ this.peekSub?.unsubscribe(); }

    /** the row of the open panel, from the list as it stands (a vendor not in this view shows no panel) */
    get peekVendor(): any { return this.peekId && Array.isArray(this.vendors) ? this.vendors.find((v:any) => v.id === this.peekId) || null : null; }
    openPeek(id:number){ this.peekAddress.open(id); }

    /** the row's actions in the standard order: view, edit, then the rest with the destructive one last */
    private actionCache = new Map<string, RowAction[]>();
    actionsOf(vendor:any): RowAction[] {
        // the same array for the same vendor and status, so the template does not see a new value on every check
        const key = `${vendor.id}|${vendor.status}`;
        const hit = this.actionCache.get(key);
        if(hit) return hit;
        const made = this.buildActions(vendor);
        this.actionCache.set(key, made);
        return made;
    }
    private buildActions(vendor:any): RowAction[] {
        return [
            { key: 'view', label: 'View' },
            { key: 'edit', label: 'Edit', link: ['../edit', vendor.id] },
            { key: 'invoices', label: 'Invoices', icon: 'bi-receipt', link: ['/secure/purchases/invoices/list'], queryParams: { vendor: vendor.id } },
            { key: 'block', label: 'Block: no new orders or invoices', icon: 'bi-slash-circle', hidden: vendor.status !== 'ACTIVE' },
            { key: 'unblock', label: 'Unblock', icon: 'bi-unlock', hidden: vendor.status !== 'BLOCKED' },
            { key: 'enable', label: 'Enable again', icon: 'bi-arrow-counterclockwise', hidden: vendor.status !== 'DISABLED' },
            { key: 'disable', label: 'Disable (retire)', danger: true, hidden: vendor.status === 'DISABLED' },
        ];
    }
    act(key:string, vendor:any){
        if(key === 'view') this.openPeek(vendor.id);
        else if(key === 'block') this.openBlock(vendor);
        else if(key === 'unblock') this.unblock(vendor);
        else if(key === 'enable') this.enable(vendor);
        else if(key === 'disable') this.disable(vendor);
    }
    closePeek(){ this.peekAddress.close(); }

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
