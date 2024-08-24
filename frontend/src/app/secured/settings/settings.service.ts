import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class SettingService {

    apiurl = `${environment.apiHost}/settings`;

    constructor(private http:HttpClient){}

    save(sale:any){
        return this.http.post(`${this.apiurl}`,sale);
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }
    
    update(id:number,values:any){
        return this.http.put(`${this.apiurl}/${id}`, values);
    }

    find(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    findAll(criteria:any){
       return this.http.get(`${this.apiurl}`,{params:criteria});
    }


}