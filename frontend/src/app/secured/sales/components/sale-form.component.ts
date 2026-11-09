import { GST_STATES, isValidGstin } from "../../purchases/vendors/gst-util";
import { Component } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ProductUtilService } from "../../product-util.service";
import { StockService } from "../../store/stock/stock.service";
import { SaleHelper } from "../sale.helper";
import { Sale } from "../models/sale.model";
import { SaleService } from "../sales.service";
import { CustomersService } from "../../customers/customers.service";
import { OperatorContextService } from "src/app/@core/operator-context.service";
import { StoreContextService } from "src/app/@core/store-context.service";
import { monthlyUnits, monthsCovered } from "../supply-rule";
import { AuthService } from "src/app/@core/auth/auth.service";
import { DrugRegisterService } from "src/app/packs/pharmacy/drug-register.service";
import { detailProblems, rxProblems } from "src/app/packs/pharmacy/drug-register-rules";

@Component({
    templateUrl: 'sale-form.component.html'
})
export class SaleFormComponent {

    customer: any = {existing:false,mobile:'',name:'',locality:''}
    /** a bill for someone with no mobile number: the name and location tell them apart */
    noMobileMode = false;
    /** the states of GST, for a delivery to another state */
    gstStates = GST_STATES;
    sale:Sale = {status:'NEW',items:[],digimethod:'UPI'}
    
    showDocument = false;
    docpath = '';
    docname = '';
    documents:any[] = [];
    doctypes:any[] =[];

    showCustomerView = false;

    total:number = 0;
    payment:any = {};

    prevCustSales:Sale[] = []
    fetchCustomerPrevSales = true;

    form:FormGroup = new FormGroup({});

    custCustomerTypes:any[] = [
      { value: 'Walkin', label: 'Walk in' },
      // { value: 'Online', label: 'Online Search' },
      // { value: 'Banner', label: 'Banner' },
      { value: 'PaperAd', label: 'Advertisement' },
      { value: 'Referral', label: 'Referral' },
      // { value: 'Campaign', label: 'Campaign' },
      { value: 'Other', label: 'Other' },
      // { value: 'Unknown', label: 'Unknown' },
    ]

    constructor(private route: ActivatedRoute,
      private router: Router, 
      private helper: SaleHelper,
      private service: SaleService,
      private customerService: CustomersService,
      private stockService: StockService,
      private prodUtilService: ProductUtilService,
      private operatorContext: OperatorContextService,
      private storeContext: StoreContextService,
      public auth: AuthService,
      private drugRegister: DrugRegisterService){}

    ngOnInit(){
      // pharmacy pack: which schedules need the patient and the prescriber on a bill (nothing is asked when the business has not got the drug register)
      if (this.auth.moduleOn('drug_register')) this.drugRegister.config().subscribe((c) => { this.scheduleRequired = c.required || []; this.scheduleEnforce = c.enforce || []; }, () => this.scheduleRequired = []);

      this.sale.billdate = new Date();
      this.sale['customer'] = this.customer;
      this.sale['ordertype'] = 'Walk-in';
      this.sale['deliverytype'] = 'Counter';
      //get the id from url query params
      this.route.paramMap.subscribe(params => {  
        const saleId =  params.get("id");

        saleId !== null && this.service.find(saleId).subscribe((result:any) => {
          console.log(result);
          
          this.service.findItemsWithAvailableQty(+saleId).subscribe((items:any) => {
            result['items'] = items.map((element:any) => {
              // the GST is today's rate for the product, not the batch's own (product_taxpcnt) nor what the line was saved at (tax_pcnt): a held bill
              // reopened after a change of rate used to come back at the old batch rate. A line whose rate moves is totalled again.
              const rate = element.sale_tax !== undefined && element.sale_tax !== null ? +element.sale_tax : +element.product_taxpcnt;
              const moved = Math.abs(rate - (+element.tax_pcnt || 0)) >= 0.005;
              return {...element, edited:true, title: element.product_title,
                taxpcnt: rate,
                total: moved ? this.helper.lineTotal(+element.qty, +element.price, rate) : element.total,
                mrpcost: (element.mrp/element.product_pack),
                expdate: element.product_expdate,
                unitsbal: element.available - element.product_pack,
                itemid: element.purchase_itemid
              }
            });
        
            if(result['props'])
              this.documents = result['props']['documents'];
            this.scheduleDetail = (result['props'] && result['props']['scheduledetail']) || {};

            this.sale = result;

            if(this.sale.customer)
              this.sale.customer = {...this.sale.customer, existing:true, mobile: this.sale.customer.mobile ?? ''};
            else
              this.sale.customer = this.customer;

            this.payment['cashamt'] = this.sale['cashamt'];
            this.payment['digimode'] = this.sale['digimethod'];
            this.payment['digiamt'] = this.sale['digiamt'];
            this.payment['digirefno'] = this.sale['digirefno'];
            this.payment['modechosen'] = true;          // a saved bill already says how it is paid
            this.sale['docpending'] = result['docpending'];
            // console.log(this.sale['docpending']);
            this.recalculateTotal()
          });
        });
      });
    }

