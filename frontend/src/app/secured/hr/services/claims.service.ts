import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  BenefitClaim,
  SubmitClaimDto,
  ReviewClaimDto,
  ApproveClaimDto,
  RejectClaimDto,
  PayClaimDto,
  ClaimStatus,
  ClaimType
} from '../models/hr.models';

@Injectable({
  providedIn: 'root'
})
export class ClaimsService {
  private baseUrl = `${environment.apiHost}/hr/claims`;

  constructor(private http: HttpClient) {}

  /**
   * Submit a new claim
   */
  submitClaim(claim: SubmitClaimDto): Observable<BenefitClaim> {
    return this.http.post<BenefitClaim>(this.baseUrl, claim);
  }

  /**
   * Get all claims (admin)
   */
  getAllClaims(filters?: {
    status?: ClaimStatus;
    claimType?: ClaimType;
    userId?: number;
  }): Observable<BenefitClaim[]> {
    let params = new HttpParams();
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.claimType) {
      params = params.set('claimType', filters.claimType);
    }
    if (filters?.userId) {
      params = params.set('userId', filters.userId.toString());
    }
    return this.http.get<BenefitClaim[]>(`${this.baseUrl}/all`, { params });
  }

  /**
   * Get my claims
   */
  getMyClaims(): Observable<BenefitClaim[]> {
    return this.http.get<BenefitClaim[]>(`${this.baseUrl}/my`);
  }

  /**
   * Get pending claims for review
   */
  getPendingClaims(): Observable<BenefitClaim[]> {
    return this.http.get<BenefitClaim[]>(`${this.baseUrl}/pending`);
  }

  /**
   * Get claim by ID
   */
  getClaimById(id: number): Observable<BenefitClaim> {
    return this.http.get<BenefitClaim>(`${this.baseUrl}/${id}`);
  }

  /**
   * Review claim
   */
  reviewClaim(id: number, dto: ReviewClaimDto): Observable<BenefitClaim> {
    return this.http.patch<BenefitClaim>(`${this.baseUrl}/${id}/review`, dto);
  }

  /**
   * Approve claim
   */
  approveClaim(id: number, dto: ApproveClaimDto): Observable<BenefitClaim> {
    return this.http.patch<BenefitClaim>(`${this.baseUrl}/${id}/approve`, dto);
  }

  /**
   * Reject claim
   */
  rejectClaim(id: number, dto: RejectClaimDto): Observable<BenefitClaim> {
    return this.http.patch<BenefitClaim>(`${this.baseUrl}/${id}/reject`, dto);
  }

  /**
   * Mark claim as paid
   */
  markClaimAsPaid(id: number, dto: PayClaimDto): Observable<BenefitClaim> {
    return this.http.patch<BenefitClaim>(`${this.baseUrl}/${id}/pay`, dto);
  }

  /**
   * Upload claim documents
   */
  uploadClaimDocuments(claimId: number, formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/${claimId}/documents`, formData);
  }
}
