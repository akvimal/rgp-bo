import { Injectable } from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import { environment } from "./../../environments/environment";
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  
  apiurl = `${environment.apiHost}/files`;
  
  constructor(private http:HttpClient) { }

  upload(file:any):Observable<any> {
      const formData = new FormData(); 
      
      // Store form name as "file" with file data
      formData.append("file", file, file.name);
      return this.http.post(this.apiurl+'/upload', formData)
  }

  download(){
    let httpHeaders = new HttpHeaders();
    httpHeaders.set('Accept', "image/webp,*/*");
    return this.http.get<Blob>(this.apiurl+'/buffer', 
      { headers: httpHeaders, responseType: 'blob' as 'json' });
  }
}