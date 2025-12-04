import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Attendance, ClockInDto, ClockOutDto } from '../models/hr.models';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private baseUrl = `${environment.apiHost}/hr/attendance`;

  constructor(private http: HttpClient) {}

  // Clock In/Out
  clockIn(dto: ClockInDto): Observable<Attendance> {
    const formData = new FormData();
    if (dto.photo) formData.append('photo', dto.photo);

    return this.http.post<Attendance>(`${this.baseUrl}/clock-in`, formData);
  }

  clockOut(dto: ClockOutDto): Observable<Attendance> {
    const formData = new FormData();
    if (dto.photo) formData.append('photo', dto.photo);

    return this.http.post<Attendance>(`${this.baseUrl}/clock-out`, formData);
  }

  // Get Attendance
  getTodayAttendance(): Observable<Attendance | null> {
    return this.http.get<Attendance | null>(`${this.baseUrl}/today`);
  }

  getAttendanceByDate(date: string): Observable<Attendance | null> {
    return this.http.get<Attendance | null>(`${this.baseUrl}/date/${date}`);
  }

  getMonthlyAttendance(year: number, month: number): Observable<Attendance[]> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<Attendance[]>(`${this.baseUrl}/monthly`, { params });
  }

  getUserMonthlyAttendance(userId: number, year: number, month: number): Observable<Attendance[]> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<Attendance[]>(`${this.baseUrl}/user/${userId}/monthly`, { params });
  }

  updateAttendance(id: number, updates: Partial<Attendance>): Observable<Attendance> {
    return this.http.patch<Attendance>(`${this.baseUrl}/${id}`, updates);
  }
}
