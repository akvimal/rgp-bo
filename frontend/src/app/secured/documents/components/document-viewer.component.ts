import { Component, Input, SimpleChanges } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { FileUploadService } from "../file-upload.service";
@Component({
    selector: 'app-document-viewer',
    templateUrl: './document-viewer.component.html'
})
export class DocumentViewerComponent {
  
    @Input() path:any;

    content: any;

    constructor(private sanitizer: DomSanitizer, private fileService:FileUploadService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.path.currentValue){
            this.viewDocument(changes.path.currentValue);
        }
    }

    viewDocument(path:any){
        let type = ''
        const extn = path.substring(path.indexOf('.')+1).toLowerCase();
        switch (extn) {
            case 'pdf':
                type = 'application/pdf'
                break;
            default:
                type = 'application/octet-stream'
                break;
        }

        this.fileService.view(path).subscribe(data => {
            const blob = new Blob([data], { type });
            this.content = {type: extn, blob: this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob))};
        });
    }

}