    saveCustomer(){
      // at the counter a second person on a known number is normal (family), so the duplicate warning is pre-confirmed
      this.customerService.save({name:this.sale.customer.name,
        mobile:this.sale.customer.mobile,
        email:this.sale.customer.email, confirmduplicate: true} as any).subscribe(data => {
          // console.log('customer saved',data);
          this.sale.customer = {...data, existing: true};
        }, err => {
          const m = err?.error?.message;
          this.submitError = Array.isArray(m) ? m.join(' ') : (m || 'Could not save the customer.');
        });
    }

    resetCustomer(){
      this.sale.customer['existing'] = false;
      this.sale.customer['mobile'] = '';
      this.sale.customer['name'] = '';
      this.sale.customer['email'] = '';
      this.sale.customer['locality'] = '';
      this.noMobileMode = false;
    }

    useNoMobile(){
      this.noMobileMode = true;
      this.sale.customer = {existing:false, mobile:'', name:'', locality:'', email:''};
    }

    useMobile(){
      this.noMobileMode = false;
      this.sale.customer = {existing:false, mobile:'', name:'', locality:''};
    }

    /** who the bill is for is known: a mobile number, a customer chosen from the list, or a name with a location */
    get customerIdentified(): boolean {
      const c = this.sale.customer;
      if (!c) return false;
      if (String(c.mobile ?? '').length === 10) return true;
      return !!c.existing || (this.noMobileMode && this.noMobileReady);
    }

    /** the name and the location of a customer with no mobile number are both there */
    get noMobileReady(): boolean {
      const c = this.sale.customer;
      return !!c && String(c.name ?? '').trim().length > 2 && !!String(c.locality ?? '').trim();
    }

    customerInfoCaptured(){
      return this.sale.customer && 
      (this.sale.customer.name && this.sale.customer.name !== '') && 
      (this.sale.customer.mobile && this.sale.customer.mobile !== '');
    }

    onItemAdd(item:any){
      this.sale.items?.push(item);
      this.recalculateTotal();
    }

    onItemUpdate(item:any){
      this.sale.items?.forEach(element => {
        element = item;
      });
      this.recalculateTotal();
    }

    /** what the lines add up to (each line as shown, with its paise) */
    get linesSum(): number {
      return (this.sale.items || []).filter((i:any) => i.edited).reduce((sum:number, i:any) => sum + (+i.total || 0), 0);
    }

    /** the total is whole rupees: the difference from the lines, shown so the bill adds up */
    get roundOff(): number {
      const diff = Math.round(((+this.sale.total || 0) - this.linesSum) * 100) / 100;
      return Math.abs(diff) < 0.005 ? 0 : diff;
    }

    recalculateTotal(){
      this.total = 0;
      let mrptotal = 0;

      this.sale.items?.filter((i:any) => i.edited).forEach((i:any) => {        
          // lines are added with their paise and the sum rounded once to the nearest rupee: rounding each line first adds up to a different total
          this.total += +i.total || 0;
          mrptotal += +(i.mrpcost||0)*i.qty;
      });

      this.sale.total = Math.round(this.total);
      this.sale.mrptotal = Math.round(mrptotal);
      this.sale.totalitems = this.sale.items?.filter((i:any) => i.edited).length;
      this.sale.saving = this.prodUtilService.getSaving(mrptotal,Math.round(this.total));

      this.sale.docpending = false;
    }

