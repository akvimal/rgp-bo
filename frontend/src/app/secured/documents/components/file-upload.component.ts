import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FileUploadService } from '../file-upload.service';

@Component({
    selector: 'app-file-upload',
    templateUrl: './file-upload.component.html'
})
export class FileUploadComponent implements OnInit {

    @Input() entity:any;
    @Input() type:string = '';
    @Input() property:string = '';

    @Output() uploaded:EventEmitter<any> = new EventEmitter();

    entityId:number = 0;
    error = '';
    loading: boolean = false; // Flag variable
    file: any; // Variable to store file

    content:any;
    // Inject service 
    constructor(private sanitizer: DomSanitizer, private fileUploadService: FileUploadService) { }

    ngOnChanges(changes:SimpleChanges){
        if(changes.entity.currentValue && changes.entity.currentValue[this.property]){
            this.entityId = changes.entity.currentValue[this.property];
        }
    }

    ngOnInit(): void {
        // this.fileUploadService.download().subscribe(data => {
        //     // const blob = new Blob([data], { type: 'application/octet-stream' });
        //     const blob = new Blob([data], { type: 'application/pdf' });
        //     this.content = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
        // });
        // console.log(this.entity);
        
    }

    // On file Select
    onChange(event:any) {
        this.file = event.target.files[0];
    }

    // OnClick of button Upload
    onUpload() {
        this.loading = !this.loading;
      
        this.fileUploadService.upload(this.file,this.type+'='+this.entityId).pipe(
            catchError(error => {
              this.error = error['error']['message'];
              this.loading = false;
              return throwError(() => new Error(error['error']['message']));
            })
          ).subscribe(
            (event: any) => {
                if (typeof (event) === 'object') {
                    this.error = '';
                    this.file = null;
                    this.loading = false; // Flag variable 
                    console.log('uploaded document, emitting',event);
                    
                    this.uploaded.emit(event);
                }
            }
        );
    }
    
}