import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { ProductsService } from '../../../products/products.service';
import { VendorsService } from '../../vendors/vendors.service';
import { PurchaseOrderService } from '../purchase-order.service';
import { PurchaseIntentService } from '../../../store/intent/purchase-intent.service';

interface POItem {
  productId: number;
  productName: string;
  qty: number;
  expectedPrice?: number;
  comments?: string;
}

@Component({
  selector: 'app-purchase-order-form-enhanced',
  templateUrl: './purchase-order-form-enhanced.component.html',
  styleUrls: ['./purchase-order-form-enhanced.component.scss']
})
export class PurchaseOrderFormEnhancedComponent implements OnInit {

  form: FormGroup = new FormGroup({
    vendorid: new FormControl('', Validators.required),
    ponumber: new FormControl(''),
    comments: new FormControl('')
  });

  // Product search
  productSearchControl = new FormControl('');
  productSuggestions: any[] = [];
  selectedProduct: any = null;

  // Item management
  items: POItem[] = [];

  // Item form for adding products
  itemForm: FormGroup = new FormGroup({
    qty: new FormControl(1, [Validators.required, Validators.min(1)]),
    expectedPrice: new FormControl(''),
    comments: new FormControl('')
  });

  // Data
  vendors: any[] = [];
  loading = false;
  saving = false;

  // Dialog state
  showIntentsDialog = false;
  showSuggestionsDialog = false;
  loadingIntents = false;
  loadingSuggestions = false;

  // Import data
  salesIntents: any[] = [];
  smartSuggestions: any = null;

  constructor(
    private productsService: ProductsService,
    private vendorsService: VendorsService,
    private poService: PurchaseOrderService,
    private intentService: PurchaseIntentService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadVendors();
    this.setupProductSearch();
  }

