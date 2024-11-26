import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";

import { CustomersService } from "../customers.service";

@Component({
    selector: 'app-customer-documents',
    templateUrl: './customer-documents.component.html'
})
export class CustomerDocumentsComponent {

    @Input() customer:any;
    @Output() selected:EventEmitter<any> = new EventEmitter();

    documents:any = [];
    document:any;

    alias = '';

    constructor(private service:CustomersService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.customer.currentValue){
           this.fetchDocuments(changes.customer.currentValue.id);
        }
    }

    fetchDocuments(customerId:number){
        this.service.findAllDocuments(customerId).subscribe((data:any) => {
            this.documents = data;
            this.document = data.length > 0 ? data[0] : null;
        });
    }

    onUpload(event:any){
        const alias = this.alias.length == 0 ? event.name.substring(0,event.name.indexOf('.')) : this.alias;
        const cdoc = {customerId:this.customer.id,documentId:event.id,alias}
        this.service.addDocument(cdoc).subscribe(data => {
            this.fetchDocuments(this.customer.id);
        });
    }

    selectDocument(id:number,event:any){
        this.documents.forEach((d:any) => {
            if(d.id == id){
                d['selected'] = event.target.checked;
            }
        });
    }

    viewDoc(id:number){
        this.document = this.documents.find((d:any) => d.id === id);
    }

    getSelectedItems(){
        const docs:any[] = [];
        this.documents.forEach((d:any) => {
            if(d.selected){
                docs.push(d);
            } 
        });
        return docs;
    }

    copySelectedItem(){       
        this.selected.emit(this.getSelectedItems());
    }

    deleteSelectedItem(){
        const ids = this.getSelectedItems().map((d:any) => d.id);
        this.service.removeDocuments(this.customer.id, ids).subscribe(result => {
            this.fetchDocuments(this.customer.id);
        })
    }
}