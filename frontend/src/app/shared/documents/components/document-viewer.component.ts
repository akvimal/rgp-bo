import { Component, Input, SimpleChanges } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { DocumentsService } from "../documents.service";
import { FileUploadService } from "../file-upload.service";
@Component({
    selector: 'app-document-viewer',
    templateUrl: './document-viewer.component.html'
})
export class DocumentViewerComponent {
  
    @Input() documents:any = [];

    // documents:{id:number,name:string}[] = [];
    content: any;

    constructor(private sanitizer: DomSanitizer, private service:DocumentsService, private fileService:FileUploadService){}

    ngOnChanges(changes:SimpleChanges){
        // if(changes.docIds){
        //     if(changes.docIds.currentValue && changes.docIds.currentValue.length > 0){
        //         this.service.filter(changes.docIds.currentValue).subscribe((data:any) => {
        //             this.documents = data;
        //             if(this.documents.length > 0)
        //             this.viewDocument(this.documents[0]);
        //         });
        //     }
        // }
        console.log(changes.documents);
        if(changes.documents.currentValue.length > 0){
            this.viewDocument(changes.documents.currentValue[0]);
        }
        
    }

    viewDocument(document:any){
        
        const extn = document['doc_extn'].toLowerCase();
        let type = ''
        switch (extn) {
            case 'pdf':
                type = 'application/pdf'
                break;
            default:
                type = 'application/octet-stream'
                break;
        }

        this.fileService.view(document['doc_path']).subscribe(data => {
            const blob = new Blob([data], { type });
            this.content = {type: extn, blob: this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob))};
        });
    }

    viewDoc(id:number){
        console.log('clicked',id);
        
        const document = this.documents.find((d:any) => d.id === id)
        if(document) {
            this.viewDocument(document);
        }
    }
}