import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PricingRule, PricingRuleStatus, PricingRuleType } from 'src/entities/pricing-rule.entity';
import { PricingCalculatorService, PricingInput, PricingMethod, PricingResult } from './pricing-calculator.service';

export interface ApplicableRule {
  ruleId: number;
  ruleCode: string;
  ruleName: string;
  ruleType: PricingRuleType | null;
  calculationMethod: string;
  marginPcnt: number | null;
  discountPcnt: number | null;
  fixedPrice: number | null;
  priority: number | null;
  stackable: boolean | null;
}

export interface PricingWithRules {
  pricingResult: PricingResult;
  appliedRule: ApplicableRule | null;
  availableRules: ApplicableRule[];
}

@Injectable()
export class PricingRulesService {

  constructor(
    @InjectRepository(PricingRule)
    private readonly pricingRuleRepository: Repository<PricingRule>,
    @InjectEntityManager()
    private manager: EntityManager,
    private pricingCalculatorService: PricingCalculatorService
  ) {}

  /**
   * Get all active pricing rules for a product
   */
  async getActivePricingRules(
    productId: number,
    category: string,
    quantity: number = 1,
    date: Date = new Date()
  ): Promise<ApplicableRule[]> {
    const dateStr = date.toISOString().split('T')[0];

    const result = await this.manager.query(
      `SELECT * FROM get_active_pricing_rules($1, $2, $3, $4)`,
      [productId, category, quantity, dateStr]
    );

    return result.map((row: any) => ({
      ruleId: row.rule_id,
      ruleCode: row.rule_code,
      ruleName: row.rule_name,
      ruleType: row.rule_type,
      calculationMethod: row.calculation_method,
      marginPcnt: row.margin_pcnt ? parseFloat(row.margin_pcnt) : null,
      discountPcnt: row.discount_pcnt ? parseFloat(row.discount_pcnt) : null,
      fixedPrice: row.fixed_price ? parseFloat(row.fixed_price) : null,
      priority: row.priority,
      stackable: row.stackable,
    }));
  }

  /**
   * Get the best (highest priority) pricing rule for a product
   */
  async getBestPricingRule(
    productId: number,
    category: string,
    quantity: number = 1,
    date: Date = new Date()
  ): Promise<ApplicableRule | null> {
    const dateStr = date.toISOString().split('T')[0];

    const result = await this.manager.query(
      `SELECT * FROM get_best_pricing_rule($1, $2, $3, $4)`,
      [productId, category, quantity, dateStr]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      ruleId: row.rule_id,
      ruleCode: row.rule_code,
      ruleName: row.rule_name,
      ruleType: null, // Not returned by function
      calculationMethod: row.calculation_method,
      marginPcnt: row.margin_pcnt ? parseFloat(row.margin_pcnt) : null,
      discountPcnt: row.discount_pcnt ? parseFloat(row.discount_pcnt) : null,
      fixedPrice: row.fixed_price ? parseFloat(row.fixed_price) : null,
      priority: null, // Not returned by function
      stackable: null, // Not returned by function
    };
  }

  /**
   * Calculate price with applicable pricing rules
   */
  async calculatePriceWithRules(
    productId: number,
    category: string,
    ptr: number,
    mrp: number,
    taxRate: number,
    quantity: number = 1,
    taxInclusive: boolean = false
  ): Promise<PricingWithRules> {
    // Get all applicable rules
    const availableRules = await this.getActivePricingRules(
      productId,
      category,
      quantity
    );

    // Get best rule
    const bestRule = availableRules.length > 0 ? availableRules[0] : null;

    // Calculate price based on best rule or default
    let pricingInput: PricingInput;

    if (bestRule) {
      // Use rule-based pricing
      const method = this.mapCalculationMethodToEnum(bestRule.calculationMethod);

      pricingInput = {
        ptr,
        mrp,
        taxRate,
        method,
        marginPercent: bestRule.marginPcnt || undefined,
        discountPercent: bestRule.discountPcnt || undefined,
        fixedPrice: bestRule.fixedPrice || undefined,
        taxInclusive,
      };
    } else {
      // Use default margin-based pricing
      pricingInput = {
        ptr,
        mrp,
        taxRate,
        method: PricingMethod.MARGIN_ON_PTR,
        marginPercent: 20, // Default 20% margin
        taxInclusive,
      };
    }

    const pricingResult = this.pricingCalculatorService.calculatePrice(pricingInput);

    return {
      pricingResult,
      appliedRule: bestRule,
      availableRules,
    };
  }

  /**
   * Create a new pricing rule
   */
  async createPricingRule(
    data: Partial<PricingRule>,
    userId: number
  ): Promise<PricingRule> {
    const rule = this.pricingRuleRepository.create({
      ...data,
      createdby: userId,
      updatedby: userId,
    });

    return await this.pricingRuleRepository.save(rule);
  }

