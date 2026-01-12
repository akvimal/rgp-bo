import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HsnService {
  private apiurl = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  // Get all HSN tax codes with optional filters
  getAllHsnTaxCodes(filters?: { category?: string; activeOnly?: boolean; search?: string }): Observable<any> {
    const params: any = {};
    if (filters?.category) params.category = filters.category;
    if (filters?.activeOnly) params.activeOnly = filters.activeOnly.toString();
    if (filters?.search) params.search = filters.search;

    return this.http.get(`${this.apiurl}/products/hsn-tax`, { params });
  }

  // Get HSN tax statistics
  getStatistics(): Observable<any> {
    return this.http.get(`${this.apiurl}/products/hsn-tax/statistics`);
  }

  // Get tax categories
  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiurl}/products/hsn-tax/categories`);
  }

  // Get HSN tax by ID
  getHsnTaxById(id: number): Observable<any> {
    return this.http.get(`${this.apiurl}/products/hsn-tax/${id}`);
  }

  // Get HSN tax by code
  getHsnTaxByCode(code: string): Observable<any> {
    return this.http.get(`${this.apiurl}/products/hsn-tax/code/${code}`);
  }

  // Get tax rate for HSN code (simpler response with just rates)
  getTaxRateForHsn(code: string, date?: string): Observable<any> {
    const params: any = {};
    if (date) params.date = date;
    return this.http.get(`${this.apiurl}/products/hsn-tax/code/${code}/rate`, { params });
  }

  // Create new HSN tax
  createHsnTax(data: any): Observable<any> {
    return this.http.post(`${this.apiurl}/products/hsn-tax`, data);
  }

  // Update HSN tax
  updateHsnTax(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiurl}/products/hsn-tax/${id}`, data);
  }

  // Delete HSN tax
  deleteHsnTax(id: number): Observable<any> {
    return this.http.delete(`${this.apiurl}/products/hsn-tax/${id}`);
  }
}
