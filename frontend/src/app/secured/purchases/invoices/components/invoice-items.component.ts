import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Invoice } from "../invoice.model";
import { InvoiceService } from "../invoices.service";

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

    editingGst:boolean = false;
    gstForm:any = {};

    constructor(private route:ActivatedRoute, private invService: InvoiceService){}

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
        this.invService.confirm([this.invoice.id],{status:'COMPLETE',comments:this.feedback}).subscribe(data => {
            this.fetchItems(this.invoice.id);
        });
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

    startEditGst(){
        const inv:any = this.invoice;
        this.gstForm = {
            suppliergstin: inv.suppliergstin || '',
            placeofsupply: inv.placeofsupply || '',
            supplytype: inv.supplytype || 'INTRA',
            itceligibility: inv.itceligibility || 'INPUTS',
            reversecharge: !!inv.reversecharge
        };
        this.editingGst = true;
    }

    cancelEditGst(){
        this.editingGst = false;
    }

    saveGst(){
        this.invService.update([this.invoice.id], this.gstForm).subscribe(() => {
            this.editingGst = false;
            this.fetchItems(this.invoice.id);
        });
    }
}
