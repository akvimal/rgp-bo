import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class OperatorContextService {
  private readonly selectedOperatorIdKey = "selected_operator_id";
  private readonly selectedOperatorNameKey = "selected_operator_name";
  private readonly operatorsSubject = new BehaviorSubject<any[]>([]);
  private readonly selectedOperatorIdSubject = new BehaviorSubject<number | null>(this.readStoredSelectedOperatorId());
  private readonly selectedOperatorNameSubject = new BehaviorSubject<string>(localStorage.getItem(this.selectedOperatorNameKey) || "");

  operators$ = this.operatorsSubject.asObservable();
  selectedOperatorId$ = this.selectedOperatorIdSubject.asObservable();
  selectedOperatorName$ = this.selectedOperatorNameSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadOperators(storeId?: number | null, defaultOperatorId?: number): Observable<any> {
    let params = new HttpParams();
    if (storeId !== null && storeId !== undefined) {
      params = params.set("storeid", String(storeId));
    }
    return this.http.get(`${environment.apiHost}/store-cash/users`, { params }).pipe(tap((users: any) => {
      const operators = users || [];
      this.operatorsSubject.next(operators);
      const stored = this.readStoredSelectedOperatorId();
      const fallback = this.isValidSelection(defaultOperatorId, operators) ? Number(defaultOperatorId) : this.getFirstOperatorId(operators);
      const resolved = this.isValidSelection(stored, operators) ? stored : fallback;
      this.setSelectedOperator(resolved, false, operators);
    }));
  }

  get selectedOperatorId(): number | null {
    return this.selectedOperatorIdSubject.value;
  }

  get selectedOperatorName(): string {
    return this.selectedOperatorNameSubject.value;
  }

  setSelectedOperator(id: number | null, persist = true, operators: any[] = this.operatorsSubject.value || []) {
    const normalized = id === null || id === undefined || id === ("" as any) ? null : Number(id);
    const selected = normalized === null ? null : this.findOperator(operators, normalized);
    this.selectedOperatorIdSubject.next(selected ? Number(selected.id) : null);
    this.selectedOperatorNameSubject.next(selected ? (selected.fullname || selected.name || selected.email || "") : "");
    if (persist) {
      if (selected) {
        localStorage.setItem(this.selectedOperatorIdKey, String(selected.id));
        localStorage.setItem(this.selectedOperatorNameKey, selected.fullname || selected.name || selected.email || "");
      } else {
        localStorage.removeItem(this.selectedOperatorIdKey);
        localStorage.removeItem(this.selectedOperatorNameKey);
      }
    }
  }

  clear() {
    this.setSelectedOperator(null);
  }

  private readStoredSelectedOperatorId(): number | null {
    const raw = localStorage.getItem(this.selectedOperatorIdKey);
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isValidSelection(operatorId: number | null | undefined, operators: any[]): boolean {
    if (operatorId === null || operatorId === undefined) {
      return false;
    }
    return Array.isArray(operators) ? operators.some((operator) => Number(operator.id) === Number(operatorId)) : false;
  }

  private findOperator(operators: any[], operatorId: number | null): any {
    if (operatorId === null) {
      return null;
    }
    return Array.isArray(operators) ? operators.find((operator) => Number(operator.id) === Number(operatorId)) : null;
  }

  private getFirstOperatorId(operators: any[]): number | null {
    const first = Array.isArray(operators) && operators.length ? operators[0] : null;
    return first ? Number(first.id) : null;
  }
}
