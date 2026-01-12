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
      public remove(id:any){
        return this.http.delete(`${this.API_SERVER}/users/${id}`);
      }

      // Multi-role management methods
      public getUserRoles(userId: number) {
        return this.http.get(`${this.API_SERVER}/users/roles/${userId}`);
      }

      public assignRole(userId: number, roleId: number) {
        return this.http.post(`${this.API_SERVER}/users/roles/assign`, { userId, roleId });
      }

      public removeRole(userId: number, roleId: number) {
        return this.http.delete(`${this.API_SERVER}/users/roles/${userId}/${roleId}`);
      }

      public refreshToken(userId: number) {
        return this.http.post(`${this.API_SERVER}/users/roles/${userId}/refresh-token`, {});
      }
}