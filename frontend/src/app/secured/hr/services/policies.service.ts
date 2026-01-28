import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  HrPolicyMaster,
  HrPolicyAcknowledgment,
  CreateHrPolicyDto,
  UpdateHrPolicyDto,
  AcknowledgePolicyDto,
  PolicyCategory
} from '../models/hr.models';

@Injectable({
  providedIn: 'root'
})
export class PoliciesService {
  private baseUrl = `${environment.apiHost}/hr/policies`;

  constructor(private http: HttpClient) {}

  /**
   * Get all HR policies
   */
  getAllPolicies(filters?: {
    category?: PolicyCategory;
    active?: boolean;
    mandatory?: boolean;
  }): Observable<HrPolicyMaster[]> {
    let params = new HttpParams();
    if (filters?.category) {
      params = params.set('category', filters.category);
    }
    if (filters?.active !== undefined) {
      params = params.set('active', filters.active.toString());
    }
    if (filters?.mandatory !== undefined) {
      params = params.set('mandatory', filters.mandatory.toString());
    }
    return this.http.get<HrPolicyMaster[]>(this.baseUrl, { params });
  }

  /**
   * Get my applicable policies
   */
  getMyPolicies(): Observable<HrPolicyMaster[]> {
    return this.http.get<HrPolicyMaster[]>(`${this.baseUrl}/my`);
  }

  /**
   * Get policy by ID
   */
  getPolicyById(id: number): Observable<HrPolicyMaster> {
    return this.http.get<HrPolicyMaster>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get policy by code
   */
  getPolicyByCode(code: string): Observable<HrPolicyMaster> {
    return this.http.get<HrPolicyMaster>(`${this.baseUrl}/code/${code}`);
  }

  /**
   * Get policy acknowledgments
   */
  getPolicyAcknowledgments(policyId: number): Observable<HrPolicyAcknowledgment[]> {
    return this.http.get<HrPolicyAcknowledgment[]>(`${this.baseUrl}/${policyId}/acknowledgments`);
  }

  /**
   * Get policy version history
   */
  getPolicyHistory(code: string): Observable<HrPolicyMaster[]> {
    return this.http.get<HrPolicyMaster[]>(`${this.baseUrl}/history/${code}`);
  }

  /**
   * Create new policy
   */
  createPolicy(policy: CreateHrPolicyDto): Observable<HrPolicyMaster> {
    return this.http.post<HrPolicyMaster>(this.baseUrl, policy);
  }

  /**
   * Update policy
   */
  updatePolicy(id: number, policy: UpdateHrPolicyDto): Observable<HrPolicyMaster> {
    return this.http.patch<HrPolicyMaster>(`${this.baseUrl}/${id}`, policy);
  }

  /**
   * Archive policy
   */
  archivePolicy(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Acknowledge policy
   */
  acknowledgePolicy(policyId: number, dto?: AcknowledgePolicyDto): Observable<HrPolicyAcknowledgment> {
    return this.http.post<HrPolicyAcknowledgment>(`${this.baseUrl}/${policyId}/acknowledge`, dto || {});
  }
}
