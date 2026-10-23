import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { DocumentsService } from "../documents.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    selector: 'app-document-list',
    templateUrl: './document-list.component.html'
})
export class DocumentListComponent {

    @Input() ids:any;
    @Input() loading = false;
    /** what the button that hands the ticked documents on says */
    @Input() copyLabel = 'Use selected';
    @Output() selected:EventEmitter<any> = new EventEmitter();
    @Output() removed:EventEmitter<any> = new EventEmitter();

    documents:any[] = [];
    document:any;

    constructor(private service:DocumentsService, private confirm:ConfirmService){}

    ngOnChanges(changes: SimpleChanges){
       if(changes.ids && changes.ids.currentValue){
        this.fetchDocuments(changes.ids.currentValue);
       }
    }

    fetchDocuments(ids:number[]){
        if(!ids.length){
            this.documents = [];
            this.document = undefined;
            return;
        }
        this.service.filter(ids).subscribe((data:any) => {
            const ticked = new Set(this.documents.filter(d => d.selected).map(d => d.id));
            this.documents = (data || []).map((d:any) => ({...d, selected: ticked.has(d.id)}));
            // keep looking at the same document if it is still there, else the first
            this.document = this.documents.find(d => d.id === this.document?.id) || this.documents[0];
        });
    }

    get selectedCount(): number { return this.documents.filter(d => d.selected).length; }

    copySelectedItem(){
        this.selected.emit(this.getSelectedItems());
    }

    deleteSelectedItem(){
        const items = this.getSelectedItems();
        const ids = items.map((d:any) => d.id);
        const label = items.length === 1 ? (items[0].alias || items[0].category || 'this document') : `${items.length} documents`;
        this.confirm.confirmDelete(label, () => {
            this.documents = [...this.documents].filter(d => !ids.includes(d.id));
            if(this.document && ids.includes(this.document.id)) this.document = this.documents[0];
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

    getSelectedItems(){
        return this.documents.filter(d => d.selected);
    }

    viewDoc(id:number){
        this.document = this.documents.find((d:any) => d.id === id);
    }

    /** an icon for the kind of file, from its extension */
    icon(d:any): string {
        const extn = String(d.extn || d.path || '').split('.').pop()!.toLowerCase();
        if(extn === 'pdf') return 'bi-file-earmark-pdf';
        if(['png','jpg','jpeg','gif','webp','bmp'].includes(extn)) return 'bi-file-earmark-image';
        return 'bi-file-earmark';
    }

    title(d:any): string { return d.alias || d.name || d.category || 'Document'; }
}
