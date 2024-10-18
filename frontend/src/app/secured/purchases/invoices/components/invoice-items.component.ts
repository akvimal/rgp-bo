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
    grn:string = '';
    grosstotal:number = 0;
    taxtotal:number = 0;
    disctotal:number = 0;
    nettotal:number = 0;

    constructor(private route:ActivatedRoute,
        private invService: InvoiceService){}

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
            const ids = this.items.map((i:any) => {
                if(i.selected) return i.id;
            })
            
            this.invService.removeItems({invoiceid: this.invoice.id, ids}).subscribe(data => this.fetchItems(this.invoice.id));
        }
    }

    verifyItems(){
        if(this.items) {
            const ids = this.items.map((i:any) => {
                if(i.selected) return i.id;
            })
            this.invService.updateItems(ids, {status: 'VERIFIED'}).subscribe(data => this.fetchItems(this.invoice.id))
        }
    }

    updateFeedback(event:any){
        this.feedback = event.target.value;
    }
    
    updateGrn(event:any){
        this.grn = event.target.value;
    }

    confirmInvoice(){
        this.invService.confirm([this.invoice.id],{status:'RECEIVED',comments:this.feedback}).subscribe(data => {
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
}