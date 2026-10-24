import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Invoice } from "../invoice.model";
import { InvoiceService } from "../invoices.service";
import { FileUploadService } from "../../../documents/file-upload.service";
import { stateName } from "../../vendors/gst-util";

@Component({
    templateUrl: './invoice-items.component.html'
})
export class InvoiceItemsComponent {

    invoice: Invoice = {};
    items:any;
    itemid:any;
    displayEditItem:boolean = false;
    itemSelected:boolean = false;
    allVerified:boolean = false;
    feedback:string = '';
    // grn:string = '';
    grosstotal:number = 0;
    taxtotal:number = 0;
    disctotal:number = 0;
    nettotal:number = 0;
    outstandingBalance:number = 0;
    importFeedback:string = '';
    completeError:string = '';
    priceByItem:{[itemid:number]:any} = {};
    priceTolerance:number = 0.5;
    priceApproval:number = 5;
    readonly priceReasons = [
        { value: 'PRICE_REVISED', label: 'Price revised' },
        { value: 'NEW_BATCH', label: 'New batch' },
        { value: 'SCHEME_ENDED', label: 'Scheme ended' },
        { value: 'VENDOR_ERROR', label: 'Vendor error' },
        { value: 'UNIT_CHANGED', label: 'Unit / pack changed' },
    ];

    confirmingDelete:boolean = false;
    deleteError:string = '';

    constructor(private route:ActivatedRoute, private router:Router, private invService: InvoiceService, private files: FileUploadService){}

    /** the lines with their tax (the Net total below), after a cash discount printed at the foot of the invoice, against the printed total */
    get expectedTotal(): number {
        const goods = this.grosstotal - this.disctotal;
        const cd = +(this.invoice.cashdiscount || 0);
        return cd > 0 && goods > cd ? this.nettotal * ((goods - cd) / goods) : this.nettotal;
    }
    get printedDiff(): number | null {
        return this.invoice.printedtotal ? +(this.expectedTotal - +this.invoice.printedtotal).toFixed(2) : null;
    }
    get totalsAgree(): boolean { return this.printedDiff === null || Math.abs(this.printedDiff) <= 1; }

    get allSelected(): boolean {
        const open = (this.items || []).filter((i:any) => i.status === 'NEW');
        return open.length > 0 && open.every((i:any) => i.selected);
    }

    selectAll(event:any){
        (this.items || []).forEach((i:any) => { if(i.status === 'NEW') i.selected = event.target.checked; });
        this.itemSelected = (this.items || []).some((i:any) => i.selected);
    }

    viewChallan(){
        this.files.view(this.invoice.challanpath).subscribe((b:any) => window.open(URL.createObjectURL(b), '_blank'), () => this.deleteError = 'Could not open the attached challan.');
    }

    viewDocument(){
        this.files.view(this.invoice.documentpath).subscribe((b:any) => window.open(URL.createObjectURL(b), '_blank'), () => this.deleteError = 'Could not open the attached invoice copy.');
    }

    /** a draft (status NEW) can be thrown away with its lines; the server refuses anything else */
    deleteDraft(){
        this.invService.remove(this.invoice.id as number).subscribe(
            () => this.router.navigate(['/secure/purchases/invoices/list']),
            (err:any) => { this.deleteError = (Array.isArray(err?.error?.message) ? err.error.message.join(' ') : err?.error?.message) || 'Could not delete the invoice.'; });
    }

    ngOnInit(){
        this.fetchItems(this.route.snapshot.paramMap.get('id'));
    }

    fetchItems(id:any){
        this.nettotal = 0;
        this.grosstotal = 0;
        this.disctotal = 0;
        this.taxtotal = 0;

        this.invService.find(id).subscribe((inv:any) => { 
            this.invoice = inv;
            this.items = inv.items.map((i:any) => {
                // this.grosstotal += +i.total;
                // console.log(`qty: ${i.qty}, ptrvalue: ${i.ptrvalue}, discpcnt: ${i.discpcnt}, taxpcnt: ${i.taxpcnt}`);
                this.grosstotal += i.ptrvalue*i.qty;
                this.disctotal += i.ptrvalue*i.qty*(i.discpcnt/100);
                this.taxtotal += ((i.ptrvalue*i.qty)-(i.ptrvalue*i.qty*(i.discpcnt/100))) *(i.taxpcnt/100);
                // console.log(`taxtotal: ${this.taxtotal}`);
                
                return {...i, selected:false}
            });
            this.nettotal = this.grosstotal - this.disctotal + this.taxtotal;
            this.outstandingBalance = +(inv.balanceamount || 0);
            this.loadPriceCheck();

            if(this.items) {
                this.itemSelected =  this.items.filter((i:any) => i.selected).length > 0;
                const verifiedItems = this.items.filter((i:any) => i.status === 'VERIFIED');
                this.allVerified = this.items.length > 0 && verifiedItems.length === this.items.length;
            }
        });
    }

