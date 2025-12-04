import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Shift, UserShift } from '../models/hr.models';

@Injectable({
  providedIn: 'root'
})
export class ShiftService {
  private baseUrl = `${environment.apiHost}/hr/shifts`;

  constructor(private http: HttpClient) {}

  // Shift CRUD
  createShift(shift: Partial<Shift>): Observable<Shift> {
    return this.http.post<Shift>(this.baseUrl, shift);
  }

  getAllShifts(storeId?: number): Observable<Shift[]> {
    let params = new HttpParams();
    if (storeId) {
      params = params.set('storeId', storeId.toString());
    }
    return this.http.get<Shift[]>(this.baseUrl, { params });
  }

  getShift(id: number): Observable<Shift> {
    return this.http.get<Shift>(`${this.baseUrl}/${id}`);
  }

  updateShift(id: number, shift: Partial<Shift>): Observable<Shift> {
    return this.http.patch<Shift>(`${this.baseUrl}/${id}`, shift);
  }

  deleteShift(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // User shift assignment
  assignUserToShift(assignment: {
    userId: number;
    shiftId: number;
    effectiveFrom: string;
    effectiveTo?: string;
    daysOfWeek: number[];
  }): Observable<UserShift> {
    return this.http.post<UserShift>(`${this.baseUrl}/assign`, assignment);
  }

  getUserCurrentShift(userId: number): Observable<UserShift | null> {
    return this.http.get<UserShift | null>(`${this.baseUrl}/user/${userId}/current`);
  }

  getAllAssignments(): Observable<UserShift[]> {
    return this.http.get<UserShift[]>(`${this.baseUrl}/assignments/all`);
  }
}
