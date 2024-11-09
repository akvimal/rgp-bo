import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class PropsService {

    constructor(private httpClient: HttpClient){}

    fetch(){
        return this.httpClient.get("/assets/props.json");//.subscribe(data => this.config = data);
    }

}