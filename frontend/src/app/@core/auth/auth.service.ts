import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from './../../../environments/environment';

@Injectable({
    providedIn: "root"
})
export class AuthService {

  permissions = []
  private readonly permissionsKey = 'permissions';

  constructor(private http: HttpClient) {
    const savedPermissions = sessionStorage.getItem(this.permissionsKey);
    if (savedPermissions) {
      try {
        this.permissions = JSON.parse(savedPermissions);
      } catch {
        this.permissions = [];
        sessionStorage.removeItem(this.permissionsKey);
      }
    }
  }
    
  public login(cred:any):Observable<any>{
    return this.http.post<any>(`${environment.apiHost}/auth/login`,cred);
  }
    
  public changepwd(passwords:any):Observable<any>{
    return this.http.post<any>(`${environment.apiHost}/auth/changepwd`,passwords);
  }

  public refresh():Observable<any>{
    return this.http.post<any>(`${environment.apiHost}/auth/refresh`,{});
  }
    
  public getPermissions(){
    return this.permissions;
  }

  public setPermissions(perms:any){
    this.permissions = perms;
    if (perms) {
      sessionStorage.setItem(this.permissionsKey, JSON.stringify(perms));
    } else {
      sessionStorage.removeItem(this.permissionsKey);
    }
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

  private matchesPath(url:string, path:string):boolean {
    // An empty / missing path authorizes nothing (some resources carry actions
    // but no navigable route).
    if (!path) {
      return false;
    }
    // Exact match, url is under path (leaf access), or url is a parent "hub" page
    // of an authorized path (e.g. /secure/settings should be reachable if the
    // user has access to /secure/settings/businesses).
    return url === path || url.startsWith(path + '/') || path.startsWith(url + '/');
  }

  public isUrlAuthorized(url:string):boolean{
    const found = this.permissions.find((p:any) => {
      if(p.path instanceof Array)
        return p.path.some((i:string) => this.matchesPath(url, i));
      else
        return this.matchesPath(url, p.path);
    });
    return found ? true : false;
  }
}
