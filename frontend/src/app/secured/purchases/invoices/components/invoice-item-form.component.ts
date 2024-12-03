import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { DateUtilService } from "src/app/secured/date-util.service";
import { InvoiceService } from "../invoices.service";

@Component({
    selector: 'app-invoice-item-form',
    templateUrl: './invoice-item-form.component.html'
})
export class InvoiceItemFormComponent {

    title=''
    batch=''
    productReset=false;
    @Input() mode=''

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        productid: new FormControl('',Validators.required),
        batch: new FormControl(''),
        expdate: new FormControl(''),
        qty: new FormControl('',Validators.required),
        ptrvalue: new FormControl('',[Validators.required]),
        mrpcost: new FormControl('',Validators.required),
        taxpcnt: new FormControl(''),
        discpcnt: new FormControl(''),
        freeqty: new FormControl('')
      });
      
    @Input() invoiceid:any;
    @Input() itemid:any;
    @Output() added = new EventEmitter<any>();

    products:any = []
    total:any;
    selectedProduct: any;
    filteredProducts: any[] = [];
    filteredBatches: any[] = [];
    batchfound:boolean = false;
    sellermargin:number = 0;
    customersaving:number = 0;
    batches:any[]=[];


    constructor(private invService: InvoiceService, 
        private dateUtilService: DateUtilService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.itemid && changes.itemid.currentValue){
            this.invService.findItem(changes.itemid.currentValue).subscribe((data:any) => {
                this.title = data.product.title;
                this.form.controls['id'].setValue(data.id);
                this.form.controls['productid'].setValue(data.productid);
                data.batch && this.form.controls['batch'].setValue(data.batch);
                data.expdate && this.form.controls['expdate'].setValue(this.dateUtilService.formatDate(data.expdate));
                this.form.controls['mrpcost'].setValue(data.mrpcost);
                this.form.controls['ptrvalue'].setValue(data.ptrvalue);
                this.form.controls['qty'].setValue(data.qty);
                this.form.controls['freeqty'].setValue(data.freeqty);
                this.form.controls['discpcnt'].setValue(data.discpcnt);
                this.form.controls['taxpcnt'].setValue(data.taxpcnt);

                if(data.product){
                    this.selectedProduct = data.product;
                }

                this.calculate();
            });
        }
    }

    filterBatch(event:any) {
        let filtered : any[] = [];
        let query = event.query;
        for(let i = 0; i < this.batches.length; i++) {
            let batch = this.batches[i];
            if (batch.batch.toLowerCase().indexOf(query.toLowerCase()) == 0 && new Date(batch.expdate) > new Date()) {
                const existing = filtered.filter(f => f.batch == batch.batch);
                if(existing.length == 0) {
                    filtered.push(batch);
                }
            }
        }
        
        this.filteredBatches = filtered;            
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
    
    today(){
        return new Date()
    }

    selectBatch(event:any){
        this.form.controls['batch'].setValue(event.batch);
        this.form.controls['ptrvalue'].setValue(event.ptrvalue);
        this.form.controls['discpcnt'].setValue(event.discpcnt);
        this.form.controls['taxpcnt'].setValue(event.taxpcnt);
        this.form.controls['mrpcost'].setValue(event.mrpcost);
        this.form.controls['expdate'].setValue(new Date(event.expdate));
    }
    
    clearBatch(){
        this.form.controls['batch'].setValue('');
        this.form.controls['expdate'].setValue('');
        this.form.controls['mrpcost'].setValue('');
        this.form.controls['qty'].setValue('');
        this.form.controls['freeqty'].setValue('');
        this.form.controls['ptrvalue'].setValue('');
        this.form.controls['discpcnt'].setValue('');
        this.form.controls['taxpcnt'].setValue('');
        this.total = 0;
        this.sellermargin = 0;
        this.customersaving = 0;
    }

    selectProduct(event:any){
        this.selectedProduct = event;
        
        this.selectedProduct && this.invService.findItemsByProduct(this.selectedProduct.id)
            .subscribe((items:any) => {
                this.batches = items.map((i:any) => {
                    return {batch:i.batch,
                        expdate:i.expdate,
                        createdt:i.createdon,
                        discpcnt:i.discpcnt,
                        taxpcnt:i.taxpcnt,
                        mrpcost:i.mrpcost.toFixed(2),
                        ptrvalue:i.ptrvalue.toFixed(2)
                    }
                });
                this.clearBatch();
        });
        this.form.controls['productid'].setValue(this.selectedProduct.id);
    }

    calculateTotal(qty:number,price:number,disc:number,tax:number):number{
        const gross = qty * price;
        const gross_after_disc = gross - (gross*(disc/100));
        const total = gross_after_disc;
        return isNaN(total) ? 0 : +total.toFixed(2);
    }
    
    getPTRAfterTax(){
        return this.form.value.ptrvalue * (1+(this.form.value.taxpcnt/100));
    }

    loadexist(){
        
        this.form.controls['ptrvalue'].setValue('')
        this.form.controls['discpcnt'].setValue('')
        this.form.controls['taxpcnt'].setValue('')
        this.form.controls['mrpcost'].setValue('')
        this.form.controls['expdate'].setValue('')
        this.form.controls['qty'].setValue('')
        this.form.controls['freeqty'].setValue('')

        this.sellermargin = 0
        this.customersaving = 0
        this.total = 0
        this.batchfound = false;

        this.invService.findItemSalePrice(this.form.value.productid,this.form.value.batch).subscribe((data:any) => {
            if(data.length == 1) {
                this.batchfound = true;
                const item = data[0];
                this.form.controls['ptrvalue'].setValue(item.ptr_value);
                this.form.controls['discpcnt'].setValue(item.disc_pcnt);
                this.form.controls['taxpcnt'].setValue(item.tax_pcnt);
                this.form.controls['mrpcost'].setValue(item.mrp_cost);
                this.form.controls['expdate'].setValue(new Date(item.exp_date));

                this.total = this.calculateTotal(this.form.value.qty, this.form.value.ptrvalue,
                this.form.value.discpcnt, this.form.value.taxpcnt);
            }
        });
    }

    calculate(){
        this.total = this.calculateTotal(this.form.value.qty, 
            this.form.value.ptrvalue, this.form.value.discpcnt, this.form.value.taxpcnt);
        const invalid = this.total >= (this.form.value.qty * this.form.value.mrpcost);
        invalid && this.form.setErrors({valid:false})
    }

    submit(){
        if(this.itemid){
            this.invService.updateItems([this.form.value.id],{...this.form.value,
                batch:this.form.value.batch.toUpperCase(),
                expdate:this.dateUtilService.parseDate(this.form.value.expdate),
                ptrcost:this.getPTRAfterTax(),
                total: this.total}).subscribe(data => {
                this.added.emit(this.invoiceid);
                this.resetValues();
            });
        }
        else {
            this.invService.saveItem({...this.form.value, expdate:this.dateUtilService.parseDate(this.form.value.expdate) , invoiceid:this.invoiceid,
                batch:this.form.value.batch.toUpperCase(),
                ptrcost:this.getPTRAfterTax(), total: this.total}).subscribe(data => {
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
        this.productReset = true;
    }
}