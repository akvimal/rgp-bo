import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  AttendanceReport,
  LeaveReport,
  PerformanceReport,
  UserDashboard
} from '../models/hr.models';

@Injectable({
  providedIn: 'root'
})
export class ReportingService {
  private baseUrl = `${environment.apiHost}/hr/reports`;

  constructor(private http: HttpClient) {}

  // Reports
  getAttendanceReport(storeId: number, year: number, month: number): Observable<AttendanceReport[]> {
    const params = new HttpParams()
      .set('storeId', storeId.toString())
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<AttendanceReport[]>(`${this.baseUrl}/attendance`, { params });
  }

  getLeaveReport(storeId: number, year: number): Observable<LeaveReport[]> {
    const params = new HttpParams()
      .set('storeId', storeId.toString())
      .set('year', year.toString());
    return this.http.get<LeaveReport[]>(`${this.baseUrl}/leave`, { params });
  }

  getPerformanceReport(storeId: number, year: number, month: number): Observable<PerformanceReport[]> {
    const params = new HttpParams()
      .set('storeId', storeId.toString())
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<PerformanceReport[]>(`${this.baseUrl}/performance`, { params });
  }

  // Dashboards
  getMyDashboard(): Observable<UserDashboard> {
    return this.http.get<UserDashboard>(`${this.baseUrl}/dashboard/my`);
  }

  getUserDashboard(userId: number): Observable<UserDashboard> {
    return this.http.get<UserDashboard>(`${this.baseUrl}/dashboard/user/${userId}`);
  }
}
