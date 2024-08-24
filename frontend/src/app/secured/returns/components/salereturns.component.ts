import { Component } from "@angular/core";
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from "@angular/forms";

import { SaleReturnService } from "../salereturns.service";
import { SaleReturnItem } from "./salereturnitem.model";

@Component({
    selector: 'app2-salereturns',
    templateUrl: 'salereturns.component.html'
})
export class SaleReturnsComponent {

    displayNewReturn:boolean = false;
    displayUpdateReturn:boolean = false;
    displayRemoveReturn:boolean = false;
    comments:string = '';

    items:SaleReturnItem[] = [];
        
    customer:any = {id:0,name:''};
    saleitem:any = {id:0,title:''};
    returnitem:any;

    filteredCustomerList: any[] = [];
    filteredCustomerItemList: any[] = [];

    form:FormGroup = new FormGroup({
        saleitemid: new FormControl('',Validators.required),
        reason: new FormControl('Defect at Source',Validators.required),
        allowqty: new FormControl(''),
        qty: new FormControl('',[Validators.required,returnQtyExceedASoldQty()]),
        comments: new FormControl('',Validators.required),
        amount: new FormControl(''),
        paymode: new FormControl('Credit')
    });

    constructor(private service:SaleReturnService){}

    ngOnInit(){
        this.fetchReturns();
    }

    customerSelected(event:any){
        this.customer = event;
    }

    productSelected(event:any){
        this.saleitem = event;
        this.form.controls['saleitemid'].setValue(this.saleitem.saleitem_id);
        this.form.controls['allowqty'].setValue(this.saleitem.allow_qty);
    }

    searchCustomers(event:any){
        const input = event.query;
        this.service.getCustomers({starts:input})
            .subscribe((data:any) => {
                this.filteredCustomerList = data;
                this.saleitem = {id:0,title:''};
            });
    }

    searchCustomerItems(event:any){
        const input = event.query;
        this.service.getProducts({customerid:this.customer.id,starts:input})
            .subscribe((data:any) => this.filteredCustomerItemList = data);
    }

    showAddForm(){
        this.displayNewReturn = true;
        this.customer = {}
        this.saleitem = {}
    }

    fetchReturns(){
        this.service.findAll({}).subscribe((data:any) => {
            this.items = data.map((d:any) => {
                return {...d, qty: (-1*d.qty), amount: (-1 * d.price * d.qty).toFixed(2)}
            })
        });
    }

    onSubmitReturnItem(){
        const si = this.form.value;
        this.service.save({...si, status: 'Return New'}).subscribe(data => {
            this.displayNewReturn = false;
            this.form.reset();
            this.fetchReturns();
        })
    }

    calculate(event:any){
        const total = event.target.value * this.saleitem.price;
        this.form.controls['amount'].setValue(total.toFixed(2));
    }

    showProcessInput(id:number){
        this.service.find(id).subscribe(data => {
            this.returnitem = data;
        });
        this.displayUpdateReturn = true;
    }

    showDeleteConfirm(id:number) {
        this.service.find(id).subscribe(data => this.returnitem = data);
        this.displayRemoveReturn = true;
    }

    confirmDelete(){
        this.service.remove(this.returnitem.id);
    }

    processReturn(action:string){     
        //TBD - to better way to store and render multiple comments   
        const moreComments = this.returnitem.comments + '\n\n >>>\n' + this.comments;
        // const adjustStock = action === 'adjust';

        this.service.update(this.returnitem.id, {
            status: action === 'discard' ?  'Discarded' : 'Return Accepted', 
            comments: moreComments}).subscribe(data => {
                // console.log('is adjust:',adjustStock);
                
                // console.log('data: ',data);
                
            // if(adjustStock){
            //     this.stockService.updateQty({
            //         itemid:this.returnitem.purchaseitem.id,
            //         qty:(-1*this.returnitem.qty), 
            //         reason:this.returnitem.reason,
            //         comments: moreComments + '\n' + 'Sale Return (ID: '+this.returnitem.id+')'}).subscribe(data => {
            //             console.log('saved');
                        
            //         });
            // }

            this.displayUpdateReturn = false;
            this.fetchReturns();
        })

    }
}

export function returnQtyExceedASoldQty(): ValidatorFn {
    return (control:AbstractControl) : ValidationErrors | null => {
        const value = control.value;
        if (!value) {
            return null;
        }
        const form = control.parent || null;
        const exceeded = value > +(form?.get('allowqty')?.value);

        return exceeded ? {returnExceed:true}: null;
    }
}