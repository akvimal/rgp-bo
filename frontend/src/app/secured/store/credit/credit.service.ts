import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class CreditService {

    apiurl = environment.apiHost;

    constructor(private http:HttpClient){ }

}