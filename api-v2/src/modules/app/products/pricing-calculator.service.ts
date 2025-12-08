import { Injectable } from '@nestjs/common';

/**
 * Pricing Calculation Methods
 */
export enum PricingMethod {
  MARGIN_ON_PTR = 'MARGIN_ON_PTR',           // Sale Price = PTR * (1 + margin%)
  DISCOUNT_FROM_MRP = 'DISCOUNT_FROM_MRP',   // Sale Price = MRP * (1 - discount%)
  FIXED_PRICE = 'FIXED_PRICE',               // Sale Price = Fixed amount
  PROMOTIONAL = 'PROMOTIONAL',               // Temporary promotional price
  CLEARANCE = 'CLEARANCE',                   // Clearance/expiry discount
}

/**
 * Pricing Calculation Input
 */
export interface PricingInput {
  ptr: number;                    // Purchase Trade Rate
  mrp: number;                    // Maximum Retail Price
  taxRate: number;                // Tax percentage (from HSN)
  marginPercent?: number;         // Margin percentage
  discountPercent?: number;       // Discount percentage
  fixedPrice?: number;            // Fixed sale price
  method: PricingMethod;          // Calculation method
  taxInclusive?: boolean;         // Whether sale price includes tax
}

/**
 * Pricing Calculation Result
 */
export interface PricingResult {
  // Input values
  ptr: number;
  mrp: number;
  taxRate: number;
  method: PricingMethod;

  // Calculated values
  basePrice: number;              // PTR + tax if applicable
  salePrice: number;              // Final sale price (before tax if tax_inclusive=false)
  salePriceWithTax: number;       // Sale price including tax
  marginPercent: number;          // Actual margin achieved
  marginAmount: number;           // Margin in rupees
  discountPercent: number;        // Discount from MRP
  discountAmount: number;         // Discount in rupees
  savingsForCustomer: number;     // MRP - sale_price_with_tax
  taxAmount: number;              // Tax amount
  taxInclusive: boolean;          // Whether sale price includes tax

  // Validations
  valid: boolean;                 // Whether calculation is valid
  warnings: string[];             // Any warnings (e.g., sale price > MRP)
}

@Injectable()
export class PricingCalculatorService {