  loadVendors() {
    this.vendorsService.findAll().subscribe({
      next: (data: any) => {
        this.vendors = data;
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load vendors'
        });
      }
    });
  }

  setupProductSearch() {
    this.productSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => {
          if (!term || term.length < 2) {
            return of([]);
          }
          return this.productsService.search(term);
        })
      )
      .subscribe({
        next: (results: any) => {
          this.productSuggestions = Array.isArray(results) ? results : [];
        },
        error: () => {
          this.productSuggestions = [];
        }
      });
  }

  onProductSelect(product: any) {
    this.selectedProduct = product;
    this.productSearchControl.setValue('');
    this.productSuggestions = [];
    this.itemForm.patchValue({ qty: 1 });
  }

  addItem() {
    if (!this.selectedProduct || !this.itemForm.valid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please select a product and enter quantity'
      });
      return;
    }

    // Check if product already exists
    const exists = this.items.find(i => i.productId === this.selectedProduct.id);
    if (exists) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Duplicate Product',
        detail: 'This product is already in the list'
      });
      return;
    }

    const item: POItem = {
      productId: this.selectedProduct.id,
      productName: this.selectedProduct.title,
      qty: this.itemForm.value.qty,
      expectedPrice: this.itemForm.value.expectedPrice || undefined,
      comments: this.itemForm.value.comments || undefined
    };

    this.items.push(item);

    // Reset
    this.selectedProduct = null;
    this.itemForm.reset({ qty: 1 });

    this.messageService.add({
      severity: 'success',
      summary: 'Item Added',
      detail: `${item.productName} added to order`
    });
  }

  removeItem(index: number) {
    const item = this.items[index];
    this.items.splice(index, 1);
    this.messageService.add({
      severity: 'info',
      summary: 'Item Removed',
      detail: `${item.productName} removed from order`
    });
  }

  getTotalItems(): number {
    return this.items.reduce((sum, item) => sum + item.qty, 0);
  }

  getEstimatedTotal(): number {
    return this.items.reduce((sum, item) => {
      const price = item.expectedPrice || 0;
      return sum + (price * item.qty);
    }, 0);
  }

  onSave() {
    if (!this.form.valid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please select a vendor'
      });
      return;
    }

    if (this.items.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Items',
        detail: 'Please add at least one product'
      });
      return;
    }

    this.saving = true;

    const payload = {
      vendorid: this.form.value.vendorid,
      ponumber: this.form.value.ponumber,
      comments: this.form.value.comments,
      items: this.items.map(item => ({
        productId: item.productId,
        qty: item.qty,
        expectedPrice: item.expectedPrice,
        comments: item.comments
      }))
    };

    this.poService.createWithItems(payload).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Purchase Order #${response.id} created successfully`
        });
        this.router.navigate(['/secure/purchases/orders']);
      },
      error: (err) => {
        this.saving = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to create purchase order'
        });
      }
    });
  }

  onCancel() {
    this.router.navigate(['/secure/purchases/orders']);
  }

  goToSmartSuggestions() {
    this.router.navigate(['/secure/purchases/orders/suggestions']);
  }

  // Import from Sales Intents
  showSalesIntents() {
    const vendorId = this.form.value.vendorid;
    if (!vendorId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Select Vendor',
        detail: 'Please select a vendor first'
      });
      return;
    }

    this.showIntentsDialog = true;
    this.loadingIntents = true;
    this.salesIntents = [];

    this.intentService.findAllByCriteria({ status: 'PENDING', vendorid: vendorId }).subscribe({
      next: (data: any) => {
        this.salesIntents = Array.isArray(data) ? data.map((intent: any) => ({...intent, selected: false})) : [];
        this.loadingIntents = false;
      },
      error: () => {
        this.loadingIntents = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load sales intents'
        });
      }
    });
  }

  toggleAllIntents(event: any) {
    const checked = event.target.checked;
    this.salesIntents.forEach(intent => intent.selected = checked);
  }

  isAllIntentsSelected(): boolean {
    return this.salesIntents.length > 0 && this.salesIntents.every(intent => intent.selected);
  }

  hasSelectedIntents(): boolean {
    return this.salesIntents.some(intent => intent.selected);
  }

  getSelectedIntentsCount(): number {
    return this.salesIntents.filter(intent => intent.selected).length;
  }

  importSelectedIntents() {
    const selectedIntents = this.salesIntents.filter(intent => intent.selected);

    selectedIntents.forEach(intent => {
      // Check if product already in items
      const existing = this.items.find(item => item.productId === intent.productid);
      if (!existing) {
        this.items.push({
          productId: intent.productid,
          productName: intent.product?.title || `Product ${intent.productid}`,
          qty: intent.qty,
          expectedPrice: undefined,
          comments: `From intent: ${intent.customer?.name || 'Customer'}`
        });
      } else {
        // Increase quantity if product already added
        existing.qty += intent.qty;
      }
    });

    this.showIntentsDialog = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Imported',
      detail: `Added ${selectedIntents.length} product(s) from sales intents`
    });
  }

  // Import from Smart Suggestions
  showSmartSuggestions() {
    const vendorId = this.form.value.vendorid;
    if (!vendorId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Select Vendor',
        detail: 'Please select a vendor first'
      });
      return;
    }

    const storeId = 1; // Default store ID

    this.showSuggestionsDialog = true;
    this.loadingSuggestions = true;
    this.smartSuggestions = null;

    this.poService.getSmartSuggestions(storeId).subscribe({
      next: (data: any) => {
        // Filter for selected vendor and add selected flag
        this.smartSuggestions = {
          lowStock: Array.isArray(data.lowStock)
            ? data.lowStock.filter((item: any) => item.vendorId === vendorId).map((item: any) => ({...item, selected: false}))
            : [],
          intents: Array.isArray(data.intents)
            ? data.intents.filter((item: any) => item.vendorId === vendorId).map((item: any) => ({...item, selected: false}))
            : []
        };
        this.loadingSuggestions = false;
      },
      error: () => {
        this.loadingSuggestions = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load smart suggestions'
        });
      }
    });
  }

  toggleAllLowStock(event: any) {
    const checked = event.target.checked;
    if (this.smartSuggestions?.lowStock) {
      this.smartSuggestions.lowStock.forEach((item: any) => item.selected = checked);
    }
  }

  isAllLowStockSelected(): boolean {
    return this.smartSuggestions?.lowStock?.length > 0 &&
           this.smartSuggestions.lowStock.every((item: any) => item.selected);
  }

  hasSelectedSuggestions(): boolean {
    return (this.smartSuggestions?.lowStock?.some((item: any) => item.selected)) || false;
  }

  getSelectedSuggestionsCount(): number {
    let count = 0;
    if (this.smartSuggestions?.lowStock) {
      count += this.smartSuggestions.lowStock.filter((item: any) => item.selected).length;
    }
    return count;
  }

  importSelectedSuggestions() {
    let imported = 0;

    // Import low stock items
    if (this.smartSuggestions?.lowStock) {
      const selectedLowStock = this.smartSuggestions.lowStock.filter((item: any) => item.selected);
      selectedLowStock.forEach((item: any) => {
        const existing = this.items.find(i => i.productId === item.productId);
        if (!existing) {
          this.items.push({
            productId: item.productId,
            productName: item.productTitle,
            qty: item.suggestedQty,
            expectedPrice: undefined,
            comments: `Low stock: ${item.currentStock}/${item.minStock}`
          });
          imported++;
        } else {
          existing.qty += item.suggestedQty;
          imported++;
        }
      });
    }

    this.showSuggestionsDialog = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Imported',
      detail: `Added ${imported} product(s) from smart suggestions`
    });
  }
}