    selectCustomer(customer:any, copySales:boolean){
      this.noMobileMode = false;
      // the location is left as the list gave it (not defaulted to empty): saving the bill must never blank a customer's location
      this.sale.customer = {...customer, mobile: customer.mobile ?? ''};
      this.showCustomerView = copySales; 
    }

  onItemRemoved(id:any){
    if(this.sale.items) {
      this.sale.items = [...this.sale.items].filter((i:any) => i.itemid !== id)
    }
    this.recalculateTotal();
  }

  // ------------------------------------------------------------------ pharmacy pack: the drug register
  scheduleDetail: any = {};
  scheduleRequired: string[] = [];
  /** the schedules the shop holds a bill back for until the patient and the prescriber are given; for the others they are optional */
  scheduleEnforce: string[] = [];

  /** the drugs on the bill whose schedule needs the patient and the prescriber */
  get scheduledItems(): any[] {
    if (!this.scheduleRequired.length) return [];
    return (this.sale.items || []).filter((i:any) => i.edited && this.scheduleRequired.includes(String(i.more_props?.schedule ?? '').toUpperCase()));
  }

  /** the bill cannot be completed until the register has what it needs (only when the shop holds bills back; otherwise the details can follow) */
  get scheduleMissing(): boolean {
    return (this.enforcedHere && detailProblems(this.scheduleDetail).length > 0) || this.scheduleRxMissing;
  }

  /** the prescription status is incomplete: "Other" without words, or "Will bring it later" without a day or a customer on record */
  get scheduleRxMissing(): boolean {
    if (!this.scheduledItems.length) return false;
    const hasRx = (this.documents || []).some((d:any) => String(d.category || '').toLowerCase() === 'prescription');
    return rxProblems(this.scheduleDetail, hasRx, !!(this.sale.customer?.existing && this.sale.customer?.id)).length > 0;
  }

  /** a drug on this bill is of a schedule the shop holds bills back for */
  get enforcedHere(): boolean {
    return this.scheduledItems.some((i:any) => this.scheduleEnforce.includes(String(i.more_props?.schedule ?? '').toUpperCase()));
  }

  /** a prescription was uploaded from the scheduled-drugs panel: the bill carries it like any document picked from the customer's documents */
  onPrescriptionUploaded(d:any){
    if(!this.documents.find((td:any) => td.id === d.id))
      this.documents.push({id:d.id, category:d.category, name:d.name, alias:d.alias, path:d.path, props: d.docprops ? JSON.parse(d.docprops) : []});
    this.sale.docpending = false;
  }

  /** chronic medicines on the bill (more_props.chronic is stored as true or "true") */
  get chronicItems(): any[] {
    if (!this.auth.moduleOn('refills')) return [];      // refill follow-up is a pharmacy module: without it a chronic medicine is nothing special
    return (this.sale.items || []).filter((i:any) => i.edited && String(i.more_props?.chronic) === 'true');
  }

  /** a bill with a chronic medicine needs a real customer mobile; the NIL walk-in does not count */
  get chronicMobileMissing(): boolean {
    if (!this.chronicItems.length) return false;
    if (this.sale.chronicoverride) return false;     // cashier ticked "sell without the mobile number"
    const mobile = String(this.sale.customer?.mobile ?? '').trim();
    if (mobile && mobile !== '0000000000') return false;
    const id = this.sale.customerid;
    return !id || id === +(localStorage.getItem('nil') || 0);
  }

  submitError = '';

  doesProductContains(items:any, prop:string, value:any){
    const props = items.filter((i:any) => i.more_props && i.more_props[prop] === value);
    return props && props.length > 0;
  }

  discard(){
    this.sale.id && this.service.remove(this.sale.id).subscribe(data => {
      this.service.refreshSavedSales();
      this.router.navigate([`/secure/sales/pos`]);
    });
  }

  /** the "request a product we don't have" popup */
  requestVisible = false;
  requestMessage = '';

  requestSaved(title:string){
    this.requestMessage = `Requested: ${title}. Purchasing can see it.`;
    setTimeout(() => this.requestMessage = '', 6000);
  }

