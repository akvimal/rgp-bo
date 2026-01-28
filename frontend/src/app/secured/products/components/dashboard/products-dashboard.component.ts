import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { ProductsService } from '../../products.service';

@Component({
  selector: 'app-products-dashboard',
  templateUrl: './products-dashboard.component.html',
  styleUrls: ['./products-dashboard.component.scss']
})
export class ProductsDashboardComponent implements OnInit {
  metrics: any = null;
  loading = true;
  error: string | null = null;
  Math = Math; // Expose Math to template

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
  public pieChartType: ChartType = 'pie';
  public doughnutChartType: ChartType = 'doughnut';

  // Chart data
  public categoryData: ChartData<'pie'> = {
    labels: [],
    datasets: []
  };

  public stockStatusData: ChartData<'doughnut'> = {
    labels: [],
    datasets: []
  };

  public marginData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  constructor(
    private productsService: ProductsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.loading = true;
    this.error = null;

    this.productsService.getDashboardMetrics().subscribe({
      next: (data) => {
        this.metrics = data;
        this.prepareChartData();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading metrics:', error);
        this.error = 'Failed to load dashboard metrics. Please try again.';
        this.loading = false;
      }
    });
  }

  prepareChartData(): void {
    if (!this.metrics) return;

    // Category Distribution Chart
    if (this.metrics.byCategory && this.metrics.byCategory.length > 0) {
      this.categoryData = {
        labels: this.metrics.byCategory.map((c: any) => c.category || 'Uncategorized'),
        datasets: [{
          data: this.metrics.byCategory.map((c: any) => parseInt(c.count)),
          backgroundColor: [
            '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
            '#858796', '#5a5c69', '#6610f2', '#e83e8c', '#fd7e14'
          ]
        }]
      };
    }

    // Stock Status Distribution Chart
    if (this.metrics.stockDistribution) {
      const stock = this.metrics.stockDistribution;
      this.stockStatusData = {
        labels: ['Out of Stock', 'Low Stock', 'In Stock'],
        datasets: [{
          data: [
            stock.outOfStock || 0,
            stock.lowStock || 0,
            stock.inStock || 0
          ],
          backgroundColor: [
            '#e74a3b',  // Out of Stock - Red
            '#f6c23e',  // Low Stock - Yellow
            '#1cc88a'   // In Stock - Green
          ]
        }]
      };
    }

    // Top/Low Margin Chart
    if (this.metrics.topProducts) {
      const topMargin = this.metrics.topProducts.byMargin.slice(0, 5);
      const lowMargin = this.metrics.topProducts.lowMargin.slice(0, 5);

      this.marginData = {
        labels: [
          ...topMargin.map((p: any) => `${p.title} (${p.pack})`),
          ...lowMargin.map((p: any) => `${p.title} (${p.pack})`)
        ],
        datasets: [{
          label: 'Margin %',
          data: [
            ...topMargin.map((p: any) => parseFloat(p.margin)),
            ...lowMargin.map((p: any) => parseFloat(p.margin))
          ],
          backgroundColor: [
            ...topMargin.map(() => '#1cc88a'),  // Green for high margin
            ...lowMargin.map(() => '#e74a3b')   // Red for low margin
          ]
        }]
      };
    }
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

  formatPercentage(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  navigateToProductList(filter?: any): void {
    this.router.navigate(['/secure/products/master'], { queryParams: filter });
  }

  navigateToNewProduct(): void {
    this.router.navigate(['/secure/products/master/new']);
  }

  navigateToProductEdit(id: number): void {
    this.router.navigate(['/secure/products/master/edit', id]);
  }

  getStockBadgeClass(stock: number): string {
    if (stock === 0) return 'badge bg-danger';
    if (stock < 20) return 'badge bg-warning text-dark';
    return 'badge bg-success';
  }

  getStockStatusText(stock: number): string {
    if (stock === 0) return 'Out of Stock';
    if (stock < 20) return 'Low Stock';
    return 'In Stock';
  }

  getMarginBadgeClass(margin: number): string {
    if (margin >= 20) return 'badge bg-success';
    if (margin >= 10) return 'badge bg-warning text-dark';
    return 'badge bg-danger';
  }

  refresh(): void {
    this.loadMetrics();
  }
}
