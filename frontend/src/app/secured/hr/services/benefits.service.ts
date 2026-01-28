import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  BenefitMaster,
  BenefitPolicy,
  CreateBenefitMasterDto,
  CreateBenefitPolicyDto,
  UpdateBenefitPolicyDto,
  BenefitCategory
} from '../models/hr.models';

@Injectable({
  providedIn: 'root'
})
export class BenefitsService {
  private baseUrl = `${environment.apiHost}/hr/benefits`;

  constructor(private http: HttpClient) {}

  // ===================================
  // BENEFIT MASTERS (Types)
  // ===================================

  /**
   * Get all benefit types
   */
  getAllBenefitMasters(filters?: {
    category?: BenefitCategory;
    active?: boolean;
  }): Observable<BenefitMaster[]> {
    let params = new HttpParams();
    if (filters?.category) {
      params = params.set('category', filters.category);
    }
    if (filters?.active !== undefined) {
      params = params.set('active', filters.active.toString());
    }
    return this.http.get<BenefitMaster[]>(`${this.baseUrl}/master`, { params });
  }

  /**
   * Get benefit master by ID
   */
  getBenefitMasterById(id: number): Observable<BenefitMaster> {
    return this.http.get<BenefitMaster>(`${this.baseUrl}/master/${id}`);
  }

  /**
   * Create benefit master
   */
  createBenefitMaster(benefit: CreateBenefitMasterDto): Observable<BenefitMaster> {
    return this.http.post<BenefitMaster>(`${this.baseUrl}/master`, benefit);
  }

  /**
   * Update benefit master
   */
  updateBenefitMaster(id: number, benefit: CreateBenefitMasterDto): Observable<BenefitMaster> {
    return this.http.patch<BenefitMaster>(`${this.baseUrl}/master/${id}`, benefit);
  }

  /**
   * Archive benefit master
   */
  archiveBenefitMaster(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/master/${id}`);
  }

  // ===================================
  // BENEFIT POLICIES
  // ===================================

  /**
   * Get all benefit policies
   */
  getAllBenefitPolicies(filters?: {
    benefitId?: number;
    active?: boolean;
  }): Observable<BenefitPolicy[]> {
    let params = new HttpParams();
    if (filters?.benefitId) {
      params = params.set('benefitId', filters.benefitId.toString());
    }
    if (filters?.active !== undefined) {
      params = params.set('active', filters.active.toString());
    }
    return this.http.get<BenefitPolicy[]>(`${this.baseUrl}/policies`, { params });
  }

  /**
   * Get benefit policy by ID
   */
  getBenefitPolicyById(id: number): Observable<BenefitPolicy> {
    return this.http.get<BenefitPolicy>(`${this.baseUrl}/policies/${id}`);
  }

  /**
   * Create benefit policy
   */
  createBenefitPolicy(policy: CreateBenefitPolicyDto): Observable<BenefitPolicy> {
    return this.http.post<BenefitPolicy>(`${this.baseUrl}/policies`, policy);
  }

  /**
   * Update benefit policy
   */
  updateBenefitPolicy(id: number, policy: UpdateBenefitPolicyDto): Observable<BenefitPolicy> {
    return this.http.patch<BenefitPolicy>(`${this.baseUrl}/policies/${id}`, policy);
  }

  /**
   * Archive benefit policy
   */
  archiveBenefitPolicy(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/policies/${id}`);
  }

  // ===================================
  // USER BENEFITS
  // ===================================

  /**
   * Get my enrolled benefits
   */
  getMyBenefits(): Observable<BenefitPolicy[]> {
    return this.http.get<BenefitPolicy[]>(`${this.baseUrl}/my`);
  }

  /**
   * Get eligible benefits for current user
   */
  getEligibleBenefits(): Observable<BenefitPolicy[]> {
    return this.http.get<BenefitPolicy[]>(`${this.baseUrl}/eligible`);
  }

  /**
   * Calculate benefit amount for user
   */
  calculateBenefitAmount(policyId: number, salary?: number): Observable<{ amount: number; breakdown: any }> {
    let params = new HttpParams();
    if (salary) {
      params = params.set('salary', salary.toString());
    }
    return this.http.get<{ amount: number; breakdown: any }>(`${this.baseUrl}/calculate/${policyId}`, { params });
  }
}
