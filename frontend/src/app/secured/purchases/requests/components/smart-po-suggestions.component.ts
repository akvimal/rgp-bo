import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { PurchaseOrderService } from '../purchase-order.service';

interface POSuggestionItem {
  productId: number;
  productName: string;
  currentStock?: number;
  reorderLimit?: number;
  suggestedQuantity: number;
  reason: string;
  priority?: string;
  lastVendorId?: number;
  lastVendorName?: string;
  preferredVendorId?: number;
  preferredVendorName?: string;
  lastPurchaseDate?: Date;
  lastPurchasePrice?: number;
  salesIntentIds?: number[];
  selected?: boolean;
}

interface POSuggestionsResponse {
  lowStockItems: POSuggestionItem[];
  salesIntentItems: POSuggestionItem[];
  storeId: number;
  storeName: string;
  totalSuggestions: number;
}

@Component({
  selector: 'app-smart-po-suggestions',
  templateUrl: './smart-po-suggestions.component.html'
})
export class SmartPOSuggestionsComponent implements OnInit {
  loading = false;
  suggestions: POSuggestionsResponse | null = null;
  selectedStoreId = 1; // Default store ID

  lowStockItems: POSuggestionItem[] = [];
  salesIntentItems: POSuggestionItem[] = [];

  constructor(
    private poService: PurchaseOrderService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadSuggestions();
  }

  loadSuggestions() {
    this.loading = true;
    this.poService.getSmartSuggestions(this.selectedStoreId).subscribe({
      next: (data: POSuggestionsResponse) => {
        this.suggestions = data;
        this.lowStockItems = data.lowStockItems.map(item => ({ ...item, selected: false }));
        this.salesIntentItems = data.salesIntentItems.map(item => ({ ...item, selected: false }));
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load purchase order suggestions'
        });
        this.loading = false;
      }
    });
  }

  getSelectedItems(): POSuggestionItem[] {
    return [...this.lowStockItems, ...this.salesIntentItems].filter(item => item.selected);
  }

  hasSelection(): boolean {
    return this.getSelectedItems().length > 0;
  }

  createPurchaseOrder() {
    const selected = this.getSelectedItems();
    if (selected.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select at least one item'
      });
      return;
    }

    // Group by preferred vendor or last vendor
    const vendorGroups = new Map<number, POSuggestionItem[]>();
    selected.forEach(item => {
      const vendorId = item.preferredVendorId || item.lastVendorId || 0;
      if (!vendorGroups.has(vendorId)) {
        vendorGroups.set(vendorId, []);
      }
      vendorGroups.get(vendorId)!.push(item);
    });

    // Navigate to purchase order creation with selected items
    this.router.navigate(['/purchases/orders/new'], {
      state: { suggestions: selected }
    });
  }

  getPriorityClass(priority?: string): string {
    switch(priority) {
      case 'URGENT': return 'badge bg-danger';
      case 'HIGH': return 'badge bg-warning';
      case 'MEDIUM': return 'badge bg-info';
      default: return 'badge bg-secondary';
    }
  }

  formatDate(date?: Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }

  formatCurrency(amount?: number): string {
    if (amount == null) return 'N/A';
    return `₹${amount.toFixed(2)}`;
  }

  selectAllLowStock(event: any) {
    const checked = event.target.checked;
    this.lowStockItems.forEach(item => item.selected = checked);
  }

  selectAllSalesIntent(event: any) {
    const checked = event.target.checked;
    this.salesIntentItems.forEach(item => item.selected = checked);
  }
}
