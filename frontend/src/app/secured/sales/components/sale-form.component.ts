import { HttpClient } from "@angular/common/http";
import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Sale } from "../sale.model";
import { SaleService } from "../sales.service";

@Component({
    templateUrl: 'sale-form.component.html'
})
export class SaleFormComponent {

    sale:Sale = {status:'NEW',items:[]}
    
    displayPrevSalesCopy: boolean = false;
    displaySalePropsForm: boolean = false;
    salePropValues:any;

    total:number = 0;
    customers:any = []

    filteredCustomers: any[] = [];
    newCustomer:boolean = true;
    allowCustomerSelect:boolean = false;
    newSaleItem = {id:0,itemid:'',price:'',qty:''}

    previousSaleItems:any[] = []
    fetchCustomerPrevSales = true;

    salePropSchema:any[] = []
    saleprops:any[] = []
    form:FormGroup = new FormGroup({});

    constructor(private route: ActivatedRoute,
      private router: Router, 
      private service:SaleService,private http:HttpClient){
        this.http.get("/assets/sale-props.json").subscribe((data:any) => this.salePropSchema = data);
      }

    ngOnInit(){
      
      const saleId = this.route.snapshot.paramMap.get('id'); 

      if(saleId){
          this.service.find(saleId).subscribe((data:any) => {
            this.newCustomer = data.customer === null;
            this.sale.id = data.id;
            this.sale.customer = data.customer;
            this.sale.billdate = data.billdate;
            this.sale.status = data.status;
  
            this.sale.items = data.items.map((i:any) => {
              return {
                id:i.id,
                itemid:i.purchaseitem.id,
                price:i.price,
                qty:i.qty,
                title: i.purchaseitem.product.title,
                taxpcnt:i.purchaseitem.taxpcnt,
                batch:i.purchaseitem.batch,
                expdate:i.purchaseitem.expdate,
                maxqty: i.maxqty,
                more_props: i.purchaseitem.product.props,
                total: this.calculateTotal(i.qty||'',i.price||'',i.purchaseitem.taxpcnt||'')
              }
            });
  
            this.sale.items && this.sale.items.forEach(item => {
              this.total += item.total || 0;
            })          
        });        
      }
      else {
        this.allowCustomerSelect = true;
        this.sale.billdate = new Date();
      } 

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

    changeCustomer(){
      this.newCustomer = true;
    }

    addNewItem(){
      const newItemFound = this.sale.items?.find((i:any) => (i.itemid == 0 || i.itemid == ''));
      !newItemFound && this.sale.items?.push({...this.newSaleItem, id:Math.round((Math.random()*1000))});  
    }

    calculateTotal(qty:string,price:string,tax:string):number{
      const total = +qty * ((+price||0) * (1 + ((+tax||0) / 100)));
      return isNaN(total) ? 0 : +total.toFixed(2);
    }

    recalculateTotal(event:any){
      this.total = 0;
      this.sale.items?.forEach((i:any) => {
        if(i.itemid != '')
        this.total += i.total;
      });
      this.addNewItem();
    }

    selectCustomer(customer:any){
      const {id,name,mobile,email,address} = customer;
      if(customer.existing){
        this.sale.customer = {id,name,mobile,email,address};

        this.newCustomer = false;
        this.showPrevSalesCopy();
      }
      else {
        this.sale.customer = {mobile,name:''};
        this.newCustomer = true;
      }
      this.fetchCustomerPrevSales = true;
    }

    completeAllowed(){
    return this.total > 0 && (this.sale.paymode != undefined && this.sale.paymode != '');
  }
  
  removeItem(id:any){
    if(this.sale.items) {
      this.sale.items = [...this.sale.items].filter((i:any) => i.id !== id)
    }
  }

  submit(status:any){
    if(status === 'DISCARD'){
      this.sale.id && this.service.remove(this.sale.id).subscribe(data => {
        this.router.navigateByUrl(`/secure/sales`); 
      })
      return;
    }
    const validItems = this.sale.items && this.sale.items.filter((i:any) => (i.itemid !== '' && i.qty !== ''));
    
    const requireAdditionalProps = validItems?.filter((i:any) => i.more_props.schedule === 'H1');
    if(status === 'COMPLETE' && !this.salePropValues){
      if(requireAdditionalProps && requireAdditionalProps.length > 0){
        this.populateSalePropsForm('H1',null);
        this.displaySalePropsForm = true;
        return;
      }
    }

    let total = 0;
    validItems && validItems.forEach((i:any) => {
      total += i.total;
      i.id = null;
    });    
    // console.log('validitems: ',validItems);

    
    this.service.save({...this.sale, total, status, props: this.salePropValues,items:validItems}).subscribe((data:any) => {
      this.salePropValues = null;
      if(data.status === 'COMPLETE')
        this.router.navigateByUrl(`/secure/sales/view/${data.id}`); 
      else 
        this.router.navigateByUrl(`/secure/sales/edit/${data.id}`); 

    });
  }

  updateName(event:any){
    this.sale.customer.name = event.target.value
  }
  
  updateEmail(event:any){
    this.sale.customer.email = event.target.value
  }

  updateAddr(event:any){
    this.sale.customer.address = event.target.value
  }

  cancel(){
    this.router.navigateByUrl(`/secure/sales`); 
  }

  showPrevSalesCopy() {

    const addedItemsToSale = this.sale.items?.map((i:any) => i.itemid)
    
    this.fetchCustomerPrevSales && this.service.getSalesByCustomer(this.sale.customer.id).subscribe((prevSale:any) => {
      
      if(!prevSale.status) {
        this.previousSaleItems = [];

        prevSale.forEach((ps:any) => {
          const items = ps.items.map((i:any) => {
            return {
              id:i.id,
              itemid:i.purchaseitem.id,
              taxpcnt: i.purchaseitem.taxpcnt,
              price: i.purchaseitem.saleprice,
              selected:addedItemsToSale?.includes(i.purchaseitem.id),
              maxqty:i.maxqty,
              qty:i.qty,
              title:i.purchaseitem.product.title,
              more_props:i.purchaseitem.product.props,
              batch:i.purchaseitem.batch,
              expdate:i.purchaseitem.expdate};
          });

          this.previousSaleItems.push({billdate:ps.billdate,total:ps.total,items});
          // this.fetchCustomerPrevSales = false;
        });
      }
    });
    
    this.displayPrevSalesCopy = true;
  }

  copyCustomerInfo(event:any) {  
    this.form.controls['props'].get('ptntname')?.setValue(event.target.checked ? this.sale.customer.name : '');
    this.form.controls['props'].get('ptntmobile')?.setValue(event.target.checked ? this.sale.customer.mobile : '');
    this.form.controls['props'].get('ptntaddr')?.setValue(event.target.checked ? this.sale.customer.address : '');
  }

  selectItem(itemid:any,event:any){
    this.previousSaleItems.forEach(s => {
      s.items.forEach((i:any) => {
        if(i.id === itemid){
          i['selected'] = event.target.checked;
        }
      })
    })
  }

  onSubmitSaleProps(){
    this.displaySalePropsForm = false;
    this.salePropValues = this.form.controls['props'].value;
    this.submit('COMPLETE');
  }

  copySelectedItem(){
    const arr:any[] = [];
     this.previousSaleItems.forEach(s => {
      s.items.forEach((i:any) => {
        i.selected && arr.push(i)
      })
     })

    this.sale.items = arr;
    this.addNewItem()
    this.displayPrevSalesCopy = false;
  }

  closeChangeCustomer(){
    this.newCustomer = false;
  }
}