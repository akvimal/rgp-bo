import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { DocumentsService } from "../documents.service";
import { FileUploadService } from "../file-upload.service";

@Component({
    selector: 'app-document-upload',
    templateUrl: './document-upload.component.html'
})
export class DocumentUploadComponent {
    @Input() entity:any;
    @Input() type:string = '';
    @Input() property:string = '';

    @Output() uploaded:EventEmitter<any> = new EventEmitter();

    entityId:number = 0;
    error = '';
    loading: boolean = false; // Flag variable
    file: any; // Variable to store file

    // Inject service 
    constructor(private service: FileUploadService, private docService:DocumentsService) { }

    ngOnChanges(changes:SimpleChanges){
        if(changes.entity.currentValue && changes.entity.currentValue[this.property]){
            this.entityId = changes.entity.currentValue[this.property];
        }
    }

    // On file Select
    onChange(event:any) {
        this.file = event.target.files[0];
    }

    // OnClick of button Upload
    onUpload() {
        this.loading = !this.loading;
      
        this.service.upload(this.file,this.type+'='+this.entityId).pipe(
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
                    this.saveDocInfoToTable(event);
                }
            }
        );
    }

    saveDocInfoToTable(event:any){
        //save the document infor to DB
        if(event){
            const extn = event.filename.substring(event.filename.indexOf('.')+1).toLowerCase();
            this.docService.save({name:event.originalname, path: event.path, extn }).subscribe(result => {
                this.uploaded.emit(result);
            });
        }
    }
    
}