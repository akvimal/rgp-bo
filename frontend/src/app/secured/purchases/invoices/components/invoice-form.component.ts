import { Component, OnInit } from "@angular/core";
import { from } from "rxjs";
import { concatMap, toArray } from "rxjs/operators";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { VendorsService } from "../../vendors/vendors.service";
import { Invoice } from "../invoice.model";
import { InvoiceService } from "../invoices.service";
import { PurchaseOrderService } from "../../requests/purchase-order.service";
import { StoreContextService } from "src/app/@core/store-context.service";
import { FileUploadService } from "../../../documents/file-upload.service";
import { ProductsService } from "../../../products/products.service";
import { isValidGstin } from "../../vendors/gst-util";

/**
 * The invoice header: what is printed at the top of the vendor's invoice. Lines are added on the next page. The date the
 * money is due follows the vendor's payment terms unless changed, and the printed total is kept so the lines can be checked
 * against it before the stock is received.
 */
@Component({
    templateUrl: './invoice-form.component.html'
})
export class InvoiceFormComponent implements OnInit {

    invoice:Invoice = {}
    orders:any[] = [];
    vendors:any[] = [];
    stores:any[] = [];
    errorMessage:string = '';
    saving = false;
    showMore = false;
    changingDue = false;
    duplicate:any = null;
    uploading = false;

    // what was read from the attached invoice copy
    extracting = false;
    extractError = '';
    extracted:any = null;
    lines:any[] = [];
    showText = false;
    filled:string[] = [];
    addProblem = '';

