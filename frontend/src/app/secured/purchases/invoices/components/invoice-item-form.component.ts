import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ProductsService } from "src/app/secured/products/products.service";
import { InvoiceService } from "../invoices.service";

@Component({
    selector: 'app-invoice-item-form',
    templateUrl: './invoice-item-form.component.html'
})
export class InvoiceItemFormComponent {

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        invoiceid: new FormControl('',Validators.required),
        productid: new FormControl('',Validators.required),
        batch: new FormControl(''),
        expdate: new FormControl(''),
        qty: new FormControl('',Validators.required),
        ptrcost: new FormControl('',Validators.required),
        mrpcost: new FormControl('',Validators.required),
        // discpcnt: new FormControl(''),
        taxpcnt: new FormControl(''),
        saleprice: new FormControl(''),
        // sellermargin: new FormControl(''),
        // customersaving: new FormControl(''),
      });
      
    @Input() invoiceid:any;
    @Input() itemid:any;
    @Output() added = new EventEmitter<any>();

    products:any = []
    total:any;
    selectedProduct: any;
    filteredProducts: any[] = [];

    sellermargin:number = 0;
    customersaving:number = 0;

    constructor(private invService: InvoiceService, private prodService:ProductsService){}
    
    ngOnInit(){
        this.form.controls['invoiceid'].setValue(this.invoiceid);
        this.prodService.findAll(null).subscribe(data => this.products = data);
    }

    ngOnChanges(changes:SimpleChanges){
        if(changes.itemid && changes.itemid.currentValue){
            this.invService.findItem(changes.itemid.currentValue).subscribe((data:any) => {
                // console.log(data);
                this.form.controls['id'].setValue(data.id);
                this.form.controls['invoiceid'].setValue(data.invoiceid);
                this.form.controls['productid'].setValue(data.productid);
                data.batch && this.form.controls['batch'].setValue(data.batch);
                data.expdate && this.form.controls['expdate'].setValue(this.formatExpDate(data.expdate));
                this.form.controls['mrpcost'].setValue(data.mrpcost);
                this.form.controls['ptrcost'].setValue(data.ptrcost);
                this.form.controls['qty'].setValue(data.qty);
                this.form.controls['taxpcnt'].setValue(data.taxpcnt);
                // this.form.controls['total'].setValue(data.total);
                this.form.controls['saleprice'].setValue(data.saleprice);

                if(data.product){
                    this.selectedProduct = data.product;
                }

                this.calculate();
            });
        }
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
    
    minExpDate(){
        return new Date()
    }

    selected(event:any){
        this.selectedProduct = event;
    }

    calculateTotal(qty:number,price:number,tax:number):number{
        // const priceAfterDisc = price - (price * (disc/100));
        const total = qty * (price * (1 + ((tax||0) / 100)));
        return isNaN(total) ? 0 : +total.toFixed(2);
    }
    
    getPTRAfterTax(){
        return this.form.value.ptrcost*(1+(this.form.value.taxpcnt/100));
    }

    calculateMargin(){
        let sp = +this.form.value.saleprice * (1 + (this.form.value.taxpcnt/100));
        
        this.sellermargin = Math.round(((sp - this.getPTRAfterTax())/this.getPTRAfterTax())*100);
        // this.form.controls['sellermargin'].setValue(this.sellermargin);
        this.customersaving = Math.round(((this.form.value.mrpcost - sp)/this.form.value.mrpcost)*100);
        // this.form.controls['customersaving'].setValue(this.customersaving);
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

        this.total = this.calculateTotal(this.form.value.qty, this.form.value.ptrcost, this.form.value.taxpcnt);
        
        // this.form.controls['total'].setValue(this.total);
        this.calculateMargin();
    }

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

    submit(){
        if(this.itemid){
            this.invService.updateItems([this.form.value.id],{...this.form.value,
                expdate:this.parseExpDate(this.form.value.expdate),
                total: this.total}).subscribe(data => {
                this.added.emit(this.invoiceid);
                this.resetValues();
            });
        }
        else {
            this.invService.saveItem({...this.form.value, total: this.total}).subscribe(data => {
                this.added.emit(this.invoiceid);
                this.resetValues();
            });
        }
    }

    resetValues(){
        this.selectedProduct = null;  
        this.form.reset();
        this.total = 0;
        this.sellermargin = 0;
        this.customersaving = 0;
    }

    formatExpDate(dateStr:string){
      const arr = dateStr.split('-');
      const dt = new Date();
      dt.setFullYear(+arr[0]);
      dt.setMonth((+arr[1])-1);
      return dt;//arr[1]+'/'+arr[0];
    }    

    parseExpDate(date:any){
        let mon = 0
        let day = 0
        let yr = 0
        
        if(typeof date === 'object'){
            day = date.getDay();
            mon = date.getMonth() + 1;
            yr = date.getFullYear();
        }
        else {
            const arr = date.split('/');
            mon = arr[0] + 1;
            yr = arr[1];
        }
        return yr+'-'+(mon < 10 ? '0'+mon : ''+mon)+'-01';;
    }

    // onExpSelect(date:any){
    //     const dt = new Date(Date.parse(date))
    //     const mon = dt.getMonth()+1;
    //     const dtStr = (mon < 10 ? '0'+mon : mon)  +'/'+dt.getFullYear();
    //     console.log(dtStr);
        
    //     // const dt = this.parseExpDate(date.getMonth()+'/'+date.getFullYear())
    //     // console.log('DT: ',dt);
        
    //    this.form.controls['expdate'].setValue(date);
        
    // }
}