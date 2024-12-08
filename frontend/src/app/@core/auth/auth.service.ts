import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from './../../../environments/environment';

@Injectable({
    providedIn: "root"
})
export class AuthService {

  permissions = []

  constructor(private http: HttpClient) {}
    
  public login(cred:any):Observable<any>{
    return this.http.post<any>(`${environment.apiHost}/auth/login`,cred);
  }
    
  public register(user:any):Observable<any>{
    return this.http.post<any>(`${environment.apiHost}/auth/register`,user);
  }
    
  public changepwd(passwords:any):Observable<any>{
    return this.http.post<any>(`${environment.apiHost}/auth/changepwd`,passwords);
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
    // console.log(this.permissions);
    
    const found = this.permissions.find((p:any) => {
      if(p.path instanceof Array) 
        return p.path.find((i:string) => {
          // console.log(i);
          // console.log(url);
          return url.indexOf(i) >= 0
        })
      else 
        return p.path === url || url.startsWith(p.path);
    });
    return found ? true : false;
  }
}