    // a product that is not in the system, added from a line without leaving the invoice
    newProduct:any = null;
    readonly schedules = ['H', 'H1', 'X', 'Other'];
    readonly subcategories = ['Supplement', 'Surgical', 'Personal Care', 'Device', 'Treatment', 'Other'];

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        vendorid: new FormControl('',Validators.required),
        storeid: new FormControl('',Validators.required),
        invoiceno: new FormControl('',[Validators.maxLength(40)]),
        challanno: new FormControl('',[Validators.maxLength(60)]),
        challandate: new FormControl(''),
        challanpath: new FormControl(''),
        invoicedate: new FormControl(this.today(),Validators.required),
        printedtotal: new FormControl(null),
        duedate: new FormControl(''),
        referenceno: new FormControl(''),
        notes: new FormControl(''),
        purchaseorderid: new FormControl(''),
        documentpath: new FormControl(''),
        cashdiscount: new FormControl(null),
        suppliergstin: new FormControl(''),
        supplytype: new FormControl(''),
        itceligibility: new FormControl(''),
        reversecharge: new FormControl(false)
      });

    constructor(
      private route: ActivatedRoute,
      private router: Router,
      private service:InvoiceService,
      private vendorService:VendorsService,
      private poService:PurchaseOrderService,
      private files:FileUploadService,
      private productsService:ProductsService,
      private storeContext:StoreContextService){}

    get id(): any { return this.route.snapshot.paramMap.get('id'); }
    /** a received invoice keeps what was received: only the due date, reference and notes change */
    /** received on a delivery challan; the vendor's invoice number is still to be entered */
    get awaiting(): boolean { return this.locked && !String(this.invoice.invoiceno || '').trim(); }
    get hasInvoiceNo(): boolean { return !!String(this.form.value.invoiceno || '').trim(); }
    uploadingChallan = false;

    get locked(): boolean { return !!this.id && !!this.invoice.status && this.invoice.status !== 'NEW'; }
    get vendor(): any { return this.vendors.find(v => +v.id === +this.form.value.vendorid) || null; }
    get terms(): number { return +(this.vendor?.paymenttermsdays || 0); }

    ngOnInit(){
      this.storeContext.stores$.subscribe((stores:any) => {
        this.stores = stores || [];
        if(!this.id && !this.form.controls['storeid'].value){
          this.form.controls['storeid'].setValue(this.storeContext.selectedStoreId || (this.stores[0] && this.stores[0].id) || '');
        }
      });

      this.vendorService.findUsable().subscribe((data:any) => {
        this.vendors = data;
        this.setDue();
      });

      const id = this.id;
      id && this.service.find(id).subscribe((data:any) => {
        this.invoice = data;
        const day = (d:any) => d ? String(d).slice(0, 10) : '';
        this.form.patchValue({
          id: data.id, vendorid: data.vendorid, storeid: data.storeid, invoiceno: data.invoiceno || '',
          challanno: data.challanno || '', challandate: day(data.challandate), challanpath: data.challanpath || '',
          invoicedate: day(data.invoicedate), duedate: day(data.duedate || data.invoicedate), printedtotal: data.printedtotal ?? null,
          referenceno: data.referenceno || '', notes: data.notes || '', purchaseorderid: data.purchaseorderid || '', documentpath: data.documentpath || '',
          cashdiscount: data.cashdiscount ?? null, suppliergstin: data.suppliergstin || '', supplytype: data.supplytype || '', itceligibility: data.itceligibility || '', reversecharge: !!data.reversecharge
        });
        this.showMore = !!(data.referenceno || data.notes || data.cashdiscount);
        this.form.controls['vendorid'].disable();
        // a received invoice is fixed, except that a receipt still awaiting its invoice can take the invoice's number, date, total and GST details
        if(this.locked){
          const fixed = ['storeid','purchaseorderid'];
          if(!this.awaiting) fixed.push('invoiceno','invoicedate','printedtotal','suppliergstin','supplytype','itceligibility','reversecharge','challanno','challandate');
          fixed.forEach(k => this.form.controls[k].disable());
        }
        this.loadOrders(data.vendorid);
      });
    }

    today(){
      const dt = new Date();
      return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    /** the due date follows the invoice date and the vendor's terms until the person sets one */
    setDue(){
      if((this.id && !this.awaiting) || this.changingDue || !this.form.value.invoicedate) return;
      const d = new Date(this.form.value.invoicedate + 'T00:00:00');
      d.setDate(d.getDate() + this.terms);
      this.form.controls['duedate'].setValue(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
    }

    dueText(): string {
      const due = this.form.value.duedate;
      if(!due) return '';
      return new Date(due + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        + (this.terms ? ` (${this.terms}-day terms)` : ' (no payment terms set for this vendor)');
    }

    vendorChanged(){
      this.form.controls['purchaseorderid'].setValue('');
      this.setDue();
      this.loadOrders(this.form.value.vendorid);
      this.checkDuplicate();
    }

    loadOrders(vendorid:any){
      this.orders = [];
      if(!vendorid) return;
      this.poService.findAllByCriteria({status:'SUBMITTED', approvalstatus:'Approved', vendorid}).subscribe((data:any) => this.orders = data || []);
    }

    poLabel(o:any): string {
      const when = o.createdon ? new Date(o.createdon).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
      const lines = o.linecount ? ` · ${o.linecount} line${o.linecount === 1 ? '' : 's'}` : '';
      const amount = o.estimatedtotal ? ` · about ₹${Math.round(o.estimatedtotal).toLocaleString('en-IN')}` : '';
      return `PO ${o.id} · ${when}${lines}${amount}`;
    }

    /** the same number from the same vendor is a double entry: say so while the person is still typing */
    checkDuplicate(){
      this.duplicate = null;
      const no = String(this.form.value.invoiceno || '').trim();
      const vendor = this.form.value.vendorid;
      if(!no || !vendor) return;
      this.service.search({ view: 'all', vendor, q: no, limit: 10 }).subscribe((r:any) => {
        const hit = (r?.data || []).find((i:any) => String(i.invoice_no).toUpperCase() === no.toUpperCase() && i.id !== this.invoice.id);
        this.duplicate = hit || null;
      });
    }

    upload(event:any){
      const file = event?.target?.files?.[0];
      if(!file) return;
      this.uploading = true;
      this.files.upload(file, `invoice=${this.form.value.vendorid || 'new'}-${Date.now()}`).subscribe(
        (res:any) => { this.form.controls['documentpath'].setValue(res?.path || ''); this.uploading = false; this.read(res?.path); },
        (err:any) => {
          this.uploading = false;
          const m = err?.error?.message;
          this.errorMessage = err?.status === 413 ? 'That file is too large. Use a PDF or photo under 10 MB.'
            : err?.status === 400 && m ? (Array.isArray(m) ? m.join(' ') : m)
            : err?.status === 401 ? 'Your session has ended. Sign in again.'
            : `Could not attach the file${err?.status ? ' (error ' + err.status + ')' : ''}. Use a PDF or photo under 10 MB.`;
        });
    }

    uploadChallan(event:any){
      const file = event?.target?.files?.[0];
      if(!file) return;
      this.uploadingChallan = true;
      this.files.upload(file, `challan=${this.form.value.vendorid || 'new'}-${Date.now()}`).subscribe(
        (res:any) => { this.form.controls['challanpath'].setValue(res?.path || ''); this.uploadingChallan = false; },
        (err:any) => {
          this.uploadingChallan = false;
          this.errorMessage = err?.status === 413 ? 'That file is too large. Use a PDF or photo under 10 MB.' : 'Could not attach the challan. Use a PDF or photo under 10 MB.';
        });
    }

    viewChallan(){
      this.files.view(this.form.value.challanpath).subscribe((b:any) => window.open(URL.createObjectURL(b), '_blank'), () => this.errorMessage = 'Could not open the attached challan.');
    }

    removeChallan(){
      this.form.controls['challanpath'].setValue('');
    }

    /** read the attached copy: show what was found and fill the empty fields of the form */
    read(path:string){
      if(!path) return;
      this.extracting = true; this.extractError = ''; this.extracted = null; this.lines = []; this.filled = []; this.showText = false;
      this.service.extract(path).subscribe(
        (r:any) => {
          this.extracting = false;
          this.extracted = r;
          this.lines = (r.lines || []).map((l:any) => this.toRow(l));
          this.applyHeader(false);
        },
        (err:any) => {
          this.extracting = false;
          const m = err?.error?.message;
          this.extractError = (Array.isArray(m) ? m.join(' ') : m) || 'The invoice copy could not be read. Enter the invoice by hand.';
        });
    }

    /** the GST rates a line may carry (set in the server's environment) */
    get rates(): number[] {
      const r = this.extracted && this.extracted.gstRates;
      return Array.isArray(r) && r.length ? r.map(Number) : [0, 5, 12, 18];
    }

    /** an expiry typed as MM/YY (or MM/YYYY): kept as YYYY-MM, or empty when it is not one */
    parseExpiry(text:string): string {
      const m = String(text || '').trim().match(/^(0?[1-9]|1[0-2])\s*[\/\-.\s]\s*(\d{2}|\d{4})$/);
      if(!m) return '';
      const y = m[2].length === 2 ? 2000 + +m[2] : +m[2];
      return y >= 2015 && y <= 2060 ? `${y}-${m[1].padStart(2, '0')}` : '';
    }

    expiryText(ym:string): string {
      const m = String(ym || '').match(/^(\d{4})-(\d{2})/);
      return m ? `${m[2]}/${m[1].slice(2)}` : '';
    }

    onExpiry(r:any){ r.exp = this.parseExpiry(r.expText); r.include = this.ready(r); }

    /** a discount is a percentage: never below 0 or above 100 */
    onDiscount(r:any){
      if(r.disc !== null && r.disc !== '' && +r.disc > 100) r.disc = 100;
      if(r.disc !== null && r.disc !== '' && +r.disc < 0) r.disc = 0;
      r.include = this.ready(r);
    }

    private rateOf(v:any): number | null {
      return v !== null && v !== undefined && v !== '' && this.rates.includes(+v) ? +v : null;
    }

    private toRow(l:any){
      const product = l.product || null;
      const row:any = {
        description: l.description, suggestions: l.suggestions || [], searching: false,
        productid: product ? product.id : null, productTitle: product ? product.title : '', noexpiry: !!(product && product.noexpiry),
        batch: l.batch || '', exp: l.expdate ? String(l.expdate).slice(0, 7) : '', expText: '',
        mrp: l.mrp, qty: l.qty, free: l.free || 0, rate: l.rate, disc: Math.min(100, Math.max(0, +l.disc || 0)),
        tax: this.rateOf(l.tax !== null && l.tax !== undefined ? l.tax : (product ? product.tax_pcnt : null)),     // only one of the allowed rates, else the person chooses
        warnings: l.warnings || [], include: false
      };
      row.expText = this.expiryText(row.exp);
      row.include = this.ready(row);
      return row;
    }

    /** a line can be added to the draft when the item form's own required things are there */
    ready(r:any): boolean {
      return !!r.productid && !!String(r.batch || '').trim() && (!!r.exp || !!r.noexpiry) && +r.qty > 0 && +r.rate >= 0 && r.rate !== null && r.rate !== '' && +r.mrp > 0
        && this.rateOf(r.tax) !== null && (+r.disc || 0) >= 0 && (+r.disc || 0) <= 100;
    }

    missingFor(r:any): string {
      const out: string[] = [];
      if(!r.productid) out.push('product');
      if(!String(r.batch || '').trim()) out.push('batch');
      if(!r.exp && !r.noexpiry) out.push('expiry');
      if(!(+r.mrp > 0)) out.push('MRP');
      if(!(+r.qty > 0)) out.push('quantity');
      if(r.rate === null || r.rate === '' || r.rate === undefined) out.push('rate');
      if(this.rateOf(r.tax) === null) out.push('GST rate');
      return out.join(', ');
    }

    amountOf(r:any): number {
      const a = (+r.qty || 0) * (+r.rate || 0) * (1 - (+r.disc || 0) / 100);
      return Math.round(a * 100) / 100;
    }

    netOf(r:any): number { return Math.round(this.amountOf(r) * (1 + (+r.tax || 0) / 100) * 100) / 100; }

    pick(r:any){
      const s = r.suggestions.find((x:any) => x.id === r.productid);
      r.productTitle = s ? s.title : '';
      r.noexpiry = !!(s && s.noexpiry);
      if(r.noexpiry){ r.exp = ''; r.expText = ''; }
      if(s && this.rateOf(r.tax) === null) r.tax = this.rateOf(s.tax_pcnt);
      r.include = this.ready(r);
    }

    openNewProduct(r:any){
      this.newProduct = {
        row: r, title: String(r.description || '').replace(/\s+/g, ' ').trim(), category: '', taxpcnt: r.tax ?? null, pack: 1, hsn: '', mfr: '',
        schedule: '', subcategory: '', noexpiry: false, error: '', saving: false
      };
    }

    saveNewProduct(){
      const n = this.newProduct;
      n.error = '';
      if(!String(n.title || '').trim()){ n.error = 'Enter the product name.'; return; }
      if(n.taxpcnt === null || n.taxpcnt === '' || !(+n.taxpcnt >= 0 && +n.taxpcnt <= 40)){ n.error = 'Enter the GST rate (0, 5, 12, 18 or 28).'; return; }
      if(n.category === 'Medicine' && !n.schedule){ n.error = 'Choose the schedule (H, H1, X or Other).'; return; }
      const props:any = {};
      if(n.category === 'Medicine') props.schedule = n.schedule;
      if(n.category === 'OTC'){ if(n.subcategory) props.subcategory = n.subcategory; if(n.noexpiry) props.noexpiry = true; }
      const body:any = { title: String(n.title).trim(), taxpcnt: +n.taxpcnt, pack: +n.pack > 0 ? +n.pack : 1, props };
      if(n.category) body.category = n.category;
      if(String(n.hsn || '').trim()) body.hsn = String(n.hsn).trim();
      if(String(n.mfr || '').trim()) body.mfr = String(n.mfr).trim();
      n.saving = true;
      this.productsService.save(body as any).subscribe(
        (p:any) => {
          this.pickProduct(n.row, { ...p, props, taxpcnt: body.taxpcnt });
          this.newProduct = null;
        },
        (err:any) => {
          n.saving = false;
          const m = err?.error?.message;
          n.error = (Array.isArray(m) ? m.join(' ') : m) || 'The product could not be added.';
        });
    }

    /** leave the search and go back to the products suggested for this line (the choice made in the search is kept as it is) */
    backToSuggestions(r:any){
      r.searching = false;
      if(!r.suggestions.some((s:any) => s.id === r.productid)){ r.productid = null; r.productTitle = ''; r.noexpiry = false; r.include = this.ready(r); }
    }

    /** run the search again (after a product was added elsewhere) */
    searchAgain(r:any){
      r.searchKey = (r.searchKey || 0) + 1;
    }

    pickProduct(r:any, p:any){
      r.productid = p?.id || null; r.productTitle = p?.title || '';
      r.searching = !(r.suggestions || []).some((s:any) => s.id === r.productid);              // a suggested product shows in the list; any other stays shown as chosen
      const flag = p?.props?.noexpiry;
      r.noexpiry = flag === true || flag === 'true';
      if(r.noexpiry){ r.exp = ''; r.expText = ''; }
      if(p && this.rateOf(r.tax) === null) r.tax = this.rateOf(p.taxpcnt ?? p.tax_pcnt ?? null);
      r.include = this.ready(r);
    }

    get readyLines(): any[] { return this.lines.filter(l => l.include && this.ready(l)); }
    /** an invoice-level cash discount ("Less CD 4%") comes off the goods before tax: the lines are compared after it */
    get cashFactor(): number {
      const f = +(this.extracted && this.extracted.cashFactor);
      const typed = +this.form.getRawValue().cashdiscount || 0;
      const goods = this.readyLines.reduce((t, l) => t + this.amountOf(l), 0);
      if(typed > 0 && goods > typed) return (goods - typed) / goods;
      return f > 0 && f < 1 ? f : 1;
    }
    get linesNet(): number { return Math.round(this.readyLines.reduce((t, l) => t + this.netOf(l), 0) * this.cashFactor * 100) / 100; }
    get linesAgree(): boolean {
      const printed = +this.form.getRawValue().printedtotal || 0;
      return !printed || Math.abs(this.linesNet - printed) <= 1;
    }

    /** put what was read into the form: only the fields still empty, or all of them when asked */
    applyHeader(overwrite:boolean){
      if(!this.extracted) return;
      const h = this.extracted.header || {};
      const v = this.extracted.vendor;
      const f = this.form;
      const raw = f.getRawValue();
      this.filled = [];
      const set = (name:string, value:any, label:string) => {
        if(value === null || value === undefined || value === '') return;
        const control = f.controls[name];
        if(!overwrite && !control.pristine && raw[name]) return;                 // the person already typed something here
        control.setValue(value);
        control.markAsDirty();
        this.filled.push(label);
      };
      if(v?.id && !this.id && (overwrite || !raw.vendorid)){
        f.controls['vendorid'].setValue(String(v.id));
        this.filled.push('vendor');
        this.vendorChanged();
      }
      set('invoiceno', h.invoiceno, 'invoice no.');
      set('invoicedate', h.invoicedate, 'invoice date');
      set('printedtotal', h.printedtotal, 'invoice total');
      if(h.cashdiscount && h.cashdiscount.amount > 0){ set('cashdiscount', h.cashdiscount.amount, 'cash discount'); this.showMore = true; }
      if(h.duedate){ this.changingDue = true; f.controls['duedate'].setValue(h.duedate); this.filled.push('due date'); }
      if(h.suppliergstin && (!this.vendor || String(this.vendor.gstn || '').toUpperCase() !== h.suppliergstin)){
        set('suppliergstin', h.suppliergstin, 'supplier GSTIN');
        this.showMore = true;
      }
      this.checkDuplicate();
    }

    viewDocument(){
      this.files.view(this.form.value.documentpath).subscribe((b:any) => window.open(URL.createObjectURL(b), '_blank'), () => this.errorMessage = 'Could not open the attached file.');
    }

    removeDocument(){
      this.form.controls['documentpath'].setValue('');
      this.extracted = null; this.lines = []; this.extractError = ''; this.filled = [];
    }

    /** a GSTIN typed here overrides the vendor's: it must be a real one */
    get gstinBad(): boolean {
        const g = String(this.form.getRawValue().suppliergstin || '').trim();
        return !!g && !isValidGstin(g);
    }

    /** what still has to be filled in, in the order the page asks for it */
    get missing(): string[] {
      const v = this.form.getRawValue();
      const out: string[] = [];
      if(!v.vendorid) out.push('vendor');
      const hasInv = !!String(v.invoiceno || '').trim();
      const hasChallan = !!String(v.challanno || '').trim();
      if(!hasInv && !hasChallan) out.push('invoice number, or challan number if the invoice has not come');
      if(hasInv && !v.invoicedate) out.push('invoice date');
      if(!hasInv && hasChallan && !(v.challandate || v.invoicedate)) out.push('challan date');
      if(!this.id && hasInv && !(+v.printedtotal > 0)) out.push('invoice total');
      if(!v.storeid) out.push('receiving store');
      if(this.gstinBad) out.push('a valid supplier GSTIN');
      return out;
    }

    submit(){
      if(this.missing.length || this.saving) return;
      this.errorMessage = '';
      const v = this.form.getRawValue();
      const obj:any = {
        invoiceno: String(v.invoiceno || '').trim().toUpperCase(),
        challanno: String(v.challanno || '').trim().toUpperCase() || null,
        challandate: v.challandate || null,
        challanpath: v.challanpath || null,
        // with no invoice yet the receipt is dated by its challan
        invoicedate: String(v.invoiceno || '').trim() ? v.invoicedate : (v.challandate || v.invoicedate),
        duedate: v.duedate || (String(v.invoiceno || '').trim() ? v.invoicedate : (v.challandate || v.invoicedate)),
        referenceno: v.referenceno,
        notes: v.notes,
        vendorid: +v.vendorid,
        storeid: +v.storeid,
        purchaseorderid: v.purchaseorderid || null,
        printedtotal: +v.printedtotal > 0 ? +v.printedtotal : null,
        cashdiscount: +v.cashdiscount > 0 ? +v.cashdiscount : null,
        documentpath: v.documentpath || null
      };
      // GST: the server fills these in from the vendor and the business's state; only what was set here goes across
      const gstin = String(v.suppliergstin || '').trim().toUpperCase();
      if(gstin){ obj.suppliergstin = gstin; obj.placeofsupply = gstin.substring(0, 2); }
      if(v.supplytype) obj.supplytype = v.supplytype;
      if(v.itceligibility) obj.itceligibility = v.itceligibility;
      obj.reversecharge = !!v.reversecharge;
      this.saving = true;
      this.addProblem = '';
      const id = v.id;
      this.service.save(id ? { id, ...obj } : obj).subscribe(
        (data:any) => {
          if(data?.status === 'ERROR'){ this.saving = false; this.errorMessage = data.message; return; }
          const invoiceid = id || data.id;
          if(!id) this.form.controls['id'].setValue(invoiceid);          // a second Save edits this invoice rather than making another
          const todo = this.readyLines;
          if(!todo.length){ this.saving = false; this.gotoEdit(invoiceid); return; }
          this.addLines(invoiceid, todo);
        },
        (err:any) => {
          this.saving = false;
          const m = err?.error?.message;
          this.errorMessage = (Array.isArray(m) ? m.join(' ') : m) || 'The invoice could not be saved.';
        });
    }

    /** add the confirmed lines to the saved draft, one after another (each also keeps the invoice total in step) */
    private addLines(invoiceid:any, todo:any[]){
      const firstDay = (ym:string) => `${ym}-01`;                                       // an expiry is kept as the 1st of its month, like the item form does
      let failed = 0;
      from(todo).pipe(
        concatMap((l:any) => {
          const rate = +l.rate, tax = +l.tax || 0;
          return new Promise<void>((resolve) => this.service.saveItem({
            invoiceid, productid: l.productid, batch: String(l.batch).trim().toUpperCase(), ...(l.exp && !l.noexpiry ? { expdate: firstDay(l.exp) } : {}),
            mrpcost: +l.mrp, qty: +l.qty, freeqty: +l.free || 0, ptrvalue: rate, ptrcost: Math.round(rate * (1 + tax / 100) * 100) / 100,
            discpcnt: +l.disc || 0, taxpcnt: tax, total: this.amountOf(l)
          } as any).subscribe(() => resolve(), () => { failed++; resolve(); }));
        }),
        toArray()
      ).subscribe(() => {
        this.saving = false;
        if(failed){ this.addProblem = `The invoice is saved, but ${failed} of ${todo.length} lines could not be added. Add them on the next page.`; }
        this.gotoEdit(invoiceid);
      });
    }

    gotoList() {
      this.router.navigate(['/secure/purchases/invoices']);
    }

    cancel() {
      this.id ? this.gotoEdit(this.id) : this.gotoList();
    }

    gotoEdit(id:any){
      this.router.navigate([`/secure/purchases/invoices/items/${id}`])
    }
}
