import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class ReportService {

    apiurl = `${environment.apiHost}/reports`;

    constructor(private http:HttpClient){}

    search(criteria:any){
        console.log(criteria);
        
        if(criteria.action == 'export')
        return this.http.post(`${this.apiurl}/${criteria.criteria['report']}`,criteria, {responseType: "blob"});
        else
        return this.http.post(`${this.apiurl}/${criteria.criteria['report']}`,criteria);
    }

}