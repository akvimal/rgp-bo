import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";

export type ConfigScope = 'compliance' | 'recognition' | 'health' | 'views' | 'words';

export interface ConfigItem {
    scope: ConfigScope;
    key: string;
    label: string;
    kind: 'int' | 'enum' | 'bool';
    value: number | string | boolean;
    defaultValue: number | string | boolean;
    source: 'default' | 'business';
    since: string | null;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    unit?: string;
    locked?: boolean;
    planLocked: boolean;
    pending: { value: number | string | boolean; from: string } | null;
}

/** The business's own settings for dashboards, compliance and recognition. Anyone signed in reads; the Business Head saves (the server decides). */
@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    private readonly url = `${environment.apiHost}/config`;

    constructor(private http: HttpClient) {}

    effective(scope?: ConfigScope): Observable<{ canEdit: boolean; businessType: string; items: ConfigItem[] }> {
        return this.http.get<any>(this.url, { params: scope ? { scope } : {} });
    }

    /** `effectiveFrom` is yyyy-mm-dd; left out, the change begins tomorrow */
    save(scope: ConfigScope, values: Record<string, number | string | boolean>, effectiveFrom?: string): Observable<any> {
        return this.http.put(`${this.url}/${scope}`, { values, ...(effectiveFrom ? { effectiveFrom } : {}) });
    }

    reset(scope: ConfigScope, key?: string): Observable<any> {
        return this.http.delete(key ? `${this.url}/${scope}/${key}` : `${this.url}/${scope}`);
    }
}