  /** older-batch / short-dated warnings the server raised for this bill, waiting for the cashier's decision */
  batchWarnings:any = null;
  private ackWarnings = false;

  /** sell through the warnings (the server decides whether this person may) */
  sellAnyway(){
    this.ackWarnings = true;
    this.submit(this.sale.status);
  }

  dismissWarnings(){
    this.batchWarnings = null;
    this.ackWarnings = false;
  }

  submit(status:any){

    this.submitError = '';
    this.batchWarnings = null;
    if (status === 'COMPLETE' && this.chronicMobileMissing) {
      this.submitError = 'Enter the customer mobile number: this bill has a chronic medicine.';
      return;
    }
    const buyer = String(this.sale.buyergstin || '').trim();
    if (buyer && !isValidGstin(buyer)) {
      this.submitError = "The buyer's GSTIN is not valid. Check the 15 characters, the state code and the check digit.";
      return;
    }
    if (buyer) this.sale.buyergstin = buyer.toUpperCase();
    if (status === 'COMPLETE' && this.operatorContext.needsOperator()) {
      this.submitError = 'Choose who is serving (Staff box at the top) before completing the bill.';
      return;
    }
    this.sale.status = status;
    
    this.sale.items = this.sale.items?.map((item:any) => {
      switch (status) {
        case 'COMPLETE':
            item['status'] = 'Complete';
            break;
        case 'PENDING':
                item['status'] = 'Pending'
            break;
        default:
            break;
      }
      item['productid'] = item['product_id'];
      // for a regular medicine the units are months of medicine: recorded with the line (the server checks the batch against it)
      item['supplymonths'] = monthlyUnits(item) > 0 ? Math.min(24, Math.max(0.1, Math.round(monthsCovered(item) * 10) / 10)) : null;
      return item;
    });

    if(this.sale.status == 'COMPLETE'){
        const total = +(this.sale.total || 0);
        // store credit takes its part off the bill first; cash and digital pay the rest
        const credit = this.payment['usecredit'] ? Math.max(0, Math.min(+(this.payment['creditbalance'] || 0), total)) : 0;
        // what is left to pay later comes off next, then cash and digital pay the rest
        const due = this.dueNow(total, credit);
        const payable = total - credit - due;
        const digiamt = Math.max(0, Math.min(payable, +(this.payment.digiamt || 0)));
        const cashamt = payable - digiamt;
        this.sale['creditamt'] = this.payment['staffcredit'] ? 0 : credit;
        this.sale['dueamt'] = this.payment['staffcredit'] ? 0 : due;
        this.sale['duedate'] = due > 0 ? (this.payment['duedate'] || null) : null;

        if(this.payment['staffcredit']){
            // the whole bill on one person's credit: no cash or digital part
            this.sale['cashamt'] = 0;
            this.sale['digiamt'] = 0;
            this.sale['digimethod'] = null;
            this.sale['digirefno'] = null;
            this.sale['staffcreditamt'] = total;
            this.sale['staffcredituserid'] = this.payment['staffcredituserid'];
            this.sale['staffcreditfor'] = (this.payment['familybuying'] && String(this.payment['staffcreditfor'] || '').trim()) || null;
        } else {
            this.sale['cashamt'] = cashamt;
            this.sale['digiamt'] = digiamt;
            this.sale['digimethod'] = this.payment.digimode;
            this.sale['digirefno'] = this.payment.digirefno;
            this.sale['staffcreditamt'] = 0;
            this.sale['staffcredituserid'] = null;
            this.sale['staffcreditfor'] = null;
        }
    }

    // set before the copy below: the payload is built from the bill as it stands, so these have to be on it by then
    // (they were set after it, which sent no documents, no prescription or patient details, no serving person and no store)
    this.sale.props = {documents: this.documents, ...(this.scheduledItems.length ? {scheduledetail: this.scheduleDetail} : {})};
    this.sale['actinguserid'] = this.operatorContext.selectedOperatorId || this.sale['actinguserid'];
    this.sale['storeid'] = this.storeContext.selectedStoreId || this.sale['storeid'];

    // the payload is a copy: a failed save must leave the form's own customer in place (it used to be nulled here, which broke the form)
    const obj:any = {...this.sale};

    const keepsCustomer = !!this.sale.customer && (!!this.sale.customer.mobile || !!this.sale.customer.existing || (this.noMobileMode && this.noMobileReady));
    if(!keepsCustomer){
        obj['customer'] = null;
        if(this.sale.status == 'COMPLETE'){
          //setting default nil customer
          this.sale.customerid = +(localStorage.getItem('nil') || 0);
          obj['customerid'] = this.sale.customerid;
        }
    }
    else{
        this.sale.customer['name'] = String(this.sale.customer['name'] || '').toUpperCase();
        // at the counter a second person with a similar name in the same place is normal: the warning is pre-confirmed, as for a shared number
        obj['customer'] = {...this.sale.customer, confirmduplicate: true};
    }
    
    this.service.save({...obj, billdate:new Date(), status, checkbatches:true, ackwarnings:this.ackWarnings} as any).subscribe((data:any) => {
      this.ackWarnings = false;
      if (data.status === 'COMPLETE') this.operatorContext.afterBill();
      this.redirectAfterSubmit(data.status, data.id);
      this.service.refreshSavedSales();
    }, (err:any) => {
      this.ackWarnings = false;
      if(err?.status === 409 && err?.error?.code === 'GST_RATE_CHANGED'){
        this.applyCurrentGst(err.error.lines || []);
        this.submitError = err.error.message || "The GST rate has changed. The bill has been updated: check the total and complete it again.";
        return;
      }
      if(err?.status === 409 && err?.error?.code === 'SALE_WARNINGS'){
        this.batchWarnings = err.error;
        return;
      }
      const m = err?.error?.message;
      this.submitError = Array.isArray(m) ? m.join(' ') : (m || 'Could not save the bill.');
    });
  }

