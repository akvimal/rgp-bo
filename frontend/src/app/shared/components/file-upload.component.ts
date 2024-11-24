import { Component, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { FileUploadService } from '../file-upload.service';

@Component({
    selector: 'app-file-upload',
    templateUrl: './file-upload.component.html'
})
export class FileUploadComponent implements OnInit {

    // Variable to store shortLink from api response
    shortLink: string = "";
    loading: boolean = false; // Flag variable
    file: any; // Variable to store file

    image:any;
    // Inject service 
    constructor(private sanitizer: DomSanitizer, private fileUploadService: FileUploadService) { }

    ngOnInit(): void {

        this.fileUploadService.download().subscribe(data => {
            // console.log(blob);
            const blob = new Blob([data], { type: 'application/octet-stream' });

    this.image = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));

            // const dt =  URL.createObjectURL(blob);
            // this.image = this.sanitizer.bypassSecurityTrustResourceUrl(`data:image/jpeg;base64, ${dt}`);
        })
    }

    // On file Select
    onChange(event:any) {
        this.file = event.target.files[0];
    }

    // OnClick of button Upload
    onUpload() {
        this.loading = !this.loading;
        console.log(this.file);
        this.fileUploadService.upload(this.file).subscribe(
            (event: any) => {
                if (typeof (event) === 'object') {

                    // Short link via api response
                    this.shortLink = event.link;

                    this.loading = false; // Flag variable 
                }
            }
        );
    }

    
}