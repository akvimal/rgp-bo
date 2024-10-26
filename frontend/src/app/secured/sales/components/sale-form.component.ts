import { HttpClient } from "@angular/common/http";
import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { slideOutDownAnimation } from "angular-animations";
import { ProductUtilService } from "../../product-util.service";
import { Sale } from "../sale.model";
import { SaleService } from "../sales.service";

@Component({
    templateUrl: 'sale-form.component.html'
})
export class SaleFormComponent {

    sale:Sale = {status:'NEW',items:[]}
    
    displayPrevSalesCopy: boolean = false;
    displaySalePropsForm: boolean = false;
    displayNewCustomer:boolean = false;
    customerEditOnly:boolean = false;
    salePropValues:any;

    total:number = 0;
    customers:any = []
    offer:{code?:string,amount?:number} = {};

    filteredCustomers: any[] = [];
    //newCustomer:boolean = true;
    saleWithNoCustomerAllowed:boolean = false;
    allowCustomerSelect:boolean = false;
    newSaleItem = {id:0,itemid:0,price:0,qty:0,qtyready:false}

    prevCustSales:Sale[] = []
    fetchCustomerPrevSales = true;

    salePropSchema:any[] = []
    saleprops:any[] = []
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
      private service: SaleService,
      private prodUtilService: ProductUtilService,
      private http: HttpClient){
        this.http.get("/assets/sale-props.json").subscribe((data:any) => this.salePropSchema = data);
      }

    ngOnInit(){
      const saleId = this.route.snapshot.paramMap.get('id'); 
      if(saleId){
          this.service.find(saleId).subscribe((data:any) => {
            this.sale.id = data.id;
            this.sale.expreturndays = data.expreturndays;
            this.sale.customer = data.customer;
            this.sale.billdate = data.billdate;
            this.sale.status = data.status;
  
            this.sale.items = data.items.map((i:any) => {
              // const pack = i.purchaseitem.product.pack;
              const avail_qty = +i.bought - +i.sold;
              return {
                id:i.id,
                // itemid:i.purchaseitem.id,
                price:i.price,
                qty:i.qty,
                box: Math.trunc(i.qty / i.pack),
                boxbal: i.qty % i.pack,
                balqty: Math.trunc(i.qty/i.pack) + '.' + (i.qty%i.pack),
                unitsbal:avail_qty-i.qty,
                pack:i.pack,
                mrp_cost: i.mrp_cost/i.pack,
                title: i.title,
                taxpcnt:i.tax_pcnt,
                batch:i.batch,
                expdate:i.exp_date,
                maxqty: avail_qty,
                // more_props: i.purchaseitem.product.props,
                total: this.calculateTotal(i.qty,i.price,i.tax_pcnt)
              }
            });
  
            this.sale.items && this.sale.items.forEach(item => {
              this.total += item.total || 0;
            });
            
        });        
      }
      else {
        this.allowCustomerSelect = true;
        this.sale.billdate = new Date();
      } 
    }

    resetCustomer(){
      this.sale.customer = null;
    }

    isSaleWithNoCustomerAllowed(){
      return this.saleWithNoCustomerAllowed;
    }

    isNewCustomer() {
      if(this.sale.customer && 
        (this.sale.customer.name && this.sale.customer.name !== '') && 
        (this.sale.customer.mobile && this.sale.customer.mobile !== '')){
        return false;
      }
      return true;
    }

    populateSalePropsForm(type:any,values:any){
      const typeConfig = this.salePropSchema.find((d:any) => d.category === type);
      if(typeConfig && typeConfig.props){
        let pps = {};
        const props = typeConfig.props;
        this.saleprops = props;
        for(let i=0;i<props.length;i++){
          const pname = props[i].id;
          const value = values ? values[pname] : props[i].default;
          const fc = new FormControl(value);
          if(props[i].required) {
            fc.setValidators(Validators.required);
          }
          pps = {...pps, [pname]:fc}
        }
        this.form.setControl('props', new FormGroup(pps));
      }
    }

    showChangeCustomer(mode:string){
      this.customerEditOnly = true;
      this.displayNewCustomer = true;
    }

    addNewItem(){
      const newItemFound = this.sale.items?.find((i:any) => (i.itemid == 0 || i.itemid == ''));
      !newItemFound && this.sale.items?.push({...this.newSaleItem, id: Math.random()});  
    }

    calculateTotal(qty:number,price:number,tax:number) {
      const total = qty * (price * (1 + (tax / 100)));
      return isNaN(total) ? 0 : +total.toFixed(2);
    }

    recalculateTotal(offer:any){
      this.total = 0;
      let mrptotal = 0;
      this.sale.items?.forEach((i:any) => {        
        if(i.itemid > 0) {
          this.total += i.total;
          const qty = (i.box * i.pack) + i.boxbal;
          mrptotal += ((+i.mrp_cost||0)*qty)
        }
      });

      this.sale.total = this.total;
      this.sale.mrptotal = mrptotal;
      
      this.sale.saving = this.prodUtilService.getSaving(mrptotal,Math.round(this.total));
  
      this.offer = offer;
      this.addNewItem();
    }

    selectCustomer(customer:any, copySales:boolean){
      const {id,name,mobile,email,address} = customer;
      if(customer.existing){
        this.sale.customer = {id,name,mobile,email,address};
        !mobile.startsWith('000') && this.showPrevSalesCopy();
      }
      else {
        this.sale.customer = {mobile,name:''};
      }
      this.fetchCustomerPrevSales = copySales;
    }
  
  doneEnterCustomer(event:any){
    const inputval = event.target.value;
    if(inputval.length > 0){
      if(inputval.length !== 10) {
        event.target.value = inputval.substring(0,10)
        event.target.focus();
      }
    } 
    
    this.sale.customer = {mobile:inputval};
  }

  removeItem(id:any){
    if(this.sale.items) {
      this.sale.items = [...this.sale.items].filter((i:any) => i.id !== id)
    }
  }

  doesProductContains(items:any, prop:string, value:any){
    const props = items.filter((i:any) => i.more_props[prop] === value);
    return props && props.length > 0;
  }

  submit(status:any){

    if(status === 'DISCARD'){
      this.sale.id && this.service.remove(this.sale.id).subscribe(data => {
        this.router.navigateByUrl(`/secure/sales`); 
      })
      return;
    }
    
    //all items should have total greater than zero
    const validItems = this.sale.items && this.sale.items.filter((i:any) => (i.itemid !== '' && ((i.box * i.pack) + i.boxbal) > 0));
    
    // const requireAdditionalProps = validItems?.filter((i:any) => i.more_props.schedule === 'H1');
    if(status === 'COMPLETE' && !this.salePropValues){
      if(this.doesProductContains(validItems, 'schedule', 'H1')){
        this.populateSalePropsForm('H1',null);
        this.displaySalePropsForm = true;
        return;
      }
      if(this.doesProductContains(validItems, 'chronic', true) && 
      (!this.saleWithNoCustomerAllowed && this.isNewCustomer())){
        this.displayNewCustomer = true;
        return;
      }
    }
    
    let total = 0;
    validItems && validItems.forEach((i:any) => {
      total += i.total;
      i.status = 'Sale Complete';
      i.id = null;
    });

    let discamt  = this.offer.amount||0;
    if(this.offer){
      const newTotal = total - discamt;
      if(newTotal < 0){
        discamt = total;
        total = 0;
      }
      else 
        total = newTotal;
    }
    
    // if(!this.isSaleWithNoCustomerAllowed() && this.isNewCustomer()){
    //   this.displayNewCustomer = true;
    //   this.customerEditOnly = false;
    //   if(status === 'PENDING'){
    //     this.customerEditOnly = true;
    //   }
    //   return;
    // }

    this.service.save({...this.sale, total:Math.round(total), disccode:(this.offer?.code), discamount:discamt, status, props: this.salePropValues,items:validItems}).subscribe((data:any) => {
      this.salePropValues = null;
      if(data.status === 'COMPLETE')
        this.router.navigateByUrl(`/secure/sales/view/${data.id}`); 
      else 
        this.router.navigateByUrl(`/secure/sales/edit/${data.id}`); 

    });
  }

  updateCustomer(attr:string,event:any){
    if(!this.sale.customer){
      this.sale.customer = {}
    }

    if(attr === 'srctype'){
      this.sale.customer.srctype = event.target.value;
    } else if(attr === 'srcdesc'){
      this.sale.customer.srcdesc = event.target.value;
    } else if(attr === 'address'){
      this.sale.customer.address = event.target.value
    } else if(attr === 'area'){
      this.sale.customer.area = event.target.value
    } else if(attr === 'locality'){
      this.sale.customer.locality = event.target.value
    } else if(attr === 'email'){
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

  noCustomerSale() {
    
    this.saleWithNoCustomerAllowed = true;
      this.submit('COMPLETE');
    
    
    this.displayNewCustomer = false;
  }

  showPrevSalesCopy() {

    const addedItemsToSale = this.sale.items?.map((i:any) => i.itemid)
    
    this.fetchCustomerPrevSales && this.service.getSalesByCustomer(this.sale.customer.id).subscribe((prevSale:any) => {
      if(prevSale.length > 0) {
        // if(!prevSale.status) {
          this.prevCustSales = [];

        prevSale.forEach((ps:any) => {
          const items = ps.items.map((i:any) => {

            const box = Math.trunc(i.qty / i.purchaseitem.product.pack);
            const boxbal = i.qty % i.purchaseitem.product.pack;
            
            let totalbalqty = i.maxqty - i.qty;
            let balqty = Math.trunc(totalbalqty / i.purchaseitem.product.pack) + '.' + (totalbalqty % i.purchaseitem.product.pack);

            if(totalbalqty < 0) {
              balqty = '0';
            }

            return {
              id:i.id,
              itemid:i.purchaseitem.id,
              taxpcnt: i.purchaseitem.taxpcnt,
              price: (i.purchaseitem.saleprice/i.purchaseitem.product.pack),
              selected:addedItemsToSale?.includes(i.purchaseitem.id),
              maxqty:i.maxqty,
              qty:i.qty,
              pack:i.purchaseitem.product.pack,
              box,
              boxbal,
              balqty,
              mrp_cost:(i.purchaseitem.mrpcost/i.purchaseitem.product.pack),
              title:i.purchaseitem.product.title,
              more_props:i.purchaseitem.product.props,
              batch:i.purchaseitem.batch,
              expdate:i.purchaseitem.expdate};
          });

          this.prevCustSales.push({billdate:ps.billdate,total:ps.total,items});
        });

        this.displayPrevSalesCopy = true;
      }
    });
    
  }

  copyCustomerInfo(event:any) {  
    this.form.controls['props'].get('ptntname')?.setValue(event.target.checked ? this.sale.customer.name : '');
    this.form.controls['props'].get('ptntmobile')?.setValue(event.target.checked ? this.sale.customer.mobile : '');
    this.form.controls['props'].get('ptntaddr')?.setValue(event.target.checked ? this.sale.customer.address : '');
  }

  selectItem(itemid:any,event:any){
    this.prevCustSales.forEach((s:Sale) => {
      s.items && s.items.forEach((i:any) => {
        if(i.id === itemid){
          i['selected'] = event.target.checked;
        }
      })
    })
  }

  copyItemSelected(){
    return this.prevCustSales.filter((s:Sale) => {
      return s.items && s.items.filter((i:any) => i.selected).length > 0
    }).length > 0
  }

  onSubmitSaleProps(){
    this.displaySalePropsForm = false;
    this.salePropValues = this.form.controls['props'].value;
    this.submit('COMPLETE');
  }

  copySelectedItem(){
    const arr:any[] = [];
     this.prevCustSales.forEach((s:Sale) => {
      s.items && s.items.forEach((i:any) => {
        i.selected && arr.push(i);
      })
     });
    this.sale.items = arr;
    this.addNewItem();
    this.displayPrevSalesCopy = false;
  }

  toggleAll(event:any){
    this.prevCustSales[0].items?.forEach(i => {
      i.selected = event.target.checked
    });
  }

}