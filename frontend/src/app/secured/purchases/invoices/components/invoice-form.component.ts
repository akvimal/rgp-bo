import { AuthService } from "src/app/@core/auth/auth.service";
import { Component, OnInit } from "@angular/core";
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
    /** every approved order, for choosing the one a new invoice is against (the first thing asked) */
    allOrders:any[] = [];
    /** '' = not chosen yet, 'NONE' = no purchase order, else the id of the order the invoice is against */
    poChoice:string = '';
    /** the lines of the order chosen, with what is still to come (shown on the form before the invoice is saved; they become the invoice's lines on save) */
    poLines:any[] = [];
    poLinesBusy = false;
    poLinesError = '';
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
    /** the checks behind the reconciled / needs-review verdict: open by default when something needs a look */
    showChecks = false;
    filled:string[] = [];
    addProblem = '';

    // the lines saved with the draft, and how the checking is going
    scanFilter:'all' | 'open' | 'verified' | 'discarded' = 'all';
    discarding:any = null;
    savedNote = '';
    checkingAll = false;
    scanMessage = '';

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
      public auth: AuthService,
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
    /** the delivery challan panel: a challan comes only now and then, so it stays folded until it is wanted or one is already recorded */
    showChallan = false;
    get challanSummary(): string {
      const v = this.form.getRawValue();
      const bits = [String(v.challanno || '').trim() ? 'Challan ' + String(v.challanno).trim() : '', v.challanpath ? 'photo attached' : ''].filter(Boolean);
      return bits.length ? bits.join(' · ') : 'only when the goods come before the invoice (click to add)';
    }

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

      this.vendorService.options(true).subscribe((data:any) => {
        this.vendors = data;
        this.setDue();
      });

      if(!this.id) this.poService.findAllByCriteria({status:'SUBMITTED', approvalstatus:'Approved'}).subscribe((data:any) => this.allOrders = data || []);
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
        this.showChallan = !!(data.challanno || data.challanpath || data.challandate) || (!data.invoiceno && data.status !== 'NEW');      // opened when a challan is recorded, or the receipt awaits its invoice
        this.form.controls['vendorid'].disable();
        // a received invoice is fixed, except that a receipt still awaiting its invoice can take the invoice's number, date, total and GST details
        if(this.locked){
          const fixed = ['storeid','purchaseorderid'];
          if(!this.awaiting) fixed.push('invoiceno','invoicedate','printedtotal','suppliergstin','supplytype','itceligibility','reversecharge','challanno','challandate');
          fixed.forEach(k => this.form.controls[k].disable());
        }
        this.loadOrders(data.vendorid);
        // a draft made from a scanned copy comes back with its lines, as they were left
        if(data.status === 'NEW') this.loadScan(id);
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

    /** the order (or "no purchase order") a new invoice is against: an order fixes the vendor */
    choosePo(){
      const c = this.poChoice;
      const vendor = this.form.controls['vendorid'];
      if(c && c !== 'NONE'){
        const o = this.allOrders.find(x => String(x.id) === String(c));
        this.loadPoLines(c);
        this.form.controls['purchaseorderid'].setValue(String(c));
        vendor.setValue(o?.vendorid ? String(o.vendorid) : '');
        vendor.disable();
        this.setDue();
        this.loadOrders(vendor.value);
        this.checkDuplicate();
      } else {
        this.poLines = []; this.poLinesError = '';
        this.form.controls['purchaseorderid'].setValue('');
        vendor.enable();
        if(!c) vendor.setValue('');
        this.vendorChanged();
      }
    }

    /** what the order lists and how much of each is still to be invoiced */
    private loadPoLines(orderId:any){
      this.poLines = []; this.poLinesError = ''; this.poLinesBusy = true;
      this.poService.findById(+orderId).subscribe((o:any) => {
        if(String(this.poChoice) !== String(orderId)) return;
        this.poLinesBusy = false;
        this.poLines = (o?.requests || []).filter((r:any) => !!r.product).map((r:any) => {
          const ordered = +(r.orderedqty ?? r.qty) || 0, invoiced = +(r.invoicedqty) || 0;
          return { title: r.product.title, pack: r.product.pack, ordered, invoiced, remaining: Math.max(0, ordered - invoiced) };
        });
      }, () => { this.poLinesBusy = false; this.poLinesError = 'The lines of this order could not be loaded.'; });
    }

    get poLinesToCome(): number { return this.poLines.filter(l => l.remaining > 0).length; }

    /** the vendor comes from the order: it cannot be changed while the invoice is against one */
    get vendorFromOrder(): boolean { return !this.id && !!this.poChoice && this.poChoice !== 'NONE'; }

    vendorChanged(){
      if(!this.vendorFromOrder) this.form.controls['purchaseorderid'].setValue('');
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
        (res:any) => { this.form.controls['documentpath'].setValue(res?.path || ''); this.uploading = false; if(this.readOnUpload) this.read(res?.path); },
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

    /** whether an attached copy is read for its lines at once (a short invoice is often easier to type) */
    readOnUpload = true;

    /** a copy is attached and has not been read (or was read, and a reading is on screen) */
    get copyAttached(): boolean { return !!this.form.value.documentpath; }

    /** the copy last read, so the assistant can be asked to read it again */
    private readPath = '';

    /** how the copy was read, in words */
    methodLabel(m:string): string {
      return m === 'pdf' ? 'text of the PDF' : m === 'pdf-ocr' ? 'scanned PDF (OCR)' : m === 'ai-text' ? 'scan, read by the assistant' : m === 'ai-image' ? 'pictures, read by the assistant' : 'photo (OCR)';
    }

    /** the assistant is on for invoices and has not read this copy yet */
    get canAskAssistant(): boolean {
      const a = this.extracted && this.extracted.ai;
      return !!a && a.available && !a.used && !this.extracted.resumed && !!this.readPath && !this.extracting;
    }

    /** read the copy again with the assistant (words first, the pictures if that setting allows and the words are not enough) */
    readWithAssistant(){ this.read(this.readPath, true); }

    /** read the attached copy: show what was found and fill the empty fields of the form */
    read(path:string, ai = false){
      if(!path) return;
      this.readPath = path;
      this.extracting = true; this.extractError = ''; this.extracted = null; this.filled = []; this.showText = false;
      // lines already checked or discarded stay; what is still open is replaced by this reading
      const kept = this.lines.filter((l:any) => l.lineid && l.state !== 'OPEN');
      this.lines = kept;
      this.service.extract(path, ai).subscribe(
        (r:any) => {
          this.extracting = false;
          this.extracted = r;
          this.showChecks = !!r?.tieout && r.tieout.status !== 'RECONCILED';
          this.lines = kept.concat((r.lines || []).map((l:any) => this.toRow(l)));
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
        warnings: l.warnings || [], include: false,
        hsn: l.hsn || null, lineid: null, state: 'OPEN', itemid: null, verifiedbyname: null, discardreason: null, busy: false, rowError: '', snap: ''
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
          // the dialog took the focus off the row, so the pick would never be saved by the row's own blur
          if(n.row.lineid && n.row.state === 'OPEN') this.persist(n.row);
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

    /** the lines that count towards the invoice total: the ones checked, and the open ones that are complete */
    get readyLines(): any[] { return this.lines.filter(l => l.state === 'VERIFIED' || (l.state === 'OPEN' && this.ready(l))); }
    get openCount(): number { return this.lines.filter(l => l.state === 'OPEN').length; }
    /** lines that cannot be counted yet because something is missing (a product, a quantity): they explain why the lines may not match the invoice total */
    get incompleteCount(): number { return this.lines.filter(l => l.state === 'OPEN' && !this.ready(l)).length; }
    get verifiedCount(): number { return this.lines.filter(l => l.state === 'VERIFIED').length; }
    get discardedCount(): number { return this.lines.filter(l => l.state === 'DISCARDED').length; }
    get completeOpenCount(): number { return this.lines.filter(l => l.state === 'OPEN' && l.lineid && this.ready(l)).length; }
    get shownLines(): any[] { return this.scanFilter === 'all' ? this.lines : this.lines.filter(l => l.state === this.scanFilter.toUpperCase()); }

    // ---- the draft and the checking of its lines
    private invoiceId(): any { return this.form.getRawValue().id || this.id; }

    private fail(err:any, fallback:string): string {
      const m = err?.error?.message;
      return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    /** a line from the server as a row of the grid */
    private fromServer(l:any){
      const row:any = {
        lineid: l.id, description: l.description, suggestions: l.suggestions || [], searching: false,
        productid: l.productid, productTitle: l.producttitle || '', noexpiry: !!l.noexpiry,
        batch: l.batch || '', exp: l.exp || '', expText: this.expiryText(l.exp || ''),
        mrp: l.mrp, qty: l.qty, free: l.free || 0, rate: l.rate, disc: l.disc || 0, tax: l.tax,
        hsn: l.hsn, warnings: l.warnings || [], include: false,
        state: l.state, itemid: l.itemid, verifiedbyname: l.verifiedbyname, discardreason: l.discardreason, busy: false, rowError: ''
      };
      row.snap = this.snapOf(row);
      return row;
    }

    /** the part of a row that is saved as it is typed */
    private snapOf(r:any): string {
      return JSON.stringify([r.productid, r.batch, r.exp, r.mrp, r.qty, r.free, r.rate, r.disc, r.tax]);
    }

    private applyLine(row:any, l:any){ Object.assign(row, this.fromServer(l)); }

    /** open the lines saved with this draft (the panel comes back as it was left) */
    loadScan(id:any){
      this.service.scan(id).subscribe((r:any) => {
        if(!r?.lines?.length) return;
        this.extracted = { resumed: true, method: r.meta?.method || '', gstRates: r.gstRates, cashFactor: r.meta?.cashFactor || 1, header: {}, warnings: [], vendor: null };
        this.lines = r.lines.map((l:any) => this.fromServer(l));
      }, () => {});
    }

    /** a correction to an open line is saved when the cursor leaves the row */
    lineBlur(l:any){
      if(!l.lineid || l.state !== 'OPEN' || l.busy) return;
      if(this.snapOf(l) === l.snap) return;
      this.persist(l);
    }

    private persist(l:any): Promise<boolean> {
      l.rowError = '';
      return this.service.saveScanLine(this.invoiceId(), l.lineid, {
        productid: l.productid, batch: l.batch, exp: l.exp, mrp: l.mrp, qty: l.qty, free: l.free, rate: l.rate, disc: l.disc, tax: l.tax
      }).toPromise().then(() => { l.snap = this.snapOf(l); return true; }, (err:any) => { l.rowError = this.fail(err, 'The change could not be saved.'); return false; });
    }

    /** a checked line is already an item of the invoice (read-only here): taking it back is a deliberate step, and the server refuses it once the item was changed on the items page */
    async undoCheck(l:any){
      if(l.busy || l.state !== 'VERIFIED') return;
      l.busy = true; l.rowError = ''; this.scanMessage = '';
      try { this.applyLine(l, await this.service.unverifyScanLine(this.invoiceId(), l.lineid).toPromise()); }
      catch(err:any){ l.rowError = this.fail(err, 'The line could not be unchecked.'); }
      finally { l.busy = false; }
    }

    /** ticking "Checked" only marks the line as agreeing with the invoice copy; nothing moves until "Complete verification" */
    toggleCheck(l:any, ev:any){
      l.ticked = !!ev.target.checked;
      this.scanMessage = '';
    }

    /** the lines ticked and ready to be verified */
    get tickedLines(): any[] { return this.lines.filter(l => l.state === 'OPEN' && l.ticked && l.lineid && this.ready(l)); }
    get tickedCount(): number { return this.tickedLines.length; }

    /** the ticked lines become verified items of the invoice (read-only here); a line that cannot be verified stays ticked with its reason */
    async completeVerification(){
      if(this.checkingAll || !this.tickedCount) return;
      this.checkingAll = true; this.scanMessage = '';
      let done = 0, failed = 0;
      try {
        for(const l of this.tickedLines){
          l.busy = true; l.rowError = '';
          try {
            if(this.snapOf(l) !== l.snap && !(await this.persist(l))){ failed++; continue; }
            this.applyLine(l, await this.service.verifyScanLine(this.invoiceId(), l.lineid).toPromise());
            done++;
          } catch(err:any){ failed++; l.rowError = this.fail(err, 'The line could not be verified.'); }
          finally { l.busy = false; }
        }
      } finally { this.checkingAll = false; }
      this.scanMessage = `${done} line${done === 1 ? '' : 's'} verified and locked` + (failed ? `, ${failed} could not be verified` : '') + '.';
    }

    /** a clean copy: every open line that is complete is checked at once */
    async checkAll(){
      if(this.checkingAll) return;
      this.checkingAll = true; this.scanMessage = '';
      try {
        for(const l of this.lines){ if(l.lineid && l.state === 'OPEN' && this.snapOf(l) !== l.snap) await this.persist(l); }
        const r = await this.service.verifyAllScan(this.invoiceId()).toPromise();
        this.lines = (r.lines || []).map((x:any) => this.fromServer(x));
        this.scanMessage = `${r.verified} line${r.verified === 1 ? '' : 's'} checked` + (r.skipped ? `, ${r.skipped} still incomplete` : '') + (r.failed?.length ? `, ${r.failed.length} could not be checked` : '') + '.';
      } catch(err:any){ this.scanMessage = this.fail(err, 'The lines could not be checked.'); }
      finally { this.checkingAll = false; }
    }

    openDiscard(l:any){ this.discarding = { line: l, reason: '', error: '', busy: false }; }

    confirmDiscard(){
      const d = this.discarding;
      if(!d || d.busy) return;
      if(String(d.reason || '').trim().length < 3){ d.error = 'Say why the line is not on the invoice.'; return; }
      d.busy = true; d.error = '';
      this.service.discardScanLine(this.invoiceId(), d.line.lineid, d.reason).subscribe(
        (r:any) => { this.applyLine(d.line, r); this.discarding = null; },
        (err:any) => { d.busy = false; d.error = this.fail(err, 'The line could not be discarded.'); });
    }

    restoreLine(l:any){
      l.busy = true; l.rowError = '';
      this.service.restoreScanLine(this.invoiceId(), l.lineid).subscribe(
        (r:any) => { this.applyLine(l, r); },
        (err:any) => { l.busy = false; l.rowError = this.fail(err, 'The line could not be restored.'); });
    }

    /** the first save of a reading: its lines go with the draft, then the page is opened again from what was saved */
    private saveScan(invoiceid:any){
      const lines = this.lines.filter(l => !l.lineid).map(l => ({
        description: l.description, productid: l.productid, suggestions: l.suggestions, batch: l.batch, exp: l.exp, mrp: l.mrp, qty: l.qty,
        free: l.free, rate: l.rate, disc: l.disc, tax: l.tax, hsn: l.hsn, warnings: l.warnings
      }));
      this.service.saveScan(invoiceid, { meta: { method: this.extracted?.method || '', cashFactor: this.extracted?.cashFactor || 1 }, lines }).subscribe(
        () => { this.saving = false; this.router.navigate(['/secure/purchases/invoices/edit', invoiceid], { replaceUrl: true }); },
        (err:any) => {
          this.saving = false;
          this.errorMessage = 'The draft is saved, but its lines could not be: ' + this.fail(err, 'try Save draft again.');
        });
    }

    /** a draft needs only the vendor and the store: the numbers can follow */
    get missingDraft(): string[] {
      const v = this.form.getRawValue();
      const out: string[] = [];
      if(!this.id && !this.poChoice) out.push('purchase order (or "No purchase order")');
      if(!v.vendorid) out.push('vendor');
      if(!v.storeid) out.push('receiving store');
      if(this.gstinBad) out.push('a valid supplier GSTIN');
      return out;
    }
    get headerNeeded(): string[] { return this.lines.length && !this.locked ? this.missingDraft : this.missing; }
    /** an invoice-level cash discount ("Less CD 4%") comes off the goods before tax: the lines are compared after it */
    get cashFactor(): number {
      const f = +(this.extracted && this.extracted.cashFactor);
      const typed = +this.form.getRawValue().cashdiscount || 0;
      const goods = this.readyLines.reduce((t, l) => t + this.amountOf(l), 0);
      if(typed > 0 && goods > typed) return (goods - typed) / goods;
      return f > 0 && f < 1 ? f : 1;
    }
    get linesNet(): number { return Math.round(this.readyLines.reduce((t, l) => t + this.netOf(l), 0) * this.cashFactor * 100) / 100; }
    /** the footer of the lines: goods before tax, the cash discount, the GST, and the net total that is compared with the vendor's invoice */
    get linesGoods(): number { return Math.round(this.readyLines.reduce((t, l) => t + this.amountOf(l), 0) * 100) / 100; }
    get linesCashDiscount(): number { return Math.round(this.linesGoods * (1 - this.cashFactor) * 100) / 100; }
    get linesGst(): number { return Math.round((this.linesNet - (this.linesGoods - this.linesCashDiscount)) * 100) / 100; }
    get linesDifference(): number { return Math.round((this.linesNet - (+this.form.getRawValue().printedtotal || 0)) * 100) / 100; }
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
      if(v?.id && !this.id && !this.vendorFromOrder && (overwrite || !raw.vendorid)){
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
      if(!this.id && !this.poChoice) out.push('purchase order (or "No purchase order")');
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

    /** corrections made to saved lines (a product picked or added, a batch typed) that the row's blur has not saved yet */
    private get unsavedLines(): any[] { return this.lines.filter(l => l.lineid && l.state === 'OPEN' && this.snapOf(l) !== l.snap); }

    submit(flushed = false){
      if(this.headerNeeded.length || this.saving) return;
      if(!flushed && this.unsavedLines.length){
        // save the lines' own changes first, so Save never leaves a picked product behind
        this.saving = true;
        Promise.all(this.unsavedLines.map(l => this.persist(l))).then(() => { this.saving = false; this.submit(true); });
        return;
      }
      this.savedNote = '';
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
      if(!v.id && this.lines.length) obj.draft = true;           // a scanned copy is saved before its numbers are all known
      this.saving = true;
      this.addProblem = '';
      const id = v.id;
      this.service.save(id ? { id, ...obj } : obj).subscribe(
        (data:any) => {
          if(data?.status === 'ERROR'){ this.saving = false; this.errorMessage = data.message; return; }
          const invoiceid = id || data.id;
          if(!id) this.form.controls['id'].setValue(invoiceid);          // a second Save edits this invoice rather than making another
          if(this.lines.some(l => !l.lineid)){ this.saveScan(invoiceid); return; }          // the lines go with the draft
          if(this.lines.length){ this.saving = false; this.savedNote = 'Saved.'; return; }     // stay with the lines being checked
          this.saving = false; this.gotoEdit(invoiceid);
        },
        (err:any) => {
          this.saving = false;
          const m = err?.error?.message;
          this.errorMessage = (Array.isArray(m) ? m.join(' ') : m) || 'The invoice could not be saved.';
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
