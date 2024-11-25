import { Component, Input, SimpleChanges } from "@angular/core";

import { CustomersService } from "../customers.service";

@Component({
    selector: 'app-customer-documents',
    templateUrl: './customer-documents.component.html'
})
export class CustomerDocumentsComponent {

    @Input() customer:any;

    documents:any = [];

    constructor(private service:CustomersService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.customer.currentValue){
           this.fetchDocuments(changes.customer.currentValue.id);
        }
    }

    fetchDocuments(customerId:number){
        this.service.findAllDocuments(customerId).subscribe((data:any) => {
            this.documents = data;
        });
    }

    onUpload(event:any){
        console.log('document uploaded, to be associated with customer and additional props',event);
        this.service.addDocument(this.customer.id, event.id).subscribe(data => {
            console.log('document added to customer',data);
            this.fetchDocuments(this.customer.id);
        });
    }
}