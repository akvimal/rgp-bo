import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { environment } from "src/environments/environment";

@Injectable({
    providedIn: 'root'
})
export class LookupService {

    config$ = new BehaviorSubject<any>([]);
    apiurl = `${environment.apiHost}/lookup`;

    constructor(private http: HttpClient){}

    find(entity:string,property:string,query:string){
        return this.http.get(`${this.apiurl}/${entity}/${property}/${query}`);
    }

}