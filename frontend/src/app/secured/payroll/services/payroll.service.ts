import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  PayrollRun,
  PayrollRunWithDetails,
  PayrollDetail,
  CreatePayrollRunDto,
  CalculatePayrollDto,
  CalculatePayrollResponse
} from '../models/payroll.models';

@Injectable({
  providedIn: 'root'
})
export class PayrollService {
  private readonly API_URL = `${environment.apiHost}/payroll`;

  constructor(private http: HttpClient) {}

  /**
   * Create a new payroll run
   */
  createPayrollRun(data: CreatePayrollRunDto): Observable<PayrollRun> {
    return this.http.post<PayrollRun>(`${this.API_URL}/run`, data);
  }

  /**
   * Calculate payroll for a run (all employees or specific ones)
   */
  calculatePayroll(data: CalculatePayrollDto): Observable<CalculatePayrollResponse> {
    return this.http.post<CalculatePayrollResponse>(`${this.API_URL}/calculate`, data);
  }

  /**
   * Get payroll run by ID
   */
  getPayrollRun(id: number): Observable<PayrollRun> {
    return this.http.get<PayrollRun>(`${this.API_URL}/run/${id}`);
  }

  /**
   * Get payroll run with all employee details
   */
  getPayrollRunWithDetails(id: number): Observable<PayrollRunWithDetails> {
    return this.http.get<PayrollRunWithDetails>(`${this.API_URL}/run/${id}/details`);
  }

  /**
   * Get all payroll runs (optionally filtered by year)
   */
  getAllPayrollRuns(year?: number): Observable<PayrollRun[]> {
    let params = new HttpParams();
    if (year) {
      params = params.set('year', year.toString());
    }
    return this.http.get<PayrollRun[]>(`${this.API_URL}/runs`, { params });
  }

  /**
   * Approve a payroll run
   */
  approvePayrollRun(id: number, remarks?: string): Observable<PayrollRun> {
    return this.http.post<PayrollRun>(`${this.API_URL}/run/${id}/approve`, { remarks });
  }

  /**
   * Get employee payroll detail (payslip)
   */
  getEmployeePayslip(payrollRunId: number, userId: number): Observable<PayrollDetail> {
    return this.http.get<PayrollDetail>(
      `${this.API_URL}/run/${payrollRunId}/employee/${userId}`
    );
  }

  /**
   * Helper: Get current month and year
   */
  getCurrentPeriod(): { year: number; month: number } {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };
  }

  /**
   * Helper: Format currency
   */
  formatCurrency(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(num);
  }

  /**
   * Helper: Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    const statusClasses: Record<string, string> = {
      'DRAFT': 'badge-secondary',
      'CALCULATED': 'badge-info',
      'APPROVED': 'badge-success',
      'PAYMENT_REQUESTED': 'badge-warning',
      'PAYMENT_PROCESSING': 'badge-primary',
      'COMPLETED': 'badge-success',
      'CANCELLED': 'badge-danger'
    };
    return statusClasses[status] || 'badge-secondary';
  }

  /**
   * Helper: Check if action is allowed based on status
   */
  canCalculate(status: string): boolean {
    return status === 'DRAFT';
  }

  canApprove(status: string): boolean {
    return status === 'CALCULATED';
  }

  canRequestPayment(status: string): boolean {
    return status === 'APPROVED';
  }
}