  /**
   * Update a pricing rule
   */
  async updatePricingRule(
    id: number,
    data: Partial<PricingRule>,
    userId: number
  ): Promise<void> {
    await this.pricingRuleRepository.update(id, {
      ...data,
      updatedby: userId,
    });
  }

  /**
   * Activate a pricing rule
   */
  async activatePricingRule(id: number, userId: number): Promise<void> {
    await this.pricingRuleRepository.update(id, {
      status: PricingRuleStatus.ACTIVE,
      updatedby: userId,
    });
  }

  /**
   * Pause a pricing rule
   */
  async pausePricingRule(id: number, userId: number): Promise<void> {
    await this.pricingRuleRepository.update(id, {
      status: PricingRuleStatus.PAUSED,
      updatedby: userId,
    });
  }

  /**
   * Delete (archive) a pricing rule
   */
  async deletePricingRule(id: number, userId: number): Promise<void> {
    await this.pricingRuleRepository.update(id, {
      isArchived: true,
      updatedby: userId,
    });
  }

  /**
   * Get all pricing rules (with filters)
   */
  async findAll(filters?: {
    status?: PricingRuleStatus;
    ruleType?: PricingRuleType;
    category?: string;
    activeOnly?: boolean;
  }): Promise<PricingRule[]> {
    const qb = this.pricingRuleRepository.createQueryBuilder('pr')
      .where('pr.isArchived = :archived', { archived: false });

    if (filters?.activeOnly) {
      qb.andWhere('pr.isActive = :active', { active: true });
    }

    if (filters?.status) {
      qb.andWhere('pr.status = :status', { status: filters.status });
    }

    if (filters?.ruleType) {
      qb.andWhere('pr.ruletype = :ruleType', { ruleType: filters.ruleType });
    }

    if (filters?.category) {
      qb.andWhere('pr.category = :category', { category: filters.category });
    }

    qb.orderBy('pr.priority', 'DESC')
      .addOrderBy('pr.createdon', 'DESC');

    return await qb.getMany();
  }

  /**
   * Get pricing rule by ID
   */
  async findById(id: number): Promise<PricingRule | null> {
    return await this.pricingRuleRepository.findOne({ where: { id } });
  }

  /**
   * Get pricing rule by code
   */
  async findByCode(ruleCode: string): Promise<PricingRule | null> {
    return await this.pricingRuleRepository.findOne({
      where: { rulecode: ruleCode }
    });
  }

  /**
   * Map calculation method string to PricingMethod enum
   */
  private mapCalculationMethodToEnum(method: string): PricingMethod {
    switch (method) {
      case 'MARGIN_ON_PTR':
        return PricingMethod.MARGIN_ON_PTR;
      case 'DISCOUNT_FROM_MRP':
        return PricingMethod.DISCOUNT_FROM_MRP;
      case 'FIXED_PRICE':
        return PricingMethod.FIXED_PRICE;
      case 'PROMOTIONAL':
        return PricingMethod.PROMOTIONAL;
      case 'CLEARANCE':
        return PricingMethod.CLEARANCE;
      default:
        return PricingMethod.MARGIN_ON_PTR;
    }
  }

  /**
   * Log pricing rule application
   */
  async logRuleApplication(
    ruleId: number,
    productId: number,
    originalPrice: number,
    calculatedPrice: number,
    discountAmount: number,
    marginPcnt: number,
    quantity: number,
    userId: number
  ): Promise<void> {
    await this.manager.query(
      `INSERT INTO pricing_rule_application
        (pricing_rule_id, product_id, original_price, calculated_price,
         discount_amount, margin_pcnt, quantity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [ruleId, productId, originalPrice, calculatedPrice, discountAmount, marginPcnt, quantity, userId]
    );
  }

  /**
   * Get pricing rule statistics
   */
  async getRuleStatistics(): Promise<any> {
    const result = await this.manager.query(`
      SELECT
        status,
        rule_type,
        COUNT(*) as count,
        COUNT(CASE WHEN CURRENT_DATE BETWEEN valid_from AND valid_to THEN 1 END) as currently_valid
      FROM pricing_rule
      WHERE active = true AND archive = false
      GROUP BY status, rule_type
      ORDER BY status, rule_type
    `);

    return result;
  }

  /**
   * Get pricing rule applications report
   */
  async getRuleApplicationsReport(
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const result = await this.manager.query(`
      SELECT
        pr.rule_code,
        pr.rule_name,
        pr.rule_type,
        COUNT(pra.id) as application_count,
        SUM(pra.discount_amount) as total_discount_given,
        AVG(pra.margin_pcnt) as avg_margin,
        MIN(pra.applied_on) as first_applied,
        MAX(pra.applied_on) as last_applied
      FROM pricing_rule_application pra
      INNER JOIN pricing_rule pr ON pr.id = pra.pricing_rule_id
      WHERE pra.applied_on BETWEEN $1 AND $2
        AND pra.active = true
      GROUP BY pr.id, pr.rule_code, pr.rule_name, pr.rule_type
      ORDER BY application_count DESC
    `, [startDate, endDate]);

    return result;
  }
}
