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
  private readonly businessKey = 'business';
  private readonly gstKey = 'gstreg';
  private readonly hostedKey = 'hosted';
  /** this is a customer's copy run by a provider (it has a plan), not a standalone install */
  hosted = false;
  private readonly platformKey = 'platform';
  /** the hosted plan (its name and limits) when this is a customer's copy; null for a standalone install */
  platform: any = null;
  /** what the business has switched on (hr, purchasing off|simple|full, gst, expenses, ...); everything on until told otherwise */
  modules: any = {};
  /** GST: whether the business issues tax invoices, and from when */
  gst: { registered: boolean; go_live: string | null; state_code: string | null } = { registered: false, go_live: null, state_code: null };
  /** the kind of business and the packs it has; until told otherwise the businesses that were here first are pharmacies */
  business: { type: string; packs: string[] } = { type: 'pharmacy', packs: ['pharmacy'] };

  constructor(private http: HttpClient) {
    try { this.modules = JSON.parse(sessionStorage.getItem(this.modulesKey) || '{}') || {}; } catch { this.modules = {}; }
    try { const g = JSON.parse(sessionStorage.getItem(this.gstKey) || 'null'); if (g) this.gst = g; } catch { /* keep the default */ }
    try { const b = JSON.parse(sessionStorage.getItem(this.businessKey) || 'null'); if (b && b.type) this.business = b; } catch { /* keep the default */ }
    try { this.hosted = sessionStorage.getItem(this.hostedKey) === '1'; } catch { this.hosted = false; }
    try { this.platform = JSON.parse(sessionStorage.getItem(this.platformKey) || 'null'); } catch { this.platform = null; }
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

  public setBusiness(type:any, packs:any){
    this.business = { type: type || 'pharmacy', packs: Array.isArray(packs) ? packs : [] };
    try { sessionStorage.setItem(this.businessKey, JSON.stringify(this.business)); } catch { /* storage blocked */ }
  }

  public setGst(g:any){
    this.gst = { registered: !!g?.registered, go_live: g?.go_live || null, state_code: g?.state_code || null };
    try { sessionStorage.setItem(this.gstKey, JSON.stringify(this.gst)); } catch { /* storage blocked */ }
  }

  /** tax invoices are being issued now: the business is registered and its go-live date has come */
  public get gstLive():boolean{
    if (!this.gst.registered || !this.gst.go_live) return false;
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return this.gst.go_live <= today;
  }

  /** the business has this pack: a pack's screens, fields and words are for the businesses that have it */
  public packOn(name:string):boolean{
    return (this.business.packs || []).includes(name);
  }

  /** a module is on unless the business switched it off (purchasing counts as on at simple or full) */
  public moduleOn(key:string):boolean{
    const v = this.modules ? this.modules[key] : undefined;
    return v === undefined || v === null ? true : (key === 'purchasing' ? v !== 'off' : !!v);
  }

  public setPlatform(platform:any){
    this.platform = platform || null;
    try { sessionStorage.setItem(this.platformKey, JSON.stringify(this.platform)); } catch { /* storage blocked */ }
    this.setHosted(!!platform);
  }

  public setHosted(hosted:boolean){
    this.hosted = !!hosted;
    try { sessionStorage.setItem(this.hostedKey, this.hosted ? '1' : '0'); } catch { /* storage blocked */ }
  }

  /** whether a permission group means anything on this account: the plan's modules, and the platform-only ones */
  public resourceAvailable(key:string):boolean{
    switch (key) {
      case 'businesses': return !this.hosted;
      case 'hr': case 'myhr': case 'leaveapprove': case 'kpirate': case 'mykpi': return this.moduleOn('hr');
      case 'purchases': case 'vendorissues': return this.moduleOn('purchasing');
      case 'purchaseorders': return this.purchasingFull;
      case 'expenses': return this.moduleOn('expenses');
      case 'paymentrecon': return this.moduleOn('payment_recon');
      case 'stockaudit': return this.moduleOn('stock_audits');
      case 'refills': return this.moduleOn('refills');
      case 'returns': return this.moduleOn('returns');
      case 'scheduleregister': return this.moduleOn('drug_register');
      default: return true;
    }
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
    // everyone signed in has their own notifications; what shows in them is decided by the server
    if (url === '/secure/notifications') return true;
    // the pharmacy guide is for everyone who works in a pharmacy business, whatever their role
    if (url.split('?')[0] === '/secure/pharmacy-guide') return this.packOn('pharmacy');
    const found = this.permissions.find((p:any) => {
      if(p.path instanceof Array)
        return p.path.some((i:string) => this.matchesPath(url, i));
      else
        return this.matchesPath(url, p.path);
    });
    return found ? true : false;
  }
}
