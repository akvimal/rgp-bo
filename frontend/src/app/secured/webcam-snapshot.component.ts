import { AfterViewInit, Component, ElementRef, ViewChild } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import { throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { FileUploadService } from "./documents/file-upload.service";

@Component({
  selector: "app-webcam-snapshot",
  templateUrl: "./webcam-snapshot.component.html",
  styleUrls: ["./webcam-snapshot.component.scss"]
})
export class WebcamSnapshotComponent implements AfterViewInit {
  WIDTH = 640;
  HEIGHT = 480;

  content:SafeUrl;

  @ViewChild("video")
  public video: ElementRef;

  @ViewChild("canvas")
  public canvas: ElementRef;

  captures: string[] = [];
  error: any;
  isCaptured: boolean;

constructor(private fileUploadService: FileUploadService,private sanitizer: DomSanitizer, private fileService:FileUploadService){}

  async ngAfterViewInit() {
    await this.setupDevices();
  }

  async setupDevices() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        if (stream) {
          this.video.nativeElement.srcObject = stream;
          this.video.nativeElement.play();
          this.error = null;
        } else {
          this.error = "You have no output video device";
        }
      } catch (e) {
        this.error = e;
      }
    }
  }

  capture() {
    this.drawImageToCanvas(this.video.nativeElement);
    this.captures.push(this.canvas.nativeElement.toDataURL("image/png"));
    this.isCaptured = true;
  }

  removeCurrent() {
    this.isCaptured = false;
  }

  setPhoto(idx: number) {
    
    this.isCaptured = true;
    var image = new Image();
    image.src = this.captures[idx];
    console.log(this.captures[idx]);
    
    this.fileUploadService.upload(new Blob([this.captures[idx]]),'attendance=100').pipe(
      catchError(error => {
        console.log(error);
        
        this.error = error['error']['message'];
        return throwError(() => new Error(error['error']['message']));
      })
    ).subscribe(
      (event: any) => {
        console.log(event);
        this.download(event.path)
          if (typeof (event) === 'object') {
              this.error = '';
              
              console.log('uploaded document, emitting',event);
              
          }
      }
  );

    this.drawImageToCanvas(image);
  }

  drawImageToCanvas(image: any) {
    this.canvas.nativeElement
      .getContext("2d")
      .drawImage(image, 0, 0, this.WIDTH, this.HEIGHT);
  }

  download(path:string){
    this.fileService.view(path).subscribe((data:any) => {
      const blob = new Blob([data], { type: 'image/png' });
      this.content = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
  });
  }
}
