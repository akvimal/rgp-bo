import { Injectable } from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  
  apiurl = `${environment.apiHost}/files`;
  
  constructor(private http:HttpClient) { }

  upload(file:any,entity:string):Observable<any> {
      const formData = new FormData(); 
      // Store form name as "file" with file data
      formData.append("file", file);
      return this.http.post(this.apiurl+`/upload?${entity}`, formData)
  }

  // download(){
  //   let httpHeaders = new HttpHeaders();
  //   httpHeaders.set('Accept', "image/webp,*/*");
  //   return this.http.get<Blob>(this.apiurl+'/buffer', 
  //     { headers: httpHeaders, responseType: 'blob' as 'json' });
  // }

  view(path:any){
    let httpHeaders = new HttpHeaders();
    httpHeaders.set('Accept', "image/webp,*/*");
    return this.http.post<Blob>(this.apiurl+'/view', {path},
      { headers: httpHeaders, responseType: 'blob' as 'json' });
  }
}