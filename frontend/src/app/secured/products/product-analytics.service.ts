import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ProductSummary {
  totalActiveProducts: number;
  totalStockValue: number;
  averageMargin: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryCount: number;
  nearExpiryCount: number;
  deadStockCount: number;
}

export interface TopProduct {
  productId: number;
  productTitle: string;
  category: string;
  totalRevenue: number;
  qtySold: number;
  averagePrice: number;
  marginPercentage: number;
}

export interface CategoryPerformance {
  category: string;
  productCount: number;
  totalRevenue: number;
  stockValue: number;
  averageMargin: number;
  revenuePercentage: number;
}

export interface StockStatus {
  status: string;
  count: number;
  value: number;
  percentage: number;
}

export interface MarginDistribution {
  category: string;
  minMargin: number;
  avgMargin: number;
  maxMargin: number;
  productCount: number;
}

export interface LowStockAlert {
  productId: number;
  productTitle: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  avgMonthlySales: number;
  daysUntilStockOut: number;
}

export interface PriceChange {
  productId: number;
  productTitle: string;
  oldPrice: number;
  newPrice: number;
  changePercentage: number;
  effectiveDate: string;
  reason: string;
}

export interface ProductAnalytics {
  summary: ProductSummary;
  topProducts: TopProduct[];
  categoryPerformance: CategoryPerformance[];
  stockStatus: StockStatus[];
  marginDistribution: MarginDistribution[];
  lowStockAlerts: LowStockAlert[];
  recentPriceChanges: PriceChange[];
}

@Injectable({
  providedIn: 'root'
})
export class ProductAnalyticsService {
  private apiUrl = `${environment.apiHost}/analytics/products`;

  constructor(private http: HttpClient) {}

  getAnalytics(): Observable<ProductAnalytics> {
    return this.http.get<ProductAnalytics>(this.apiUrl);
  }
}
