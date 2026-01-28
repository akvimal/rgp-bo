import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface NearExpiryBatch {
  id: number;
  title: string;
  batch_number: string;
  expiry_date: string;
  quantity_remaining: number;
  value_at_risk: string;
  days_to_expiry: number;
}

interface NearExpiryResponse {
  threshold: number;
  count: number;
  totalValueAtRisk: number;
  batches: NearExpiryBatch[];
}

@Component({
  selector: 'app-near-expiry-dashboard',
  templateUrl: './near-expiry-dashboard.component.html',
  styleUrls: ['./near-expiry-dashboard.component.scss']
})
export class NearExpiryDashboardComponent implements OnInit {
  private apiUrl = environment.apiHost;

  // Tab state
  selectedThreshold: number = 30;
  thresholds = [
    { value: 30, label: '30 Days', severity: 'CRITICAL', color: 'danger' },
    { value: 60, label: '60 Days', severity: 'WARNING', color: 'warning' },
    { value: 90, label: '90 Days', severity: 'CAUTION', color: 'info' }
  ];

  // Data
  batches30: NearExpiryBatch[] = [];
  batches60: NearExpiryBatch[] = [];
  batches90: NearExpiryBatch[] = [];

  // Summary stats
  totalValueAtRisk30 = 0;
  totalValueAtRisk60 = 0;
  totalValueAtRisk90 = 0;

  count30 = 0;
  count60 = 0;
  count90 = 0;

  // UI state
  loading = false;
  error: string | null = null;

