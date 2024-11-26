import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Customer } from "../customer.model";
import { CustomersService } from "../customers.service";

@Component({
    selector: 'app-customer-view',
    templateUrl: 'customer-view.component.html'
})
export class CustomerViewComponent {

    @Input() id:number = 0;
    @Output() selected:EventEmitter<any> = new EventEmitter();

    customer:any;
    
    constructor(private service:CustomersService){}

    ngOnInit(){
        this.service.find(this.id).subscribe(data => this.customer = data);
    }

    productsSelected(event:any){
        this.selected.emit({action:'productsSelected', event})
    }

    documentsSelected(event:any){
        console.log('event receved',event);
        
        this.selected.emit({action:'documentsSelected', event})
    }

}