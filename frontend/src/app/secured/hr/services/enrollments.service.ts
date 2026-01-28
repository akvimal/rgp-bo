import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  EmployeeBenefitEnrollment,
  CreateEnrollmentDto,
  UpdateEnrollmentDto,
  ApproveEnrollmentDto,
  BulkEnrollmentDto,
  EnrollmentStatus,
  BenefitPolicy
} from '../models/hr.models';

@Injectable({
  providedIn: 'root'
})
export class EnrollmentsService {
  private baseUrl = `${environment.apiHost}/hr/enrollments`;

  constructor(private http: HttpClient) {}

  /**
   * Enroll in a benefit
   */
  enrollInBenefit(enrollment: CreateEnrollmentDto): Observable<EmployeeBenefitEnrollment> {
    return this.http.post<EmployeeBenefitEnrollment>(this.baseUrl, enrollment);
  }

  /**
   * Get my enrollments
   */
  getMyEnrollments(): Observable<EmployeeBenefitEnrollment[]> {
    return this.http.get<EmployeeBenefitEnrollment[]>(`${this.baseUrl}/my`);
  }

  /**
   * Get all enrollments (admin)
   */
  getAllEnrollments(filters?: {
    status?: EnrollmentStatus;
    benefitPolicyId?: number;
  }): Observable<EmployeeBenefitEnrollment[]> {
    let params = new HttpParams();
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.benefitPolicyId) {
      params = params.set('benefitPolicyId', filters.benefitPolicyId.toString());
    }
    return this.http.get<EmployeeBenefitEnrollment[]>(`${this.baseUrl}/all`, { params });
  }

  /**
   * Get enrollment by ID
   */
  getEnrollmentById(id: number): Observable<EmployeeBenefitEnrollment> {
    return this.http.get<EmployeeBenefitEnrollment>(`${this.baseUrl}/${id}`);
  }

  /**
   * Update enrollment
   */
  updateEnrollment(id: number, enrollment: UpdateEnrollmentDto): Observable<EmployeeBenefitEnrollment> {
    return this.http.patch<EmployeeBenefitEnrollment>(`${this.baseUrl}/${id}`, enrollment);
  }

  /**
   * Cancel enrollment
   */
  cancelEnrollment(id: number, reason: string): Observable<void> {
    let params = new HttpParams().set('reason', reason);
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { params });
  }

  /**
   * Approve or reject enrollment
   */
  approveEnrollment(id: number, dto: ApproveEnrollmentDto): Observable<EmployeeBenefitEnrollment> {
    return this.http.patch<EmployeeBenefitEnrollment>(`${this.baseUrl}/${id}/approve`, dto);
  }

  /**
   * Bulk enroll users
   */
  bulkEnrollUsers(dto: BulkEnrollmentDto): Observable<{ success: number; failed: number; errors: any[] }> {
    return this.http.post<{ success: number; failed: number; errors: any[] }>(`${this.baseUrl}/bulk`, dto);
  }

  /**
   * Get available benefits for enrollment
   */
  getAvailableBenefits(): Observable<BenefitPolicy[]> {
    return this.http.get<BenefitPolicy[]>(`${this.baseUrl}/available`);
  }
}
