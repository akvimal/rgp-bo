import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { User } from "./user.model";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class UsersService {

    API_SERVER = environment.apiHost;

    constructor(private http:HttpClient){}

    public findAll() {
        return this.http.get(`${this.API_SERVER}/users`);
    }

    public getStores() {
        return this.http.get(`${this.API_SERVER}/stores`);
    }

    public findById(id:any){
      return this.http.get(`${this.API_SERVER}/users/${id}`);
  }  
  
    public getCurrentUser():Observable <User>{
        return this.http.get<User>(`${this.API_SERVER}/auth/me`);
      }
  
      public save(user:any){
        return this.http.post(`${this.API_SERVER}/users`,user);
      }
      
      public update(id:number, user:User){
        return this.http.put(`${this.API_SERVER}/users/${id}`, user);
      }
      public updateStores(id:number, storeids:any[]){
        return this.http.put(`${this.API_SERVER}/users/${id}/stores`, { storeids });
      }
      public remove(id:any){
        return this.http.delete(`${this.API_SERVER}/users/${id}`);
      }
}
