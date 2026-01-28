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

  /**
   * Configurable thresholds based on business operations, product category, and market strategy.
   *
   * PHARMACY INDUSTRY STANDARDS:
   * - Generic Medicines: 50-80% margin (high competition, volume-based)
   * - Branded Medicines: 10-30% margin (regulated pricing, lower margins)
   * - OTC Products: 30-50% margin (balance of volume and margin)
   * - Premium/Specialty: 40-60% margin (low volume, high margin)
   *
   * CUSTOMIZATION EXAMPLES:
   * 1. Generic medicines: marginThresholds = { good: 60, acceptable: 40 }
   * 2. Branded medicines: marginThresholds = { good: 20, acceptable: 10 }
   * 3. Promotional items: discountThresholds = { high: 30, medium: 15 }
   * 4. Premium positioning: discountThresholds = { high: 10, medium: 5 }
   *
   * These thresholds control the color-coding in the UI:
   * - Margin: Green (good) | Yellow (acceptable) | Red (below acceptable)
   * - Discount: Red (aggressive) | Yellow (moderate) | Blue (premium)
   */
  @Input() marginThresholds = {
    good: 25,      // >= 25% profit margin (green) - default for mixed inventory
    acceptable: 15 // >= 15% profit margin (yellow), < 15% is low (red)
  };

  @Input() discountThresholds = {
    high: 20,      // >= 20% discount (red - aggressive pricing, may hurt brand)
    medium: 10     // >= 10% discount (yellow - moderate), < 10% is low (blue - premium positioning)
  };

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
    if (this.marginPercent >= this.marginThresholds.good) return 'text-success';
    if (this.marginPercent >= this.marginThresholds.acceptable) return 'text-warning';
    return 'text-danger';
  }

  getDiscountBadgeClass(): string {
    if (this.discountPercent >= this.discountThresholds.high) return 'badge bg-danger';
    if (this.discountPercent >= this.discountThresholds.medium) return 'badge bg-warning';
    return 'badge bg-info';
  }
}
