import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CustomersService } from "../../../customers/customers.service";

@Component({
    selector: 'app-customer-select',
    template: `
    <p-autoComplete [(ngModel)]="customer" [showEmptyMessage]="true" 
                (onSelect)="selected($event)"
                (onBlur)="focusOut($event)"
                field="mobile" placeholder="Mobile"
                [disabled]="disabled"
                [suggestions]="filteredCustomer" 
                (completeMethod)="filterCustomer($event)" [minLength]="3">
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

    ngOnInit(){
        this.customerService.findAllApi().subscribe(data => this.items = data);
    }

    focusOut(event:any){
        this.focusLeave.emit(event);
    }
    
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
        this.filteredCustomer = this.items && this.items.filter((c:any) => 
            (c.name && c.name.toLowerCase().indexOf(query.toLowerCase()) == 0) ||
            (c.mobile && c.mobile.indexOf(query.toLowerCase()) == 0));
        this.customerSelected.emit({existing:false,mobile:query});
    }

}