import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { ProductsService } from "../../../products/products.service";
import { Invoice } from "../invoice.model";
import { InvoiceService } from "../invoices.service";

@Component({
    templateUrl: './invoice-items.component.html'
})
export class InvoiceItemsComponent {

    products:any = []
    invoice: Invoice = {};
    total:any;

    selectedProduct: any;
    filteredProducts: any[] = [];

    itemSelected:boolean = false;
    allVerified:boolean = false;
    feedback:string = '';
    grn:string = '';

    product:any;

    form:FormGroup = new FormGroup({
        invoiceid: new FormControl('',Validators.required),
        productid: new FormControl('',Validators.required),
        batch: new FormControl('',Validators.required),
        expdate: new FormControl('',Validators.required),
        qty: new FormControl('',Validators.required),
        ptrcost: new FormControl('',Validators.required),
        mrpcost: new FormControl('',Validators.required),
        taxpcnt: new FormControl('',Validators.required)
      });

    constructor(private route:ActivatedRoute,
        private invService: InvoiceService, private prodService:ProductsService){}

    ngOnInit(){
        this.prodService.findAll(null).subscribe(data => this.products = data);
        this.fetchItems(this.route.snapshot.paramMap.get('id'));
    }

    minExpDate(){
        return new Date()
    }

    filterProduct(event:any) {
        //in a real application, make a request to a remote url with the query and return filtered results, for demo we filter at client side
        let filtered : any[] = [];
        let query = event.query;

        for(let i = 0; i < this.products.length; i++) {
            let prod = this.products[i];
            if ((prod.title.toLowerCase().indexOf(query.toLowerCase()) == 0) || 
             (prod.props && prod.props.composition.toLowerCase().indexOf(query.toLowerCase()) >= 0) ) {
                filtered.push(prod);
            }
        }
        this.filteredProducts = filtered;
    }

    selected(event:any){
        this.selectedProduct = event;
    }

    fetchItems(id:any){
        this.invService.find(id).subscribe((inv:any) => { 
            this.invoice = inv;
            // console.log('invoice:',this.invoice);
            this.form.controls['invoiceid'].setValue(this.invoice.id);
            
            this.invoice.items = inv.items.map((i:any) => {
                return {...i, selected:false}
            });

            if(this.invoice.items) {
                this.itemSelected =  this.invoice.items.filter((i:any) => i.selected).length > 0;
                const verifiedItems = this.invoice.items.filter((i:any) => i.status === 'VERIFIED');
                this.allVerified = this.invoice.items.length > 0 && verifiedItems.length === this.invoice.items.length;
            }
        });
    }

    selectItem(event:any,id:any){
        this.invoice.items && this.invoice.items.forEach((i:any) => {
            if(i.id === id) 
                i.selected = event.target.checked;
        });

        if(this.invoice.items) 
            this.itemSelected = this.invoice.items.filter((i:any) => i.selected).length > 0;
        
    }

    submit(){
        this.invService.saveItem({...this.form.value, total: this.total}).subscribe(data => {
          this.selectedProduct = null;  
          this.form.reset();
          this.total = '';
          this.fetchItems(this.invoice.id);
        });
        //TODO: show saved confirmation properly
        
    }

    removeItems(){
        if(this.invoice.items) {
            const ids = this.invoice.items.map((i:any) => {
                if(i.selected) return i.id;
            })
            
            this.invService.removeItems({invoiceid: this.invoice.id, ids}).subscribe(data => this.fetchItems(this.invoice.id));
        }
    }

    verifyItems(){
        if(this.invoice.items) {
            const ids = this.invoice.items.map((i:any) => {
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
        this.invService.update([this.invoice.id],{status:'RECEIVED',grn:this.grn,comments:this.feedback}).subscribe(data => {
            this.fetchItems(this.invoice.id);
        });
    }

    onItemAdd(event:any){
        this.fetchItems(this.invoice.id);
    }

    calculateTotal(qty:number,price:number,tax:number):number{
        const total = qty * ((price||0) * (1 + ((tax||0) / 100)));
        return isNaN(total) ? 0 : +total.toFixed(2);
      }
    
    calculate(){
        this.total = this.calculateTotal(this.form.value.qty, this.form.value.ptrcost, this.form.value.taxpcnt);       
    }

    onPaid(event:any){
        this.fetchItems(event);
    }
}