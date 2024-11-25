import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

@Injectable({
    providedIn: 'root'
})
export class DocumentsService {

    apiurl = `${environment.apiHost}/documents`;

    constructor(private http:HttpClient){}

    save(document:any){
        return this.http.post(`${this.apiurl}`, document);
    }

    find(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }
    
    filter(ids:number[]){
        return this.http.post(`${this.apiurl}/filter`,{ids});
    }

}