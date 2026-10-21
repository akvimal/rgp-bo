import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Vendor } from "./vendor.model";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class VendorsService {

    apiurl = `${environment.apiHost}/vendors`;

    constructor(private http:HttpClient){}

    /** status: active (default, blocked ones included) | usable | blocked | disabled | all */
    findAll(status?:string){
        return this.http.get<any[]>(this.apiurl, status ? { params: { status } } : {});
    }

    /** vendors a purchase form may offer: active and not blocked */
    findUsable(){
        return this.findAll('usable');
    }

    block(id:number, reason:string){
        return this.http.post(`${this.apiurl}/${id}/block`, { reason });
    }

    unblock(id:number){
        return this.http.post(`${this.apiurl}/${id}/unblock`, {});
    }

    enable(id:number){
        return this.http.post(`${this.apiurl}/${id}/enable`, {});
    }

    findById(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    save(vendor:Vendor){
        return this.http.post(`${this.apiurl}`,vendor);
    }

    update(id:number, vendor:Vendor){
        return this.http.put(`${this.apiurl}/${id}`,vendor);
    }

    /** licences that have run out or will within `days` (latest licence of each type per vendor) */
    expiringLicenses(days = 60){
        return this.http.get<any[]>(`${this.apiurl}/licenses/expiring`, { params: { days: String(days) } });
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }
}