  /** the server found lines at a rate other than today's: take its rate on each, total them again, and let the person check the bill */
  applyCurrentGst(lines:{itemid:number; current:number}[]){
    lines.forEach((l) => {
      this.sale.items?.filter((i:any) => i.itemid === l.itemid).forEach((i:any) => {
        i.taxpcnt = l.current;
        i.total = this.helper.lineTotal(+i.qty, +i.price, l.current);
      });
    });
    this.recalculateTotal();
  }

  /** products on the bill whose batches still bill at different GST today: no rate change brings them together */
  get mixedGstItems(): any[] {
    return (this.sale.items || []).filter((i:any) => i.edited && i.gst_mixed);
  }

  redirectAfterSubmit(status:string,id:number){
    if(status === 'COMPLETE')
      this.router.navigateByUrl(`/secure/sales/view/${id}`); 
    else 
      this.router.navigate([`/secure/sales/pos/edit`,id]);
  }

  updateCustomer(attr:string,event:any){
    if(!this.sale.customer){
      this.sale.customer = {}
    }

    if(attr === 'email'){
      this.sale.customer.email = event.target.value
    } else if(attr === 'name'){
      this.sale.customer.name = this.capitalize(event.target.value)
    }else if(attr === 'mobile'){
      this.sale.customer.mobile = event.target.value
    }
  }

  capitalize(word:string){
      const lower = word.toLowerCase();
      return word.charAt(0).toUpperCase() + lower.slice(1);
  }

  cancel(){
    this.router.navigateByUrl(`/secure/sales`); 
  }

  paymentinfo(event:any){
    this.payment = event;
  }

  showPrevSalesCopy() {
    this.showCustomerView = true;
  }

  captureCustomerInfo(event:any){
    // with no mobile the box is only a search by name: what is typed in it is not a number
    if (this.noMobileMode) return;
    this.sale.customer = {...event, locality: ''};
  }

  onCustomerData(event:any){
    if(event['action'] == 'productsSelected'){
      const prodids = event['event'];
      const arr = this.sale.items?.map(i => {return i;});
      
      this.stockService.findByProducts(prodids).subscribe((items:any) => {      
        items.forEach((selected:any) => {
          arr?.push({...this.helper.mapStockToSaleItem(selected,true)});
        });
        this.recalculateTotal(); 
      }); 
      this.sale.items = arr;
    }
    else if(event['action'] == 'documentsSelected'){
      const docs = event['event'];
      docs.forEach((d:any) => {
        const found = this.documents.find((td:any) => td.id === d.id);
        if(!found)
          this.documents.push({id:d.id, category:d.category, name:d.name , alias:d.alias, path: d.path, props: d.docprops ? JSON.parse(d.docprops) : []});
      })
      this.sale.docpending = false;
    }

    this.showCustomerView = false;
  }

