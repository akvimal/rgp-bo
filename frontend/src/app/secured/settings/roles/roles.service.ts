import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Role } from "./role.model";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class RolesService {

    API_SERVER = environment.apiHost;

    constructor(private http:HttpClient){}

    public findAll() {
        return this.http.get(`${this.API_SERVER}/roles`);
    }

      /** the starter roles not created yet */
      public templates(){
        return this.http.get<any[]>(`${this.API_SERVER}/roles/templates`);
      }

      public createTemplates(names:string[]){
        return this.http.post<any>(`${this.API_SERVER}/roles/templates`, { names });
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