  /**
   * Calculate pricing based on margin on PTR
   * Formula: Sale Price = PTR * (1 + margin%)
   */
  calculateMarginOnPTR(input: PricingInput): PricingResult {
    const { ptr, mrp, taxRate, marginPercent, taxInclusive } = input;

    // Base price is PTR + tax
    const basePrice = ptr * (1 + taxRate / 100);

    // Calculate sale price from margin
    const salePrice = ptr * (1 + (marginPercent || 0) / 100);

    // Calculate sale price with tax
    const salePriceWithTax = taxInclusive
      ? salePrice
      : salePrice * (1 + taxRate / 100);

    // Calculate actual margin and discount
    const marginAmount = salePrice - ptr;
    const actualMarginPercent = ((salePrice - ptr) / ptr) * 100;
    const discountAmount = Math.max(0, mrp - salePriceWithTax);
    const discountPercent = mrp > 0 ? (discountAmount / mrp) * 100 : 0;
    const savingsForCustomer = discountAmount;
    const taxAmount = taxInclusive
      ? (salePrice * taxRate) / (100 + taxRate)
      : salePrice * (taxRate / 100);

    // Validations
    const warnings: string[] = [];
    if (salePriceWithTax > mrp) {
      warnings.push(`Sale price with tax (${salePriceWithTax.toFixed(2)}) exceeds MRP (${mrp.toFixed(2)})`);
    }
    if (salePrice < ptr) {
      warnings.push(`Sale price (${salePrice.toFixed(2)}) is below PTR (${ptr.toFixed(2)})`);
    }

    return {
      ptr,
      mrp,
      taxRate,
      method: PricingMethod.MARGIN_ON_PTR,
      basePrice: Number(basePrice.toFixed(2)),
      salePrice: Number(salePrice.toFixed(2)),
      salePriceWithTax: Number(salePriceWithTax.toFixed(2)),
      marginPercent: Number(actualMarginPercent.toFixed(2)),
      marginAmount: Number(marginAmount.toFixed(2)),
      discountPercent: Number(discountPercent.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      savingsForCustomer: Number(savingsForCustomer.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      taxInclusive: taxInclusive || false,
      valid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Calculate pricing based on discount from MRP
   * Formula: Sale Price = MRP * (1 - discount%)
   */
  calculateDiscountFromMRP(input: PricingInput): PricingResult {
    const { ptr, mrp, taxRate, discountPercent, taxInclusive } = input;

    // Base price is PTR + tax
    const basePrice = ptr * (1 + taxRate / 100);

    // Calculate sale price from discount
    // If tax inclusive, discount is from MRP (which includes tax)
    // If not tax inclusive, we need to work backwards
    let salePrice: number;
    let salePriceWithTax: number;

    if (taxInclusive) {
      salePriceWithTax = mrp * (1 - (discountPercent || 0) / 100);
      salePrice = salePriceWithTax; // Already includes tax
    } else {
      // MRP is with tax, so first get base MRP
      const baseMRP = mrp / (1 + taxRate / 100);
      salePrice = baseMRP * (1 - (discountPercent || 0) / 100);
      salePriceWithTax = salePrice * (1 + taxRate / 100);
    }

    // Calculate actual margin and discount
    const marginAmount = salePrice - ptr;
    const marginPercent = ptr > 0 ? ((salePrice - ptr) / ptr) * 100 : 0;
    const discountAmount = Math.max(0, mrp - salePriceWithTax);
    const actualDiscountPercent = mrp > 0 ? (discountAmount / mrp) * 100 : 0;
    const savingsForCustomer = discountAmount;
    const taxAmount = taxInclusive
      ? (salePrice * taxRate) / (100 + taxRate)
      : salePrice * (taxRate / 100);

    // Validations
    const warnings: string[] = [];
    if (salePriceWithTax > mrp) {
      warnings.push(`Sale price with tax (${salePriceWithTax.toFixed(2)}) exceeds MRP (${mrp.toFixed(2)})`);
    }
    if (salePrice < ptr) {
      warnings.push(`Sale price (${salePrice.toFixed(2)}) is below PTR (${ptr.toFixed(2)})`);
    }

    return {
      ptr,
      mrp,
      taxRate,
      method: PricingMethod.DISCOUNT_FROM_MRP,
      basePrice: Number(basePrice.toFixed(2)),
      salePrice: Number(salePrice.toFixed(2)),
      salePriceWithTax: Number(salePriceWithTax.toFixed(2)),
      marginPercent: Number(marginPercent.toFixed(2)),
      marginAmount: Number(marginAmount.toFixed(2)),
      discountPercent: Number(actualDiscountPercent.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      savingsForCustomer: Number(savingsForCustomer.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      taxInclusive: taxInclusive || false,
      valid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Calculate pricing with fixed sale price
   */
  calculateFixedPrice(input: PricingInput): PricingResult {
    const { ptr, mrp, taxRate, fixedPrice, taxInclusive } = input;

    if (!fixedPrice) {
      throw new Error('Fixed price must be provided for FIXED_PRICE method');
    }

    // Base price is PTR + tax
    const basePrice = ptr * (1 + taxRate / 100);

    const salePrice = fixedPrice;
    const salePriceWithTax = taxInclusive
      ? salePrice
      : salePrice * (1 + taxRate / 100);

    // Calculate actual margin and discount
    const marginAmount = salePrice - ptr;
    const marginPercent = ptr > 0 ? ((salePrice - ptr) / ptr) * 100 : 0;
    const discountAmount = Math.max(0, mrp - salePriceWithTax);
    const discountPercent = mrp > 0 ? (discountAmount / mrp) * 100 : 0;
    const savingsForCustomer = discountAmount;
    const taxAmount = taxInclusive
      ? (salePrice * taxRate) / (100 + taxRate)
      : salePrice * (taxRate / 100);

    // Validations
    const warnings: string[] = [];
    if (salePriceWithTax > mrp) {
      warnings.push(`Sale price with tax (${salePriceWithTax.toFixed(2)}) exceeds MRP (${mrp.toFixed(2)})`);
    }
    if (salePrice < ptr) {
      warnings.push(`Sale price (${salePrice.toFixed(2)}) is below PTR (${ptr.toFixed(2)})`);
    }

    return {
      ptr,
      mrp,
      taxRate,
      method: PricingMethod.FIXED_PRICE,
      basePrice: Number(basePrice.toFixed(2)),
      salePrice: Number(salePrice.toFixed(2)),
      salePriceWithTax: Number(salePriceWithTax.toFixed(2)),
      marginPercent: Number(marginPercent.toFixed(2)),
      marginAmount: Number(marginAmount.toFixed(2)),
      discountPercent: Number(discountPercent.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      savingsForCustomer: Number(savingsForCustomer.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      taxInclusive: taxInclusive || false,
      valid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Master calculation method - routes to appropriate calculator
   */
  calculatePrice(input: PricingInput): PricingResult {
    switch (input.method) {
      case PricingMethod.MARGIN_ON_PTR:
        return this.calculateMarginOnPTR(input);

      case PricingMethod.DISCOUNT_FROM_MRP:
        return this.calculateDiscountFromMRP(input);

      case PricingMethod.FIXED_PRICE:
        return this.calculateFixedPrice(input);

      case PricingMethod.PROMOTIONAL:
        // For now, promotional uses fixed price
        // Can be enhanced with time-based rules
        return this.calculateFixedPrice(input);

      case PricingMethod.CLEARANCE:
        // For now, clearance uses discount from MRP
        // Can be enhanced with expiry-based calculations
        return this.calculateDiscountFromMRP(input);

      default:
        throw new Error(`Unsupported pricing method: ${input.method}`);
    }
  }

  /**
   * Calculate optimal sale price to achieve target margin
   */
  calculatePriceForTargetMargin(
    ptr: number,
    mrp: number,
    taxRate: number,
    targetMarginPercent: number,
    taxInclusive: boolean = false
  ): PricingResult {
    return this.calculateMarginOnPTR({
      ptr,
      mrp,
      taxRate,
      marginPercent: targetMarginPercent,
      method: PricingMethod.MARGIN_ON_PTR,
      taxInclusive,
    });
  }

  /**
   * Calculate optimal sale price to achieve target discount
   */
  calculatePriceForTargetDiscount(
    ptr: number,
    mrp: number,
    taxRate: number,
    targetDiscountPercent: number,
    taxInclusive: boolean = false
  ): PricingResult {
    return this.calculateDiscountFromMRP({
      ptr,
      mrp,
      taxRate,
      discountPercent: targetDiscountPercent,
      method: PricingMethod.DISCOUNT_FROM_MRP,
      taxInclusive,
    });
  }

  /**
   * Compare multiple pricing strategies
   */
  comparePricingStrategies(
    ptr: number,
    mrp: number,
    taxRate: number,
    marginPercent: number,
    discountPercent: number,
    fixedPrice: number,
    taxInclusive: boolean = false
  ): {
    marginStrategy: PricingResult;
    discountStrategy: PricingResult;
    fixedStrategy: PricingResult;
    recommendation: PricingMethod;
  } {
    const marginStrategy = this.calculateMarginOnPTR({
      ptr, mrp, taxRate, marginPercent, method: PricingMethod.MARGIN_ON_PTR, taxInclusive
    });

    const discountStrategy = this.calculateDiscountFromMRP({
      ptr, mrp, taxRate, discountPercent, method: PricingMethod.DISCOUNT_FROM_MRP, taxInclusive
    });

    const fixedStrategy = this.calculateFixedPrice({
      ptr, mrp, taxRate, fixedPrice, method: PricingMethod.FIXED_PRICE, taxInclusive
    });

    // Recommend strategy with highest margin that's still valid
    let recommendation = PricingMethod.FIXED_PRICE;
    let maxMargin = -Infinity;

    if (marginStrategy.valid && marginStrategy.marginPercent > maxMargin) {
      maxMargin = marginStrategy.marginPercent;
      recommendation = PricingMethod.MARGIN_ON_PTR;
    }

    if (discountStrategy.valid && discountStrategy.marginPercent > maxMargin) {
      maxMargin = discountStrategy.marginPercent;
      recommendation = PricingMethod.DISCOUNT_FROM_MRP;
    }

    if (fixedStrategy.valid && fixedStrategy.marginPercent > maxMargin) {
      maxMargin = fixedStrategy.marginPercent;
      recommendation = PricingMethod.FIXED_PRICE;
    }

    return {
      marginStrategy,
      discountStrategy,
      fixedStrategy,
      recommendation,
    };
  }
}
