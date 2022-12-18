import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { Customer } from "./customer.model";
import { environment } from "./../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class CustomersService {

    state = new BehaviorSubject([])
    apiurl = `${environment.apiHost}/customers`;

    constructor(private http:HttpClient){}

    save(customer:Customer){
        this.http.post(`${this.apiurl}`,customer).subscribe(data => this.findAll());
    }

    remove(id:number){
        this.http.delete(`${this.apiurl}/${id}`).subscribe(data => this.findAll());
    }

    find(id:any){
        return this.state.value.find((item:any) => item.id === id);
    }

    findAllApi(){
        return this.http.get(`${this.apiurl}`);
    }
    
    findAll(){
        this.http.get(`${this.apiurl}`).subscribe((data:any) => {
           this.state.next(data)
        })
    }
}