  // Filter state
  searchTerm = '';
  sortField: 'days_to_expiry' | 'value_at_risk' | 'quantity_remaining' = 'days_to_expiry';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAllData();
  }

  /**
   * Load data for all three thresholds
   */
  async loadAllData() {
    this.loading = true;
    this.error = null;

    try {
      await Promise.all([
        this.loadNearExpiryBatches(30),
        this.loadNearExpiryBatches(60),
        this.loadNearExpiryBatches(90)
      ]);
    } catch (error: any) {
      this.error = error.message || 'Failed to load near-expiry data';
      console.error('Error loading near-expiry data:', error);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load near-expiry batches for a specific threshold
   */
  async loadNearExpiryBatches(threshold: number): Promise<void> {
    try {
      const response = await this.http
        .get<NearExpiryResponse>(`${this.apiUrl}/batch/near-expiry/${threshold}`)
        .toPromise();

      if (!response) return;

      // Store data based on threshold
      switch (threshold) {
        case 30:
          this.batches30 = response.batches;
          this.totalValueAtRisk30 = response.totalValueAtRisk;
          this.count30 = response.count;
          break;
        case 60:
          this.batches60 = response.batches;
          this.totalValueAtRisk60 = response.totalValueAtRisk;
          this.count60 = response.count;
          break;
        case 90:
          this.batches90 = response.batches;
          this.totalValueAtRisk90 = response.totalValueAtRisk;
          this.count90 = response.count;
          break;
      }
    } catch (error: any) {
      console.error(`Error loading ${threshold}-day near-expiry batches:`, error);
      throw error;
    }
  }

  /**
   * Get batches for currently selected threshold
   */
  get currentBatches(): NearExpiryBatch[] {
    let batches: NearExpiryBatch[] = [];

    switch (this.selectedThreshold) {
      case 30:
        batches = this.batches30;
        break;
      case 60:
        batches = this.batches60;
        break;
      case 90:
        batches = this.batches90;
        break;
    }

    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      batches = batches.filter(b =>
        b.title.toLowerCase().includes(term) ||
        b.batch_number.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    batches = [...batches].sort((a, b) => {
      const aVal = this.getSortValue(a, this.sortField);
      const bVal = this.getSortValue(b, this.sortField);

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return batches;
  }

  /**
   * Get current tab configuration
   */
  get currentTab() {
    return this.thresholds.find(t => t.value === this.selectedThreshold);
  }

  /**
   * Get current value at risk
   */
  get currentValueAtRisk(): number {
    switch (this.selectedThreshold) {
      case 30: return this.totalValueAtRisk30;
      case 60: return this.totalValueAtRisk60;
      case 90: return this.totalValueAtRisk90;
      default: return 0;
    }
  }

  /**
   * Get current count
   */
  get currentCount(): number {
    switch (this.selectedThreshold) {
      case 30: return this.count30;
      case 60: return this.count60;
      case 90: return this.count90;
      default: return 0;
    }
  }

  /**
   * Select a threshold tab
   */
  selectThreshold(threshold: number) {
    this.selectedThreshold = threshold;
  }

  /**
   * Get sort value for a batch based on field
   */
  private getSortValue(batch: NearExpiryBatch, field: string): number {
    switch (field) {
      case 'days_to_expiry':
        return batch.days_to_expiry;
      case 'value_at_risk':
        return parseFloat(batch.value_at_risk);
      case 'quantity_remaining':
        return batch.quantity_remaining;
      default:
        return 0;
    }
  }

  /**
   * Sort batches by field
   */
  sortBy(field: 'days_to_expiry' | 'value_at_risk' | 'quantity_remaining') {
    if (this.sortField === field) {
      // Toggle direction
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Change field, default to ascending
      this.sortField = field;
      this.sortDirection = 'asc';
    }
  }

  /**
   * Get severity class for a batch based on days to expiry
   */
  getSeverityClass(batch: NearExpiryBatch): string {
    if (batch.days_to_expiry <= 10) return 'text-danger fw-bold';
    if (batch.days_to_expiry <= 20) return 'text-danger';
    if (batch.days_to_expiry <= 30) return 'text-warning';
    if (batch.days_to_expiry <= 60) return 'text-warning';
    return 'text-info';
  }

  /**
   * Get priority badge class
   */
  getPriorityBadge(batch: NearExpiryBatch): string {
    if (batch.days_to_expiry <= 10) return 'badge bg-danger';
    if (batch.days_to_expiry <= 30) return 'badge bg-warning';
    if (batch.days_to_expiry <= 60) return 'badge bg-info';
    return 'badge bg-secondary';
  }

  /**
   * Get priority text
   */
  getPriorityText(batch: NearExpiryBatch): string {
    if (batch.days_to_expiry <= 10) return 'URGENT';
    if (batch.days_to_expiry <= 30) return 'HIGH';
    if (batch.days_to_expiry <= 60) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Export to Excel (CSV format)
   */
  exportToExcel() {
    const batches = this.currentBatches;

    if (batches.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV content
    const headers = ['Product', 'Batch Number', 'Expiry Date', 'Days to Expiry', 'Quantity', 'Value at Risk'];
    const rows = batches.map(b => [
      b.title,
      b.batch_number,
      b.expiry_date,
      b.days_to_expiry.toString(),
      b.quantity_remaining.toString(),
      `₹${parseFloat(b.value_at_risk).toFixed(2)}`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `near-expiry-${this.selectedThreshold}days-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Refresh data
   */
  refresh() {
    this.loadAllData();
  }

  /**
   * Mark batch for discount (placeholder - implement based on your pricing system)
   */
  markForDiscount(batch: NearExpiryBatch) {
    // TODO: Implement pricing rule creation for clearance
    console.log('Mark for discount:', batch);
    alert(`Discount action for ${batch.title} - Batch ${batch.batch_number}\nThis feature needs to be implemented based on your pricing rule system.`);
  }

  /**
   * Initiate return to vendor (placeholder)
   */
  returnToVendor(batch: NearExpiryBatch) {
    // TODO: Implement vendor return flow
    console.log('Return to vendor:', batch);
    alert(`Return to vendor action for ${batch.title} - Batch ${batch.batch_number}\nThis feature needs to be implemented based on your returns system.`);
  }
}
