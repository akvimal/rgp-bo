import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class ConfigService {

    props = new BehaviorSubject<any>([]);
    // saleProps:any;
  
    constructor(private http:HttpClient){
        this.http.get("/assets/props.json").subscribe(data => {
            this.props.next(data);
        });
        // this.http.get("/assets/sale-props.json").subscribe(data => this.saleProps = data);
    }

}