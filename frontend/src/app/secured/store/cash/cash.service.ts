import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class CashService {

    apiurl = environment.apiHost;

    constructor(private http:HttpClient){ }

}