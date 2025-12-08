import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  apiurl = environment.apiHost;

  constructor(private http: HttpClient) {}

  /**
   * Calculate price with active pricing rules
   */
  calculatePriceWithRules(productId: number, data: any) {
    return this.http.post(`${this.apiurl}/products/${productId}/calculate-with-rules`, data);
  }

  /**
   * Calculate price without rules (manual calculation)
   */
  calculatePrice(data: any) {
    return this.http.post(`${this.apiurl}/products/calculate-price`, data);
  }

  /**
   * Compare different pricing strategies
   */
  comparePricingStrategies(data: any) {
    return this.http.post(`${this.apiurl}/products/compare-pricing`, data);
  }

  /**
   * Get all pricing rules
   */
  getPricingRules(filters?: any) {
    return this.http.get(`${this.apiurl}/products/pricing-rules`, { params: filters });
  }

  /**
   * Get pricing rules statistics
   */
  getPricingRulesStatistics() {
    return this.http.get(`${this.apiurl}/products/pricing-rules/statistics`);
  }

  /**
   * Create a new pricing rule
   */
  createPricingRule(data: any) {
    return this.http.post(`${this.apiurl}/products/pricing-rules`, data);
  }

  /**
   * Update a pricing rule
   */
  updatePricingRule(id: number, data: any) {
    return this.http.put(`${this.apiurl}/products/pricing-rules/${id}`, data);
  }

  /**
   * Activate a pricing rule
   */
  activatePricingRule(id: number) {
    return this.http.post(`${this.apiurl}/products/pricing-rules/${id}/activate`, {});
  }

  /**
   * Pause a pricing rule
   */
  pausePricingRule(id: number) {
    return this.http.post(`${this.apiurl}/products/pricing-rules/${id}/pause`, {});
  }

  /**
   * Delete a pricing rule
   */
  deletePricingRule(id: number) {
    return this.http.delete(`${this.apiurl}/products/pricing-rules/${id}`);
  }
}
