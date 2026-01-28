import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import {
  PurchaseAnalyticsService,
  PurchaseAnalytics,
  PurchaseSummary
} from '../services/purchase-analytics.service';

@Component({
  selector: 'app-purchases-dashboard',
  templateUrl: './purchases-dashboard.component.html',
  styleUrls: ['./purchases-dashboard.component.scss']
})
export class PurchasesDashboardComponent implements OnInit {
  analytics: PurchaseAnalytics | null = null;
  loading = true;
  error: string | null = null;

  // Chart configurations
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      x: {},
      y: { beginAtZero: true }
    }
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      x: {},
      y: { beginAtZero: true }
    }
  };

  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' }
    }
  };

  public doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' }
    }
  };

  // Chart types
  public barChartType: ChartType = 'bar';
  public lineChartType: ChartType = 'line';
  public pieChartType: ChartType = 'pie';
  public doughnutChartType: ChartType = 'doughnut';

  // Chart data
  public monthlyTrendData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };

  public statusBreakdownData: ChartData<'doughnut'> = {
    labels: [],
    datasets: []
  };

  public topVendorsData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  public categorySpendingData: ChartData<'pie'> = {
    labels: [],
    datasets: []
  };

  constructor(
    private analyticsService: PurchaseAnalyticsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.loading = true;
    this.error = null;

    this.analyticsService.getAnalytics().subscribe({
      next: (data) => {
        this.analytics = data;
        this.prepareChartData();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading analytics:', error);
        this.error = 'Failed to load analytics data. Please try again.';
        this.loading = false;
      }
    });
  }

  prepareChartData(): void {
    if (!this.analytics) return;

    // Monthly Trends Chart
    this.monthlyTrendData = {
      labels: this.analytics.monthlyTrends.map(t => t.month),
      datasets: [
        {
          label: 'Purchase Value (₹)',
          data: this.analytics.monthlyTrends.map(t => t.totalValue),
          borderColor: '#4e73df',
          backgroundColor: 'rgba(78, 115, 223, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Invoice Count',
          data: this.analytics.monthlyTrends.map(t => t.invoiceCount),
          borderColor: '#1cc88a',
          backgroundColor: 'rgba(28, 200, 138, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    };

    // Update line chart options to include second y-axis
    this.lineChartOptions = {
      ...this.lineChartOptions,
      scales: {
        x: {},
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: true
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: true,
          grid: {
            drawOnChartArea: false
          }
        }
      }
    };

    // Status Breakdown Chart
    this.statusBreakdownData = {
      labels: this.analytics.statusBreakdown.map(s => s.status),
      datasets: [{
        data: this.analytics.statusBreakdown.map(s => s.count),
        backgroundColor: [
          '#4e73df',
          '#1cc88a',
          '#36b9cc',
          '#f6c23e',
          '#e74a3b'
        ]
      }]
    };

    // Top Vendors Chart
    this.topVendorsData = {
      labels: this.analytics.topVendors.map(v => v.vendorName),
      datasets: [{
        label: 'Purchase Value (₹)',
        data: this.analytics.topVendors.map(v => v.totalPurchaseValue),
        backgroundColor: '#4e73df'
      }]
    };

    // Category Spending Chart
    if (this.analytics.categorySpending.length > 0) {
      this.categorySpendingData = {
        labels: this.analytics.categorySpending.map(c => c.category),
        datasets: [{
          data: this.analytics.categorySpending.map(c => c.totalSpending),
          backgroundColor: [
            '#4e73df',
            '#1cc88a',
            '#36b9cc',
            '#f6c23e',
            '#e74a3b',
            '#858796'
          ]
        }]
      };
    }
  }

  get summary(): PurchaseSummary | null {
    return this.analytics?.summary || null;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-IN').format(value);
  }

  getChangeClass(percentage: number): string {
    if (percentage > 0) return 'text-success';
    if (percentage < 0) return 'text-danger';
    return 'text-muted';
  }

  getChangeIcon(percentage: number): string {
    if (percentage > 0) return 'bi-arrow-up';
    if (percentage < 0) return 'bi-arrow-down';
    return 'bi-dash';
  }

  navigateToInvoices(): void {
    this.router.navigate(['/purchases/invoices']);
  }

  navigateToOrders(): void {
    this.router.navigate(['/purchases/orders']);
  }

  navigateToVendors(): void {
    this.router.navigate(['/purchases/vendors']);
  }

  createNewInvoice(): void {
    this.router.navigate(['/purchases/invoices/new']);
  }

  createPurchaseOrder(): void {
    this.router.navigate(['/purchases/orders/new']);
  }

  viewInvoice(id: number): void {
    this.router.navigate(['/purchases/invoices/edit', id]);
  }

  navigateToNearExpiry(): void {
    this.router.navigate(['/secure/store/stock/near-expiry']);
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'OPEN': 'badge-primary',
      'CLOSED': 'badge-success',
      'CANCELLED': 'badge-danger',
      'PAID': 'badge-success',
      'UNPAID': 'badge-warning',
      'PARTIAL': 'badge-info'
    };
    return statusMap[status] || 'badge-secondary';
  }

  getOverdueClass(days: number): string {
    if (days > 30) return 'text-danger fw-bold';
    if (days > 15) return 'text-warning';
    return 'text-muted';
  }
}
