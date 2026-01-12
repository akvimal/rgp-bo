import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-pricing-breakdown',
  templateUrl: './pricing-breakdown.component.html',
  styleUrls: ['./pricing-breakdown.component.scss']
})
export class PricingBreakdownComponent implements OnChanges {

  @Input() productId: number | null = null;
  @Input() ptr: number = 0;
  @Input() mrp: number = 0;
  @Input() quantity: number = 1;
  @Input() taxInclusive: boolean = false;

  loading: boolean = false;
  pricingData: any = null;
  error: string | null = null;

  // Pricing breakdown
  basePrice: number = 0;
  salePrice: number = 0;
  salePriceWithTax: number = 0;
  marginPercent: number = 0;
  marginAmount: number = 0;
  discountPercent: number = 0;
  discountAmount: number = 0;
  savingsForCustomer: number = 0;
  taxAmount: number = 0;

  // Applied rule
  appliedRule: any = null;
  availableRules: any[] = [];

  constructor(private productService: ProductService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes.productId || changes.ptr || changes.mrp || changes.quantity) &&
        this.productId && this.ptr > 0 && this.mrp > 0) {
      this.calculatePricing();
    }
  }

  calculatePricing(): void {
    if (!this.productId || this.ptr <= 0 || this.mrp <= 0) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.productService.calculatePriceWithRules(
      this.productId,
      {
        ptr: this.ptr,
        mrp: this.mrp,
        quantity: this.quantity,
        taxInclusive: this.taxInclusive
      }
    ).subscribe({
      next: (data: any) => {
        this.pricingData = data;

        // Extract pricing result
        const result = data.pricingResult;
        this.basePrice = result.basePrice;
        this.salePrice = result.salePrice;
        this.salePriceWithTax = result.salePriceWithTax;
        this.marginPercent = result.marginPercent;
        this.marginAmount = result.marginAmount;
        this.discountPercent = result.discountPercent;
        this.discountAmount = result.discountAmount;
        this.savingsForCustomer = result.savingsForCustomer;
        this.taxAmount = result.taxAmount;

        // Extract rules
        this.appliedRule = data.appliedRule;
        this.availableRules = data.availableRules;

        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to calculate pricing. Please try again.';
        this.loading = false;
        console.error('Pricing calculation error:', err);
      }
    });
  }

  getProfitMarginClass(): string {
    if (this.marginPercent >= 25) return 'text-success';
    if (this.marginPercent >= 15) return 'text-warning';
    return 'text-danger';
  }

  getDiscountBadgeClass(): string {
    if (this.discountPercent >= 20) return 'badge bg-danger';
    if (this.discountPercent >= 10) return 'badge bg-warning';
    return 'badge bg-info';
  }
}
