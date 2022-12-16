import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Role } from "./role.model";

@Injectable({
    providedIn: 'root'
})
export class RolesService {

    API_SERVER = "http://localhost:3000";

    constructor(private http:HttpClient){}

    public findAll() {
        return this.http.get(`${this.API_SERVER}/roles`);
    }

      public save(role:any){
        return this.http.post(`${this.API_SERVER}/roles`,role);
      }
      
      public update(id:number, role:Role){
        return this.http.put(`${this.API_SERVER}/roles/${id}`,role);
      }
      
      public remove(id:number){
        return this.http.delete(`${this.API_SERVER}/roles/${id}`);
    }
      public findById(id:any){
        return this.http.get(`${this.API_SERVER}/roles/${id}`);
    }  

}