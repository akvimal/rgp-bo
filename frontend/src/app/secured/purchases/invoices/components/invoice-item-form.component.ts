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
        freeqty: new FormControl(''),
        // Phase 3 fields
        itemtype: new FormControl('REGULAR'),
        returnreason: new FormControl(''),
        challanref: new FormControl('')
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

    // Calculation breakdown
    grossAmount: number = 0;
    discountAmount: number = 0;
    amountAfterDisc: number = 0;
    taxAmount: number = 0;
    totalWithTax: number = 0;


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

                // Phase 3 fields
                this.form.controls['itemtype'].setValue(data.itemtype || 'REGULAR');
                data.returnreason && this.form.controls['returnreason'].setValue(data.returnreason);
                data.challanref && this.form.controls['challanref'].setValue(data.challanref);

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

        // Fix for issue #59: Don't override tax rate from batch
        // Tax rate should come from HSN code, not from historical batch
        const currentTaxRate = this.form.value.taxpcnt;
        if (event.taxpcnt && event.taxpcnt !== currentTaxRate) {
            console.warn(
                `⚠ Tax rate mismatch: Batch has ${event.taxpcnt}% but current HSN rate is ${currentTaxRate}%. ` +
                `Using current HSN rate ${currentTaxRate}%.`
            );
            // Don't override - keep the HSN tax rate that was set in selectProduct()
        }

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
        // Don't clear tax - it should persist for the selected product
        // this.form.controls['taxpcnt'].setValue('');
        this.total = 0;
        this.sellermargin = 0;
        this.customersaving = 0;
        this.grossAmount = 0;
        this.discountAmount = 0;
        this.amountAfterDisc = 0;
        this.taxAmount = 0;
        this.totalWithTax = 0;
    }

    selectProduct(event:any){
        this.selectedProduct = event;

        // Fetch product with tax rate from HSN code
        this.invService.getProductWithTaxRate(this.selectedProduct.id)
            .subscribe({
                next: (productWithTax: any) => {
                    console.log('Product with tax response:', productWithTax);

                    // Auto-populate tax rate if available from HSN
                    if (productWithTax && productWithTax.taxRate) {
                        const taxRate = productWithTax.taxRate;
                        this.form.controls['taxpcnt'].setValue(taxRate.totalRate);
                        console.log(`✓ Auto-populated tax rate from HSN: ${taxRate.totalRate}% (${taxRate.taxCategory})`);
                    } else if (productWithTax && productWithTax.taxpcnt) {
                        // Fallback to product's tax_pcnt if no HSN lookup available
                        this.form.controls['taxpcnt'].setValue(productWithTax.taxpcnt);
                        console.log(`✓ Auto-populated tax rate from product.taxpcnt: ${productWithTax.taxpcnt}%`);
                    } else {
                        console.warn('⚠ No tax rate found for product:', this.selectedProduct.id);
                    }
                },
                error: (error) => {
                    console.error('✗ Error fetching product with tax rate:', error);
                }
            });

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
        // Calculate gross amount
        this.grossAmount = qty * price;

        // Calculate discount amount and amount after discount
        this.discountAmount = this.grossAmount * (disc / 100);
        this.amountAfterDisc = this.grossAmount - this.discountAmount;

        // Calculate tax amount
        this.taxAmount = this.amountAfterDisc * (tax / 100);

        // Calculate final total with tax
        this.totalWithTax = this.amountAfterDisc + this.taxAmount;

        return isNaN(this.totalWithTax) ? 0 : +this.totalWithTax.toFixed(2);
    }
    
    getPTRAfterTax(){
        return this.form.value.ptrvalue * (1+(this.form.value.taxpcnt/100));
    }

    loadexist(){

        this.form.controls['ptrvalue'].setValue('')
        this.form.controls['discpcnt'].setValue('')
        // Fix for issue #59: Don't clear tax rate - it should be set from HSN
        // this.form.controls['taxpcnt'].setValue('')
        this.form.controls['mrpcost'].setValue('')
        this.form.controls['expdate'].setValue('')
        this.form.controls['qty'].setValue('')
        this.form.controls['freeqty'].setValue('')

        this.sellermargin = 0
        this.customersaving = 0
        this.total = 0
        this.batchfound = false
        this.grossAmount = 0
        this.discountAmount = 0
        this.amountAfterDisc = 0
        this.taxAmount = 0
        this.totalWithTax = 0;

        this.invService.findItemSalePrice(this.form.value.productid,this.form.value.batch).subscribe((data:any) => {
            if(data.length == 1) {
                this.batchfound = true;
                const item = data[0];
                this.form.controls['ptrvalue'].setValue(item.ptr_value);
                this.form.controls['discpcnt'].setValue(item.disc_pcnt);

                // Fix for issue #59: Don't override tax rate from batch history
                // Tax rate should always come from HSN code
                const currentTaxRate = this.form.value.taxpcnt;
                if (item.tax_pcnt && item.tax_pcnt !== currentTaxRate) {
                    console.warn(
                        `⚠ Historical batch has ${item.tax_pcnt}% tax but current HSN rate is ${currentTaxRate}%. ` +
                        `Using current HSN rate ${currentTaxRate}%.`
                    );
                }
                // Don't set: this.form.controls['taxpcnt'].setValue(item.tax_pcnt);

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
        // Ensure itemtype defaults to REGULAR after reset
        this.form.controls['itemtype'].setValue('REGULAR');
        this.total = 0;
        this.sellermargin = 0;
        this.customersaving = 0;
        this.productReset = true;
        this.grossAmount = 0;
        this.discountAmount = 0;
        this.amountAfterDisc = 0;
        this.taxAmount = 0;
        this.totalWithTax = 0;

        // Reset productReset flag after a brief delay to allow the component to process the reset
        setTimeout(() => {
            this.productReset = false;
        }, 100);
    }
}