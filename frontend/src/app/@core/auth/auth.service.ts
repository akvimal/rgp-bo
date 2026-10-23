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
  private readonly modulesKey = 'modules';
  /** what the business has switched on (hr, purchasing off|simple|full, gst, expenses, ...); everything on until told otherwise */
  modules: any = {};

  constructor(private http: HttpClient) {
    try { this.modules = JSON.parse(sessionStorage.getItem(this.modulesKey) || '{}') || {}; } catch { this.modules = {}; }
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
    
  /** which sign-in page this browser last used, so sign-out and expiry return to the right one */
  public setLoginScope(platform: boolean) {
    try { platform ? localStorage.setItem('login_scope', 'platform') : localStorage.removeItem('login_scope'); } catch { /* storage blocked */ }
  }

  public loginUrl(): string {
    try { return localStorage.getItem('login_scope') === 'platform' ? '/platform/login' : '/login'; } catch { return '/login'; }
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

  public setModules(modules:any){
    this.modules = modules || {};
    try { sessionStorage.setItem(this.modulesKey, JSON.stringify(this.modules)); } catch { /* storage blocked */ }
  }

  /** a module is on unless the business switched it off (purchasing counts as on at simple or full) */
  public moduleOn(key:string):boolean{
    const v = this.modules ? this.modules[key] : undefined;
    return v === undefined || v === null ? true : (key === 'purchasing' ? v !== 'off' : !!v);
  }

  public get purchasingFull():boolean{
    return !this.modules || !this.modules.purchasing || this.modules.purchasing === 'full';
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
