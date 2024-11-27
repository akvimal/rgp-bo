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

    constructor(private service:CustomersService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.customer.currentValue){
           this.fetchDocuments(changes.customer.currentValue.id);
        }
    }

    fetchDocuments(customerId:number){
        this.service.findAllDocuments(customerId).subscribe((data:any) => {
            // this.documents = data;
            // this.document = data.length > 0 ? data[0] : null;
            console.log(data);
            
            this.ids = data.map((d:any) => d.id)
        });
    }

    onUpload(event:any){
        console.log('on upload',event);
        
        // const alias = this.alias.length == 0 ? event.name.substring(0,event.name.indexOf('.')) : this.alias;
        const cdoc = {customerId:this.customer.id,documentId:event.id}
        this.service.addDocument(cdoc).subscribe(data => {
            // this.reset = true;
            this.fetchDocuments(this.customer.id);
        });
    }

    removedSelectedItem(event:any){
        this.service.removeDocuments(this.customer.id, event).subscribe(result => {
            // this.fetchDocuments(this.customer.id);
            
        })
    }

    copySelectedItem(event:any){       
        this.selected.emit(event);
    }

    // deleteSelectedItem(){
    //     const ids = this.getSelectedItems().map((d:any) => d.id);
    //     this.service.removeDocuments(this.customer.id, ids).subscribe(result => {
    //         this.fetchDocuments(this.customer.id);
    //     })
    // }

    // propsUpdate(event:any){
    //     this.valid = event.valid;
    //     this.config = event.values;
    // }

}