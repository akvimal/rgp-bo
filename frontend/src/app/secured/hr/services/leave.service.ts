import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { LeaveType, LeaveRequest, LeaveBalance, LeaveRequestStatus } from '../models/hr.models';

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
  private baseUrl = `${environment.apiHost}/hr/leave`;

  constructor(private http: HttpClient) {}

  // Leave Types
  getLeaveTypes(): Observable<LeaveType[]> {
    return this.http.get<LeaveType[]>(`${this.baseUrl}/types`);
  }

  // Leave Requests
  createLeaveRequest(request: {
    leaveTypeId: number;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
    isFirstHalfDay: boolean;
    isLastHalfDay: boolean;
  }): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(`${this.baseUrl}/request`, request);
  }

  approveLeaveRequest(id: number, approval: {
    status: LeaveRequestStatus.APPROVED | LeaveRequestStatus.REJECTED;
    approvalComments?: string;
  }): Observable<LeaveRequest> {
    return this.http.patch<LeaveRequest>(`${this.baseUrl}/request/${id}/approve`, approval);
  }

  getPendingLeaveRequests(): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(`${this.baseUrl}/requests/pending`);
  }

  getMyLeaveRequests(): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(`${this.baseUrl}/requests/my`);
  }

  getUserLeaveRequests(userId: number): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(`${this.baseUrl}/requests/user/${userId}`);
  }

  // Leave Balance
  getMyLeaveBalance(year: number): Observable<LeaveBalance[]> {
    const params = new HttpParams().set('year', year.toString());
    return this.http.get<LeaveBalance[]>(`${this.baseUrl}/balance/my`, { params });
  }

  getUserLeaveBalance(userId: number, year: number): Observable<LeaveBalance[]> {
    const params = new HttpParams().set('year', year.toString());
    return this.http.get<LeaveBalance[]>(`${this.baseUrl}/balance/user/${userId}`, { params });
  }

  initializeUserBalance(userId: number, data: {
    year: number;
    leaveTypeId: number;
    totalDays: number;
  }): Observable<LeaveBalance> {
    return this.http.post<LeaveBalance>(`${this.baseUrl}/balance/initialize/${userId}`, data);
  }
}
