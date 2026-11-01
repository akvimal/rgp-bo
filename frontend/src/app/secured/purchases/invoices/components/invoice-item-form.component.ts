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
        qty: new FormControl('',[Validators.required, Validators.min(0.0001)]),
        ptrvalue: new FormControl('',[Validators.required, Validators.min(0)]),
        mrpcost: new FormControl('',[Validators.required, Validators.min(0)]),
        taxpcnt: new FormControl('',Validators.required),
        discpcnt: new FormControl('',[Validators.min(0), Validators.max(100)]),
        freeqty: new FormControl('',Validators.min(0))
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
    /** the tax rates this business buys at (a pharmacy: 0, 5 and 18) */
    taxRates:number[] = [];
    /** what the line being typed means: new product, best margin, suggested price, MRP far above the rate */
    check:any = null;
    error = '';
    private checkTimer:any = null;

    constructor(private invService: InvoiceService,
        private dateUtilService: DateUtilService){
        this.invService.taxRates().subscribe((r) => this.taxRates = r.rates || [], () => this.taxRates = [0, 5, 12, 18, 28]);
    }

    /** the rates to choose from, plus the one the line already has (an older batch may carry a rate no longer in the list) */
    get taxOptions():number[] {
        const cur = this.form.value.taxpcnt;
        const all = new Set<number>(this.taxRates);
        if(cur !== '' && cur !== null && cur !== undefined && !isNaN(+cur)) all.add(+cur);
        return Array.from(all).sort((a, b) => a - b);
    }

    /** the years offered for the expiry: this year and the next fifteen (it moves with the date) */
    get yearRange():string {
        const y = new Date().getFullYear();
        return `${y}:${y + 15}`;
    }

    /** a minus sign, plus or exponent cannot be typed into a number box */
    noMinus(e:KeyboardEvent){
        if(e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') e.preventDefault();
    }

    /** what is wrong with the values typed, said in plain words (only for boxes that have something in them) */
    get problems():string[] {
        const v = this.form.value;
        const given = (x:any) => x !== '' && x !== null && x !== undefined;
        const out:string[] = [];
        if(given(v.qty) && !(+v.qty > 0)) out.push('Qty must be more than 0');
        if(given(v.freeqty) && +v.freeqty < 0) out.push('Free cannot be negative');
        if(given(v.mrpcost) && +v.mrpcost < 0) out.push('MRP cannot be negative');
        if(given(v.ptrvalue) && +v.ptrvalue < 0) out.push('Rate cannot be negative');
        if(given(v.discpcnt) && (+v.discpcnt < 0 || +v.discpcnt > 100)) out.push('Disc% must be from 0 to 100');
        if(given(v.taxpcnt) && +v.taxpcnt < 0) out.push('Tax% cannot be negative');
        return out;
    }

    get taxMissing():boolean {
        const t = this.form.value.taxpcnt;
        return !!this.form.value.productid && (t === '' || t === null || t === undefined);
    }

    /** asks what the line means (after a pause, so typing is not interrupted) */
    private scheduleCheck(){
        clearTimeout(this.checkTimer);
        const v = this.form.value;
        if(this.mode === 'edit' || !v.productid || !(+v.mrpcost > 0) || !(+v.ptrvalue > 0)){ this.check = null; return; }
        this.checkTimer = setTimeout(() => {
            this.invService.lineCheck({productid: v.productid, mrp: +v.mrpcost, ptrvalue: +v.ptrvalue, disc: +v.discpcnt || 0, qty: +v.qty || 1, free: +v.freeqty || 0, tax: +v.taxpcnt || 0})
                .subscribe((r:any) => this.check = r && r.ready ? r : null, () => this.check = null);
        }, 400);
    }

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

                    // Load batches for the product to enable batch editing
                    this.invService.findItemsByProduct(data.productid).subscribe((items:any) => {
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
                    });
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

                // If batches exist, use the most recent one as default
                if(this.batches.length > 0) {
                    const latestBatch = this.batches[0]; // Most recent batch
                    this.form.controls['ptrvalue'].setValue(latestBatch.ptrvalue);
                    this.form.controls['discpcnt'].setValue(latestBatch.discpcnt);
                    this.form.controls['taxpcnt'].setValue(latestBatch.taxpcnt);
                    this.form.controls['mrpcost'].setValue(latestBatch.mrpcost);
                    this.calculate();
                } else {
                    // Only clear if no existing batches
                    this.clearBatch();
                }
        });
        this.form.controls['productid'].setValue(this.selectedProduct.id);
    }

    /** a product that never expires (a blade, a thermometer) carries the "No expiry date" property: its lines need no expiry */
    get noExpiry(): boolean {
        const flag = this.selectedProduct?.props?.noexpiry;
        return flag === true || flag === 'true';
    }

    get expiryMissing(): boolean { return !this.noExpiry && !this.form.value.expdate; }

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
        this.total = this.calculateTotal(this.form.value.qty, this.form.value.ptrvalue, this.form.value.discpcnt, this.form.value.taxpcnt);
        const invalid = this.total >= (this.form.value.qty * this.form.value.mrpcost);
        invalid && this.form.setErrors({valid:false})
        this.scheduleCheck();
    }

    private failed(err:any){
        const m = err?.error?.message;
        this.error = (Array.isArray(m) ? m.join(' ') : m) || 'The item could not be added. Check the values and try again.';
    }

    submit(){
        this.error = '';
        if(this.expiryMissing || this.problems.length || this.taxMissing) return;
        if(this.itemid){
            this.invService.updateItems([this.form.value.id],{...this.form.value,
                batch:this.form.value.batch.toUpperCase(),
                expdate:this.dateUtilService.parseDate(this.form.value.expdate),
                ptrcost:this.getPTRAfterTax(),
                total: this.total}).subscribe(data => {
                this.added.emit(this.invoiceid);
                this.resetValues();
            }, (err:any) => this.failed(err));
        }
        else {
            this.invService.saveItem({...this.form.value, expdate:this.dateUtilService.parseDate(this.form.value.expdate) , invoiceid:this.invoiceid,
                batch:this.form.value.batch.toUpperCase(),
                ptrcost:this.getPTRAfterTax(), total: this.total}).subscribe(data => {
                this.added.emit(this.invoiceid);
                this.resetValues();
            }, (err:any) => this.failed(err));
        }
    }

    resetValues(){
        this.selectedProduct = null;  
        this.form.reset();
        this.total = 0;
        this.sellermargin = 0;
        this.customersaving = 0;
        this.productReset = true;
        this.check = null;
        this.error = '';
    }
}