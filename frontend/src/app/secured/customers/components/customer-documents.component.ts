import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";

import { CustomersService } from "../customers.service";

@Component({
    selector: 'app-customer-documents',
    templateUrl: './customer-documents.component.html'
})
export class CustomerDocumentsComponent {

    @Input() customer:any;
    @Output() selected:EventEmitter<any> = new EventEmitter();

    ids = [];
    loading = true;
    copyProps:any;

    constructor(private service:CustomersService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.customer && changes.customer.currentValue){
            const customer = changes.customer.currentValue;
            this.fetchDocuments(customer.id);
            this.copyProps = {ptntname:customer['name'],ptntmobile:customer['mobile']}
        }
    }

    fetchDocuments(customerId:number){
        this.loading = true;
        this.service.findAllDocuments(customerId).subscribe((data:any) => {
            this.ids = data.map((d:any) => d.id);
            this.loading = false;
        }, () => { this.loading = false; });
    }

    onUpload(event:any){
        const cdoc = {customerId:this.customer.id,documentId:event.id}
        this.service.addDocument(cdoc).subscribe(data => {
            this.fetchDocuments(this.customer.id);
        });
    }

    removedSelectedItem(event:any){
        this.service.removeDocuments(this.customer.id, event).subscribe(() => this.fetchDocuments(this.customer.id));
    }

    copySelectedItem(event:any){       
        this.selected.emit(event);
    }
}