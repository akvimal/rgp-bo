import { Component } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ProductUtilService } from "../../product-util.service";
import { StockService } from "../../store/stock/stock.service";
import { SaleHelper } from "../sale.helper";
import { Sale } from "../models/sale.model";
import { SaleService } from "../sales.service";
import { CustomersService } from "../../customers/customers.service";

@Component({
    templateUrl: 'sale-form.component.html'
})
export class SaleFormComponent {

    customer = {existing:false,mobile:'',name:''}
    sale:Sale = {status:'NEW',items:[],digimethod:'PayTM'}
    
    showDocument = false;
    docpath = '';
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
      private prodUtilService: ProductUtilService){}

    ngOnInit(){
      
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
              return {...element, edited:true, title: element.product_title, 
                taxpcnt: element.product_taxpcnt,
                mrpcost: (element.mrp/element.product_pack),
                expdate: element.product_expdate,
                unitsbal: element.available - element.product_pack,
                itemid: element.purchase_itemid
              }
            });
        
            if(result['props'])
              this.documents = result['props']['documents'];

            this.sale = result;

            if(this.sale.customer)
              this.sale.customer = {...this.sale.customer, existing:true};
            else
              this.sale.customer = this.customer;

            this.payment['cashamt'] = this.sale['cashamt'];
            this.payment['digimode'] = this.sale['digimethod'];
            this.payment['digiamt'] = this.sale['digiamt'];
            this.payment['digirefno'] = this.sale['digirefno'];
            this.sale['docpending'] = result['docpending'];
            // console.log(this.sale['docpending']);
            this.recalculateTotal()
          });
        });
      });
    }

    saveCustomer(){
      this.customerService.save({name:this.sale.customer.name,
        mobile:this.sale.customer.mobile,
        email:this.sale.customer.email}).subscribe(data => {
          // console.log('customer saved',data);
          this.sale.customer = {...data, existing: true};
        });
    }

    resetCustomer(){
      this.sale.customer['existing'] = false;
      this.sale.customer['mobile'] = '';
      this.sale.customer['name'] = '';
      this.sale.customer['email'] = '';
    }

    customerInfoCaptured(){
      return this.sale.customer && 
      (this.sale.customer.name && this.sale.customer.name !== '') && 
      (this.sale.customer.mobile && this.sale.customer.mobile !== '');
    }

    onItemAdd(item:any){
      this.sale.items?.push(item);
      // console.log('item added ...',item);
      
      this.recalculateTotal();
    }

    onItemUpdate(item:any){
      this.sale.items?.forEach(element => {
        element = item;
      });
      this.recalculateTotal();
    }

    recalculateTotal(){
      this.total = 0;
      let mrptotal = 0;

      this.sale.items?.filter((i:any) => i.edited).forEach((i:any) => {        
          this.total += Math.round(+i.total);
          mrptotal += +(i.mrpcost||0)*i.qty;
      });

      this.sale.total = Math.round(this.total);
      this.sale.mrptotal = Math.round(mrptotal);
      this.sale.totalitems = this.sale.items?.filter((i:any) => i.edited).length;
      this.sale.saving = this.prodUtilService.getSaving(mrptotal,Math.round(this.total));

      this.sale.docpending = false;
    }

    selectCustomer(customer:any, copySales:boolean){
      this.sale.customer = customer;
      this.showCustomerView = copySales; 
    }

  onItemRemoved(id:any){
    if(this.sale.items) {
      this.sale.items = [...this.sale.items].filter((i:any) => i.itemid !== id)
    }
    this.recalculateTotal();
  }

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

  submit(status:any){

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
      return item;
    });

    if(this.sale.status == 'COMPLETE'){
        this.sale['cashamt'] = this.payment.cashamt;
        this.sale['digiamt'] = this.payment.digiamt;
        this.sale['digimethod'] = this.payment.digimode;
        this.sale['digirefno'] = this.payment.digirefno;
    }

    const obj = this.sale;
    if(this.sale.customer.mobile === '')
    obj['customer'] = null;
    
    this.sale.props = {documents: this.documents};

    this.service.save({...obj, billdate:new Date(), status}).subscribe((data:any) => {
      this.redirectAfterSubmit(data.status, data.id);
      this.service.refreshSavedSales();
    });
  }

  redirectAfterSubmit(status:string,id:number){
    // console.log(status);
    
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
    this.sale.customer = event;
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
      // console.log(docs);
      
      docs.forEach((d:any) => {
        const found = this.documents.find((td:any) => td.id === d.id);
        if(!found)
          this.documents.push({id:d.id, category:d.category, name:d.name , alias:d.alias, path: d.path, props: JSON.parse(d.docprops)});
      })
      this.sale.docpending = false;
    }

    this.showCustomerView = false;
  }

  isSaleFormValid(){
    if(this.sale.items?.length == 0 || this.sale.total == 0)
      return false;

    const customerValid = this.sale.customer && (this.sale.customer.mobile.length == 0 || 
        (this.sale.customer.mobile.length == 10 && this.sale.customer.name && this.sale.customer.name.length > 2));

    return (this.doctypes.length == 0 || 
      (this.isDocumentProvided() || (this.sale.customer.mobile.length == 10 && this.sale.docpending)))
      && customerValid;
  }

  removeDocument(id:number){
    const index = this.documents.indexOf((d:any) => d.id == id);
    this.documents.splice(index,1)
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
    this.showDocument = true;
  }

  isDocumentProvided(){
    return this.isDocumentAvailable(this.documents,this.doctypes)
  }

  getMisingDocs(){
    const doctypespresent = this.documents.map(d => d.category);
    return this.doctypes.filter(d => !doctypespresent.includes(d));
  }
}