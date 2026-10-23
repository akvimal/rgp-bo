import { Component, Input, OnDestroy, SimpleChanges } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { FileUploadService } from "../file-upload.service";

const IMAGES: {[extn:string]:string} = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', bmp:'image/bmp' };

/** Shows one stored file: a picture or a PDF in place, anything else as a download. Open and download sit in the bar above it. */
@Component({
    selector: 'app-document-viewer',
    templateUrl: './document-viewer.component.html'
})
export class DocumentViewerComponent implements OnDestroy {

    @Input() path:any;
    /** what to call the file in the bar and when it is saved */
    @Input() name = '';

    content: any;
    loading = false;
    failed = false;
    private objectUrl = '';

    constructor(private sanitizer: DomSanitizer, private fileService:FileUploadService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.path && changes.path.currentValue){
            this.viewDocument(changes.path.currentValue);
        }
    }

    ngOnDestroy(){
        this.release();
    }

    get downloadName(): string {
        const extn = this.content?.type;
        const base = this.name || 'document';
        return extn && !base.toLowerCase().endsWith('.' + extn) ? `${base}.${extn}` : base;
    }

    private release(){
        if(this.objectUrl) window.URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = '';
    }

    viewDocument(path:any){
        const extn = String(path).substring(String(path).lastIndexOf('.')+1).toLowerCase();
        const type = extn === 'pdf' ? 'application/pdf' : (IMAGES[extn] || 'application/octet-stream');
        this.release();
        this.content = null;
        this.failed = false;
        this.loading = true;
        this.fileService.view(path).subscribe(data => {
            if(path !== this.path) return;                       // a newer choice has taken over
            const blob = new Blob([data], { type });
            this.objectUrl = window.URL.createObjectURL(blob);
            this.content = {type: extn, kind: extn === 'pdf' ? 'pdf' : (IMAGES[extn] ? 'image' : 'other'), blob: this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl)};
            this.loading = false;
        }, () => { if(path === this.path){ this.loading = false; this.failed = true; } });
    }

}
