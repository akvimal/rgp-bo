import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CustomersService } from "../../../customers/customers.service";

@Component({
    selector: 'app-customer-select',
    template: `
    <p-autoComplete [(ngModel)]="customer" [showEmptyMessage]="true" 
                (onSelect)="selected($event)"
                field="''" placeholder="Name or Mobile"
                [disabled]="disabled"
                [maxlength]="10"
                [suggestions]="filteredCustomer" 
                [inputStyle]="{'background-color':'#9df'}"
                (completeMethod)="filterCustomer($event)" [minLength]="2">
                <ng-template let-customer pTemplate="item">
                    <div>{{customer.name}} - {{customer.mobile}}</div>
                </ng-template>
    </p-autoComplete>            
    `
})
export class CustomerSelectComponent {

    @Output() customerSelected = new EventEmitter();
    @Output() focusLeave = new EventEmitter();
    @Input() disabled:boolean = false;

    customer:any;
    items:any = [];
    
    filteredCustomer: any[] = [];

    constructor(private customerService:CustomersService){}
    
    selected(event:any){
        this.customerSelected.emit({
            existing:true,
            id:event.id,
            name:event.name,
            mobile:event.mobile,
            email:event.email,
            address:event.address});
    }

    filterCustomer(event:any) {
        let query = event.query;
        let criteria = {condition:'any', criteria:[
            {property:'name',check:'startswith',value:query},
            {property:'mobile',check:'startswith',value:query}]}
        this.customerService.findByCriteria(criteria).subscribe((data:any) => this.filteredCustomer = data);
    }

}