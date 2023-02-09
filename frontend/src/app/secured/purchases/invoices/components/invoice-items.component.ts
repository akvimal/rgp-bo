import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { LoginComponent } from "src/app/@core/auth/login/login.component";
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

    //constants to calc sale price
   

    selectedProduct: any;
    filteredProducts: any[] = [];

    itemSelected:boolean = false;
    allVerified:boolean = false;
    feedback:string = '';
    grn:string = '';

    sellermargin:number = 0;
    customersaving:number = 0;

    product:any;

    form:FormGroup = new FormGroup({
        invoiceid: new FormControl('',Validators.required),
        productid: new FormControl('',Validators.required),
        batch: new FormControl(''),
        expdate: new FormControl(''),
        qty: new FormControl('',Validators.required),
        ptrcost: new FormControl('',Validators.required),
        mrpcost: new FormControl('',Validators.required),
        discpcnt: new FormControl(''),
        taxpcnt: new FormControl(''),
        saleprice: new FormControl(''),
        sellermargin: new FormControl(''),
        customersaving: new FormControl(''),
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
             (prod.category ==='Drug' && prod.props && prod.props.composition && prod.props.composition.toLowerCase().indexOf(query.toLowerCase()) >= 0) ) {
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

    // adjustSavingMargin(event:any){
    //     const sp = (this.form.value.mrpcost * (this.form.value.customersaving/100))/(1 + (this.form.value.taxpcnt/100));
    //     console.log('sp: ',sp);
    //     console.log('getPTRAfterTax: ',this.getPTRAfterTax());
        
    //     if(sp >= this.getPTRAfterTax())
    //         this.form.controls['saleprice'].setValue(sp);
    //     else {
    //         this.form.controls['saleprice'].setValue(this.getPTRAfterTax());
    //         // event.target.value = 0;
    //     }
    //     // this.form.controls['sellermargin'].setValue(sp);
    //     this.sellermargin = Math.round(((this.form.value.saleprice - this.getPTRAfterTax())/this.getPTRAfterTax())*100);
    //     this.form.controls['sellermargin'].setValue(this.sellermargin);
        
    // }

    // adjustSellerMargin(){
    //     const ptrAfterTax = this.getPTRAfterTax();
    //     const sp = ptrAfterTax+(ptrAfterTax * (this.form.value.sellermargin/100));
    //     this.form.controls['saleprice'].setValue(sp.toFixed(2));
    //     // this.form.controls['sellermargin'].setValue(this.form.value.mrpcost - (this.form.value.mrpcost * (this.form.value.customersaving/100)));
    //     this.customersaving = Math.round(((this.form.value.mrpcost - sp)/this.form.value.mrpcost)*100);
    //     console.log('this.customersaving: ',this.customersaving);
        
    //     this.form.controls['customersaving'].setValue(this.customersaving);
    // }

    calcSalePrice(rate:number,mrp:number){
        const maxm = 2.5
        const minm = 1.3
        const mins = 0.5
        
        let ptrAfterTax = this.getPTRAfterTax();

        let maxmargin = ptrAfterTax * maxm;
        let minmargin = ptrAfterTax * minm;
        let minsaving = mrp - (mrp * mins);

        
        let price = maxmargin;
        if(maxmargin > minsaving ) {
            price = (minsaving <= minmargin) ? minmargin : minsaving;
        }
        
        return price > this.getMRPBeforeTax() ? this.getMRPBeforeTax() : price.toFixed(2);
    }

    getMRPBeforeTax(){
       return +((this.form.value.mrpcost / (1 + (this.form.value.taxpcnt/100))).toFixed(2));
    }

    selectItem(event:any,id:any){
        this.invoice.items && this.invoice.items.forEach((i:any) => {
            if(i.id === id) 
                i.selected = event.target.checked;
        });

        if(this.invoice.items) {
            this.itemSelected = this.invoice.items.filter((i:any) => i.selected).length > 0;
        }
    }

    submit(){
        this.invService.saveItem({...this.form.value, total: this.total}).subscribe(data => {
          this.selectedProduct = null;  
          this.form.reset();
          this.total = 0;
          this.sellermargin = 0;
          this.customersaving = 0;
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

    calculateTotal(qty:number,price:number,disc:number,tax:number):number{
        const priceAfterDisc = price - (price * (disc/100));
        const total = qty * ((priceAfterDisc||0) * (1 + ((tax||0) / 100)));
        return isNaN(total) ? 0 : +total.toFixed(2);
    }
    
    getPTRAfterTax(){
        return this.form.value.ptrcost*(1+(this.form.value.taxpcnt/100));
    }

    calculateMargin(){
        let sp = +this.form.value.saleprice * (1 + (this.form.value.taxpcnt/100));
        const mrpBeforeTax = this.getMRPBeforeTax();
        
        // if(sp < this.getPTRAfterTax()) {
        //     sp = +this.getPTRAfterTax().toFixed(2);
        // } else if (sp > mrpBeforeTax) {
        //     sp = mrpBeforeTax;
        // }

        // this.form.controls['saleprice'].setValue(sp);
        
        this.sellermargin = Math.round(((sp - this.getPTRAfterTax())/this.getPTRAfterTax())*100);
        this.form.controls['sellermargin'].setValue(this.sellermargin);
        this.customersaving = Math.round(((this.form.value.mrpcost - sp)/this.form.value.mrpcost)*100);
        this.form.controls['customersaving'].setValue(this.customersaving);
    }

    calculate(){
        
        const ptrAfterTax = this.form.value.ptrcost * (1 + (this.form.value.taxpcnt/100))
        if(ptrAfterTax > this.form.value.mrpcost){
            this.form.controls['ptrcost'].setValue(this.getMRPBeforeTax())
        }
        
        const sp = +this.calcSalePrice(this.getPTRAfterTax(),this.form.value.mrpcost);
        
        this.form.controls['saleprice'].setValue(sp);
        if(sp < this.form.value.ptrcost){
            this.form.controls['saleprice'].setValue(this.form.value.ptrcost);
            this.form.controls['ptrcost'].setErrors({ptrcostsalesameerror:true})
        }
        else {
            this.form.controls['ptrcost'].setErrors(null)
        }

        this.total = this.calculateTotal(this.form.value.qty, this.form.value.ptrcost, this.form.value.discpcnt, this.form.value.taxpcnt);
        this.calculateMargin();
    }

    onPaid(event:any){
        this.fetchItems(event);
    }
}