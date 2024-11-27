import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class PropsService {

    config$ = new BehaviorSubject<any>([]);

    productProps$ = new BehaviorSubject<any>([]);
    documentProps$ = new BehaviorSubject<any>([]);

    constructor(private http: HttpClient){
        this.http.get("/assets/props.json").subscribe((data:any) => {
            this.productProps$.next(this.getEntityProps(data,'product')['config']);
            this.documentProps$.next(this.getEntityProps(data,'document')['config']);

            this.config$.next(data);
        });
    }

    getEntityProps(data:any,entity:string){
        return data.find((d:any) => d.entity == entity);
    }

}