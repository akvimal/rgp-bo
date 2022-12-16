import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable({
    providedIn: "root"
})
export class AuthService {

  API_SERVER = "http://localhost:3000";

  permissions = []

  constructor(private http: HttpClient) {}
    
  public login(cred:any):Observable<any>{
    return this.http.post<any>(`${this.API_SERVER}/auth/login`,cred);
  }
    
  public register(user:any):Observable<any>{
    return this.http.post<any>(`${this.API_SERVER}/auth/register`,user);
  }
    
  public changepwd(passwords:any):Observable<any>{
    return this.http.post<any>(`${this.API_SERVER}/auth/changepwd`,passwords);
  }
    
  public getPermissions(){
    return this.permissions;
  }

  public setPermissions(perms:any){
    this.permissions = perms;
  }

  public isFieldAuthorized(field:string){
    const arr:any[] = []
    this.permissions.forEach((elem:any) => {
      elem.policies &&  elem.policies.forEach((e:any) => { 
        e.properties && e.properties.forEach((f:any) => {
          arr.push(elem.resource + '.' +e.action + '$' +f);
        })
      });
    })
    return arr.includes(field);
  }

  public isActionAuthorized(action:string){
    const arr:any[] = []
    this.permissions.forEach((elem:any) => {
      elem.policies &&  elem.policies.forEach((e:any) => arr.push(elem.resource + '.' +e.action));
      arr.push(elem.resource);
    })
    return arr.includes(action);
  }

  public isUrlAuthorized(url:string):boolean{
    const found = this.permissions.find((p:any) => {
      if(p.path instanceof Array) 
        return p.path.includes(url)
      else 
        return p.path === url || url.startsWith(p.path);
    });
    
    return found ? true : false;
  }
}