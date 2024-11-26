import { Component, Input, SimpleChanges } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { FileUploadService } from "../file-upload.service";
@Component({
    selector: 'app-document-viewer',
    templateUrl: './document-viewer.component.html'
})
export class DocumentViewerComponent {
  
    @Input() document:any;

    content: any;

    constructor(private sanitizer: DomSanitizer, private fileService:FileUploadService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.document.currentValue){
            this.viewDocument(changes.document.currentValue);
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

}