    selectItem(event:any,id:any){
        this.items && this.items.forEach((i:any) => {
            if(i.id === id) 
                i.selected = event.target.checked;
        });

        if(this.items) {
            this.itemSelected = this.items.filter((i:any) => i.selected).length > 0;
        }
    }

    removeItems(){
        if(this.items) {
            const ids = this.items
                .filter((i:any) => i.selected)
                .map((i:any) => i.id);

            this.invService.removeItems({invoiceid: this.invoice.id, ids}).subscribe(data => this.fetchItems(this.invoice.id));
        }
    }

    verifyItems(){
        if(this.items) {
            const ids = this.items
                .filter((i:any) => i.selected)
                .map((i:any) => i.id);

            this.invService.updateItems(ids, {status: 'VERIFIED'}).subscribe(data => this.fetchItems(this.invoice.id))
        }
    }

    updateFeedback(event:any){
        this.feedback = event.target.value;
    }
    
    confirmInvoice(){
        this.completeError = '';
        this.invService.confirm([this.invoice.id],{status:'COMPLETE',comments:this.feedback}).subscribe(data => {
            this.fetchItems(this.invoice.id);
        }, (err:any) => {
            this.completeError = (Array.isArray(err?.error?.message) ? err.error.message.join(' ') : err?.error?.message) || 'Could not complete the invoice.';
        });
    }

    /** the vendor's previous rate for each line, so a rise is seen (and explained) before the invoice is completed */
    loadPriceCheck(){
        this.invService.priceCheck(this.invoice.id).subscribe((r:any) => {
            this.priceByItem = {};
            (r.lines || []).forEach((l:any) => this.priceByItem[l.itemid] = l);
            this.priceTolerance = r.tolerance;
            this.priceApproval = r.approval;
        }, () => this.priceByItem = {});
    }

    setPriceReason(itemid:any, reason:string){
        this.invService.updateItems([itemid], { pricereason: reason || null }).subscribe(() => this.loadPriceCheck(), () => this.loadPriceCheck());
    }

    get priceLinesNeedingReason(): number {
        return Object.values(this.priceByItem).filter((l:any) => l.level !== 'NONE' && !l.reason).length;
    }

    importOrderItems(){
        this.importFeedback = '';
        this.invService.importOrderItems(this.invoice.id).subscribe((result:any) => {
            this.importFeedback = result.message || 'PO items imported.';
            this.fetchItems(this.invoice.id);
        });
    }

    onItemAdd(event:any){
        this.fetchItems(this.invoice.id);
    }

    onPaid(event:any){
        this.fetchItems(event);
    }
    
    showItemEdit(itemid:any){
        this.itemid = itemid;
        this.displayEditItem = true;
    }

    closeEditItem(){
        this.fetchItems(this.invoice.id);
        this.displayEditItem = false;
    }

    get gstCheckOk(){
        const total = +(this.invoice.total || 0);
        const summed = +((this.invoice as any).taxablevalue || 0)
            + +((this.invoice as any).cgstamount || 0)
            + +((this.invoice as any).sgstamount || 0)
            + +((this.invoice as any).igstamount || 0)
            + +((this.invoice as any).roundoff || 0);
        return Math.abs(total - summed) < 0.5;
    }

    get itcLabel(): string {
        const v = (this.invoice as any).itceligibility;
        return v === 'CAPITAL_GOODS' ? 'Capital goods' : v === 'INELIGIBLE' ? 'Ineligible' : 'Inputs';
    }

    get placeText(): string {
        const code = (this.invoice as any).placeofsupply;
        return code ? `${code}${stateName(code) ? ' ' + stateName(code) : ''}` : '-';
    }
}
