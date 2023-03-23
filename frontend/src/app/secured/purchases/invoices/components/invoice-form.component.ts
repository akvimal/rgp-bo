import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { VendorsService } from "../../../vendors/vendors.service";
import { Invoice } from "../invoice.model";
import { InvoiceService } from "../invoices.service";
import { ProductsService } from "../../../products/products.service";

@Component({
    templateUrl: './invoice-form.component.html'
})
export class InvoiceFormComponent {

    invoice:Invoice = {}
    vendors:any = [];
    products:any = [];
    total:number = 0;
    currentDate = new Date();

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        vendorid: new FormControl('',Validators.required),
        invoiceno: new FormControl('',Validators.required),
        invoicedate: new FormControl(this.getCurrentDateStr(),Validators.required),
        purchaseorderid: new FormControl(''),
        grn: new FormControl('')
      });

    constructor(
      private route: ActivatedRoute,
      private router: Router, 
      private service:InvoiceService,
      private vendorService:VendorsService,
      private prodService:ProductsService){}

    ngOnInit(){
      const id = this.route.snapshot.paramMap.get('id');

      id && this.service.find(id).subscribe((data:any) => {
        this.invoice = data;
        this.invoice.items = data.items.map( (i:any) => {return {...i,selected:false}});

        this.form.controls['id'].setValue(data.id);
        this.form.controls['vendorid'].setValue(data.vendorid);
        this.form.controls['invoiceno'].setValue(data.invoiceno);
        this.form.controls['invoicedate'].setValue(data.invoicedate);
        
        this.form.controls['purchaseorderid'].setValue(data.purchaseorderid);
        this.form.controls['grn'].setValue(data.grn);

        this.invoice.items && this.invoice.items.push({status:'NEW'});

        if(this.invoice.items){
          this.invoice.items.forEach(item => {
            this.total += +this.calculateTotal(item.qty, item.ptrcost, item.taxpcnt);
          })
        }
        
      });

      this.vendorService.findAll().subscribe(data => this.vendors = data);
      this.prodService.findAll(null).subscribe(data => this.products = data);
    }

    getCurrentDateStr(){
      const dt = new Date();
      const mon = dt.getMonth()+1;
      const date = dt.getDate();
      const str = dt.getFullYear()+'-'+(mon < 10 ? '0'+mon : ''+mon)+'-'+(date < 10 ? '0'+date : date);
      return str;
    }

    calculateTotal(qty?:number,price?:number,tax?:number){
      const total = (qty||0) * ((price||0) * (1 + ((tax||0) / 100)));
      return isNaN(total) ? 0 : Math.round(total);
    }

    saveInvoiceItem(item:any){
      const newItem = this.invoice.items?.find(i => i.prodid === null)
      !newItem && this.invoice.items?.push({status:'NEW'});
    }

    submit(){      
      const obj = { 
        invoiceno: this.form.value.invoiceno.toUpperCase(), 
        invoicedate: this.form.value.invoicedate,
        vendorid: this.form.value.vendorid,
        purchaseorderid: this.form.value.purchaseorderid,
        grn: this.form.value.grn }
        
      const id = this.form.value.id;
      if(id)
        this.service.save({id, ...obj}).subscribe(data => this.gotoEdit(id));
      else
        this.service.save(obj).subscribe((data:any) => {
          if(!(data.status && data.status === 'ERROR')) {
            this.gotoEdit(data.id);
          }
        });
    }

    verify(){
      const s = this.invoice.items?.filter((i:any) => i.selected);
      const idsSelected = s?.map(i => {return i.id});

      this.service.updateItems(idsSelected, {status:'Verified'}).subscribe(data => {
        this.service.find(this.invoice.id).subscribe(data => this.invoice = data)
      });
    }

    delete(){
      const s = this.invoice.items?.filter((i:any) => i.selected);
      const idsSelected = s?.map(i => {return i.id});

      this.service.removeItems(idsSelected).subscribe(data => {
        this.invoice.items = this.invoice.items?.filter(i => !idsSelected?.includes(i.id) )  
      });
    }

    reset(){
      this.form.reset();
    }
    
    gotoList() {
      this.router.navigate(['/secure/purchases'],{relativeTo:this.route})
    }
    gotoEdit(id:any){
      this.router.navigate([`/secure/purchases/items/${id}`])
    }
}