import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { DocumentsService } from "../documents.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    selector: 'app-document-list',
    templateUrl: './document-list.component.html'
})
export class DocumentListComponent {

    @Input() ids:any;
    @Output() selected:EventEmitter<any> = new EventEmitter();
    @Output() removed:EventEmitter<any> = new EventEmitter();

    documents:any[] = [];
    document:any;

    constructor(private service:DocumentsService, private confirm:ConfirmService){}

    ngOnChanges(changes: SimpleChanges){
       if(changes.ids.currentValue){
        this.fetchDocuments(changes.ids.currentValue);
       }
    }

    fetchDocuments(ids:number[]){
        ids.length > 0 && this.service.filter(ids).subscribe((data:any) => {           
            this.documents = data;
            if(data && data.length > 0)
            this.document = data[0];
        });
    }

    copySelectedItem(){
        this.selected.emit(this.getSelectedItems());
    }

    deleteSelectedItem(){
        const items = this.getSelectedItems();
        const ids = items.map((d:any) => d.id);
        const label = items.length === 1 ? (items[0].alias || items[0].category || 'this document') : `${items.length} documents`;
        this.confirm.confirmDelete(label, () => {
            this.documents = [...this.documents].filter(d => !ids.includes(d.id));
            this.removed.emit(ids);
        }, { entity: items.length === 1 ? 'document' : 'documents' });
    }

    selectDocument(id:number,event:any){
        this.documents.forEach((d:any) => {
            if(d.id == id){
                d['selected'] = event.target.checked;
            }
        });
    }

    documentsSelected(){
        return this.documents.filter(d => d.selected).length > 0
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

    viewDoc(id:number){
        this.document = this.documents.find((d:any) => d.id === id);
    }
}