  isSaleFormValid(){
    if(this.sale.items?.length == 0 || this.sale.total == 0)
      return false;

    const mobile = String(this.sale.customer?.mobile ?? '');
    // no customer at all is the walk-in; otherwise a mobile with a name, a chosen customer, or (no mobile) a name with a location
    const customerValid = this.sale.customer && (this.noMobileMode
        ? (this.sale.customer.existing || this.noMobileReady)
        : (mobile.length == 0 || this.sale.customer.existing ||
          (mobile.length == 10 && this.sale.customer.name && this.sale.customer.name.length > 2)));

    return (this.doctypes.length == 0 || 
      (this.isDocumentProvided() || (this.customerIdentified && this.sale.docpending)))
      && customerValid && this.digitalValid() && !this.payment?.['modemissing'];
  }

  /** what is left for the customer to pay later: the whole of what store credit leaves, or the part typed (0 unless Pay later is chosen) */
  private dueNow(total:number, credit:number): number {
    if(!this.payment?.latemode || this.payment?.staffcredit) return 0;
    const rest = Math.max(0, total - credit);
    const typed:any = this.payment.dueamt;
    return typed === null || typed === undefined || typed === '' ? rest : Math.max(0, Math.min(rest, +typed || 0));
  }

  /** the provider's reference (last 4 digits of the transaction id) is optional, but if typed it must look right */
  digitalValid(){
    // the whole bill, on someone's credit; when a family member collects, who is asked for
    if(this.payment?.staffcredit) return !!this.payment.staffcredituserid && (!this.payment.familybuying || String(this.payment.staffcreditfor || '').trim().length > 2);
    const credit = this.payment?.['usecredit'] ? Math.max(0, Math.min(+(this.payment?.['creditbalance'] || 0), +(this.sale.total || 0))) : 0;
    const later = this.dueNow(+(this.sale.total || 0), credit);
    // paying later needs a customer chosen from the list and a day to pay by
    if(later > 0 && (!this.sale.customer?.existing || !this.payment.duedate)) return false;
    if(!(Math.min(+(this.payment?.digiamt || 0), +(this.sale.total || 0) - credit - later) > 0)) return true;
    const ref = String(this.payment?.digirefno || '').replace(/\s+/g, '');
    return !ref || /^[A-Za-z0-9][A-Za-z0-9\-_\/]{3,39}$/.test(ref);
  }

  removeDocument(id:number){
    const index = this.documents.findIndex((d:any) => d.id == id);     // indexOf with a function never matched, so the last document was removed instead
    if(index >= 0) this.documents.splice(index,1)
  }

  isDocumentRequiredOnSale() {
    const doctypesrequired:any[] = [];
    this.sale.items?.forEach((item:any) => {
      const props = item['more_props'];
        if(props !== null && props['document'] !== undefined && props['document'] != ''){
           doctypesrequired.push(props['document']);
        }
    });
    this.doctypes = doctypesrequired;
    return this.doctypes.length > 0;
  }

  isDocumentAvailable(documents:any,reqddocs:any[]){
    let valid = true;
    reqddocs.forEach(doctype => {
      const found = documents.find((d:any) => d['category'] == doctype);
      valid = valid && found;
    });
    return valid;
  }

  viewDoc(doc:any){
    this.docpath = doc.path;
    this.docname = doc.alias || doc.name || doc.category || '';
    this.showDocument = true;
  }

  isDocumentProvided(){
    return this.isDocumentAvailable(this.documents,this.doctypes)
  }

  /** each missing document once, however many lines need it */
  get missingDocsText(): string {
    return Array.from(new Set(this.getMisingDocs())).join(', ');
  }

  getMisingDocs(){
    const doctypespresent = this.documents.map(d => d.category);
    return this.doctypes.filter(d => !doctypespresent.includes(d));
  }
}
