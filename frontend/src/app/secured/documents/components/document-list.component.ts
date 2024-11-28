import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { DocumentsService } from "../documents.service";

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

    constructor(private service:DocumentsService){}

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
        const ids = this.getSelectedItems().map((d:any) => d.id);
        this.documents = [...this.documents].filter(d => !ids.includes(d.id) )
        this.removed.emit(ids);
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